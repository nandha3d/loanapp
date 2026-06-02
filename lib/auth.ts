import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { compare } from 'bcryptjs';
// Prisma is imported dynamically inside functions to prevent Edge Runtime errors in middleware
import { verifySync } from 'otplib';
import { checkRateLimit, getClientIp, loginIpKey, loginUserKey } from './rateLimit';

const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 10);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000);
// Per-IP limit: higher ceiling — blocks distributed attacks
const LOGIN_IP_MAX = Number(process.env.LOGIN_IP_MAX || 30);

type AuthorizedUser = {
  role?: string;
  appType?: string;
  tenantId?: string;
  branchId?: string | null;
  phone?: string;
  username?: string;
};

/**
 * Resolves a tenantId from a Host header value.
 * Inlined here to avoid a circular import with lib/tenant.ts (which imports auth).
 */
async function resolveLoginTenantId(host: string | null): Promise<string | null> {
  if (!host) return null;
  const hostname = host.toLowerCase().split(':')[0];
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return null;
  }

  const rootDomain = (
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.APP_ROOT_DOMAIN || ''
  ).toLowerCase().split(':')[0];

  let slug: string | null = null;

  if (rootDomain && rootDomain !== hostname) {
    if (hostname.endsWith(`.${rootDomain}`)) {
      slug = hostname.slice(0, -(rootDomain.length + 1)).split('.')[0] || null;
    }
  } else {
    const labels = hostname.split('.');
    // If it's a subdomain (e.g. tenant.domain.com), use the first label
    // If it's a 3rd level subdomain (e.g. springgreen-emu-806212.hostingersite.com), 
    // we need to be careful if hostingersite.com is the root.
    if (labels.length > 2) {
      slug = labels[0];
    }
  }

  if (!slug) return null;

  try {
    const prisma = (await import('./db')).default;
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    return tenant?.status === 'active' ? tenant.id : null;
  } catch (err) {
    console.error('[AUTH_TENANT_RESOLVE_ERROR]', err);
    return null;
  }
}


export const { handlers, signIn, signOut, auth } = (NextAuth as any)({
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember Me', type: 'text' },
        totpCode: { label: 'TOTP Code', type: 'text' },
      },
      async authorize(credentials, request) {
        try {
          if (!credentials?.username || !credentials?.password) return null;
          const username = String(credentials.username).trim().toLowerCase();

          // ── Distributed rate limiting (MySQL-backed) ─────────────────────────
          const ip = getClientIp(request as unknown as Request);
          
          console.log(`[AUTH_DEBUG] Attempting login for user: ${username} from IP: ${ip}`);

          // Use a shorter timeout for rate limiting to fail fast
          const rateLimitTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('RATE_LIMIT_TIMEOUT')), 5000));
          
          try {
            const [ipLimit, userLimit] = await Promise.race([
              Promise.all([
                checkRateLimit(loginIpKey(ip), { limit: LOGIN_IP_MAX, windowMs: LOGIN_WINDOW_MS }),
                checkRateLimit(loginUserKey(username), { limit: LOGIN_MAX_ATTEMPTS, windowMs: LOGIN_WINDOW_MS }),
              ]),
              rateLimitTimeout
            ]) as any;

            if (!ipLimit.allowed || !userLimit.allowed) {
              console.warn(`[AUTH_WARN] Rate limit exceeded for ${username} (IP: ${ip})`);
              return null;
            }
          } catch (rlError: any) {
            console.error('[AUTH_ERROR] Rate limit check failed:', rlError.message);
            // If rate limit table is missing or DB is down, we might want to allow 
            // the attempt anyway to avoid locking out everyone, or fail closed.
            // Failing closed for security, but logging clearly.
          }

          // ── Tenant-scoped user lookup ─────────────────────────────────────────
          const host = (request as any)?.headers?.get?.('host') ?? null;
          const tenantIdFromHost = await resolveLoginTenantId(host);
          
          console.log(`[AUTH_DEBUG] Resolved tenantId from host (${host}): ${tenantIdFromHost}`);

          // Use a timeout for the main user lookup
          const dbTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DATABASE_TIMEOUT')), 10000));

          const prisma = (await import('./db')).default;
          const user = await Promise.race([
            prisma.user.findFirst({
              where: {
                OR: [
                  { username },
                  { phone: username },
                ],
                status: 'active',
                ...(tenantIdFromHost ? { tenantId: tenantIdFromHost } : {}),
              },
              include: { tenant: true, branch: true },
            }),
            dbTimeout
          ]) as any;

          if (!user) {
            console.warn(`[AUTH_WARN] User not found: ${username} (Tenant: ${tenantIdFromHost})`);
            return null;
          }

          if (user.tenant.status !== 'active') {
            console.warn(`[AUTH_WARN] Tenant inactive for user: ${username}`);
            return null;
          }

          if (!tenantIdFromHost && process.env.ALLOW_ROOT_DOMAIN_LOGIN === 'false') {
            console.warn(`[AUTH_WARN] Root domain login blocked for user: ${username}`);
            return null; 
          }

          if (!user.passwordHash) {
            console.warn(`[AUTH_WARN] Password login not set for user: ${username}`);
            return null;
          }

          const isValid = await compare(credentials.password as string, user.passwordHash);
          if (!isValid) {
            console.warn(`[AUTH_WARN] Invalid password for user: ${username}`);
            return null;
          }

          // ── 2FA Verification ─────────────────────────────────────────────────
          if (user.totpSecret) {
            const totpCode = credentials.totpCode as string;
            if (!totpCode) {
              throw new Error('2FA_REQUIRED');
            }
            const { valid: isTotpValid } = verifySync({ token: totpCode, secret: user.totpSecret });
            if (!isTotpValid) {
              throw new Error('INVALID_TOTP');
            }
          }
          // ─────────────────────────────────────────────────────────────────────

          // Update last login
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }).catch(e => console.error('[AUTH_ERROR] Failed to update lastLoginAt:', e));

          await prisma.auditLog.create({
            data: {
              tenantId: user.tenantId,
              userId: user.id,
              action: 'login',
              entityType: 'auth',
              entityId: user.id,
              ipAddress: ip,
              userAgent: (request as any)?.headers?.get?.('user-agent') ?? null,
              newValue: JSON.stringify({ username: user.username, role: user.role }),
            },
          }).catch(e => console.error('[AUTH_ERROR] Failed to create login audit log:', e));

          console.log(`[AUTH_SUCCESS] User logged in: ${username} (Role: ${user.role})`);

          return {
            id: user.id,
            name: user.name,
            email: user.email || undefined,
            role: user.role,
            appType: user.appType,
            tenantId: user.tenantId,
            branchId: user.branchId,
            phone: user.phone,
            username: user.username,
            rememberMe: credentials.rememberMe === 'true',
          };
        } catch (error: any) {
          console.error('[AUTH_ERROR_DETAILS] Authorize failed:', error.message || error);
          
          if (error.message === 'DATABASE_TIMEOUT') {
            throw new Error('Database is taking too long to respond. Please try again.');
          }
          if (error.message === 'RATE_LIMIT_TIMEOUT') {
            throw new Error('Security check timeout. Please try again.');
          }
          
          throw error;
        }
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account }: any) {
      if (account?.provider === 'google') {
        try {
          const prisma = (await import('./db')).default;
          const dbUser = await prisma.user.findFirst({
            where: {
              OR: [
                { googleId: user.id },
                { email: user.email }
              ]
            },
            select: { id: true, googleId: true }
          });
          if (!dbUser) {
            return `/register?google_email=${encodeURIComponent(user.email || '')}&google_name=${encodeURIComponent(user.name || '')}&google_id=${encodeURIComponent(user.id || '')}`;
          }
          if (!dbUser.googleId) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { googleId: user.id }
            });
          }
          user.id = dbUser.id;
          return true;
        } catch (e) {
          console.error('[GOOGLE_SIGNIN_CALLBACK_ERROR]', e);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }: any) {
      if (user) {
        // Only store minimal essential data in JWT for authorization
        // Sensitive data (tenantId, branchId, phone, username) are fetched server-side in session callback
        token.userId = user.id;
        const authorizedUser = user as AuthorizedUser;
        token.role = authorizedUser.role;
        
        // Handle dynamic expiration based on Remember Me
        const rememberMe = (user as any).rememberMe;
        // NOTE: We rely on maxAge instead of manually setting exp if possible 
        // to avoid sync issues, but if we do it, ensure it's in the future.
        const now = Math.floor(Date.now() / 1000);
        if (!rememberMe) {
          token.exp = now + (24 * 60 * 60); // 24 hours
        } else {
          token.exp = now + (30 * 24 * 60 * 60); // 30 days
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).id = token.userId;

        // Fetch all necessary user data from DB to prevent stale/exposed data in JWT
        try {
          const prisma = (await import('./db')).default;
          let dbUser = await prisma.user.findUnique({
            where: { id: token.userId },
            select: { 
              role: true, 
              appType: true, 
              branchId: true,
              tenantId: true,
              phone: true,
              username: true,
              tenant: {
                select: {
                  slug: true
                }
              }
            },
          });
          
          if (!dbUser) {
            console.error('[AUTH_SESSION_ERROR] User not found in database');
            return null;
          }

          let isMonitoring = false;
          let monitorTargetName = null;

          if (dbUser.role === 'developer') {
            try {
              const nextCookies = await import('next/headers').then(m => m.cookies());
              const monitorToken = nextCookies.get('monitor-token')?.value;
              
              if (monitorToken) {
                const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
                const encodedSecret = new TextEncoder().encode(secret);
                const { payload } = await import('jose').then(m => m.jwtVerify(monitorToken, encodedSecret));
                
                if (payload && payload.targetUserId) {
                  const targetUser = await prisma.user.findUnique({
                    where: { id: payload.targetUserId as string },
                    select: { 
                      role: true, 
                      appType: true, 
                      branchId: true,
                      tenantId: true,
                      phone: true,
                      username: true,
                      name: true,
                      tenant: { select: { slug: true } }
                    },
                  });
                  if (targetUser) {
                    monitorTargetName = targetUser.name || targetUser.username;
                    dbUser = targetUser as any; // Override dbUser with targetUser data
                    isMonitoring = true;
                  }
                }
              }
            } catch (e) {
              console.error('[MONITOR_ERROR] Failed to verify monitor token:', e);
            }
          }

          (session.user as any).role = dbUser.role;
          (session.user as any).appType = dbUser.appType;
          (session.user as any).branchId = dbUser.branchId;
          (session.user as any).tenantId = dbUser.tenantId;
          (session.user as any).phone = dbUser.phone;
          (session.user as any).username = dbUser.username;
          (session.user as any).tenantSlug = dbUser.tenant?.slug || null;
          (session.user as any).isMonitoring = isMonitoring;
          (session.user as any).monitorTargetName = monitorTargetName;
        } catch (e) {
          console.error('[AUTH_SESSION_DB_ERROR]', e);
          return null;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login', // Redirect errors back to login
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days globally, overridden in jwt callback
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        domain: process.env.NODE_ENV === 'production'
          ? (process.env.NEXT_PUBLIC_ROOT_DOMAIN ? `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN.split(':')[0]}` : undefined)
          : (process.env.NEXT_PUBLIC_ROOT_DOMAIN && process.env.NEXT_PUBLIC_ROOT_DOMAIN.includes('lvh.me') ? '.lvh.me' : undefined),
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
});
