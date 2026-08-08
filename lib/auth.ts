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

  // If host is IPv4 or IPv6, it's not a tenant host
  if (
    /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname) ||
    /^[0-9a-fA-F:]+$/.test(hostname.replace(/[\[\]]/g, ''))
  ) {
    return null;
  }

  // Custom domain (client's own domain) → tenant, before slug logic so login on
  // that domain is scoped to exactly that tenant.
  try {
    const prisma = (await import('./db')).default;
    const byDomain = await prisma.tenant.findUnique({
      where: { customDomain: hostname },
      select: { id: true, status: true },
    });
    if (byDomain) return byDomain.status === 'active' ? byDomain.id : null;
  } catch (err) {
    console.error('[AUTH_CUSTOMDOMAIN_RESOLVE_ERROR]', err);
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
    slug = labels.length > 2 ? labels[0] : null;
  }

  const reservedSlugs = ['www', 'api', 'admin', 'app', 'portal', 'support', 'static', 'assets'];
  if (slug && reservedSlugs.includes(slug.toLowerCase())) {
    return null;
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
                  { email: username },
                ],
                // Status checked after password verification (below) so we can
                // distinguish "wrong credentials" from "email not verified".
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

          // ── Account status gate (after auth) ─────────────────────────────────
          if (user.status === 'pending') {
            console.warn(`[AUTH_WARN] Email not verified for user: ${username}`);
            throw new Error('EMAIL_NOT_VERIFIED');
          }
          if (user.status !== 'active') {
            console.warn(`[AUTH_WARN] Inactive account (${user.status}) for user: ${username}`);
            return null;
          }

          // ── Allowed login window (Auto Finance collection agents) ────────────
          // Owners are exempt so a mis-set window can never lock the workspace
          // out of its own admin console.
          if (user.role !== 'superadmin' && user.role !== 'developer') {
            const { checkLoginWindow } = await import('./autofinance/operations');
            const windowCheck = checkLoginWindow(user);
            if (!windowCheck.allowed) {
              console.warn(`[AUTH_WARN] Outside login window (${windowCheck.window}) for user: ${username}`);
              throw new Error('LOGIN_WINDOW_CLOSED');
            }
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
    // ── Supabase bridge ──────────────────────────────────────────────────────
    // Supabase acts as an auth *broker* only (Google OAuth + email ownership
    // proof via magic-link/OTP). The browser obtains a Supabase access token,
    // hands it here, and we verify it server-side, then mint our normal MySQL-
    // backed session. Passwords & app data stay in MySQL; this never touches
    // them. New-Google-user onboarding is handled client-side (/auth/callback
    // prechecks and redirects to /register) so a missing account fails closed.
    Credentials({
      id: 'supabase',
      name: 'supabase',
      credentials: {
        access_token: { label: 'Supabase Access Token', type: 'text' },
      },
      async authorize(credentials) {
        try {
          const accessToken = String(credentials?.access_token || '');
          if (!accessToken) return null;

          const { verifySupabaseToken } = await import('./supabase/server');
          const identity = await verifySupabaseToken(accessToken);
          if (!identity || !identity.email) {
            console.warn('[SUPABASE_AUTH] Invalid/unverifiable access token');
            return null;
          }

          const prisma = (await import('./db')).default;

          // On a client's custom domain, scope the lookup to that tenant so a
          // same-email user in another tenant can't sign in here. On our root
          // SaaS host this resolves to null → unscoped (unchanged behaviour).
          let hostTenantId: string | null = null;
          try {
            const h = await (await import('next/headers')).headers();
            const host = h.get('x-zolofund-host') || h.get('host');
            hostTenantId = await resolveLoginTenantId(host);
          } catch { /* no host context — fall back to global lookup */ }

          const user = await prisma.user.findFirst({
            where: { email: identity.email, ...(hostTenantId ? { tenantId: hostTenantId } : {}) },
            include: { tenant: true, branch: true },
          });

          if (!user) {
            // No app account for this verified email. Onboarding is the client's
            // job (/auth/callback → /register prefilled); fail closed here.
            console.warn(`[SUPABASE_AUTH] No MySQL user for ${identity.email}`);
            return null;
          }
          if (user.tenant?.status !== 'active') {
            console.warn(`[SUPABASE_AUTH] Tenant inactive for ${identity.email}`);
            return null;
          }

          // Email ownership is now proven by Supabase → activate a pending
          // account (this is the verification step) and link Google identity.
          const patch: Record<string, unknown> = {};
          if (user.status === 'pending') patch.status = 'active';
          if (identity.provider === 'google' && !user.googleId && identity.supabaseUserId) {
            patch.googleId = identity.supabaseUserId;
          }
          patch.lastLoginAt = new Date();
          if (Object.keys(patch).length) {
            await prisma.user.update({ where: { id: user.id }, data: patch }).catch(
              (e) => console.error('[SUPABASE_AUTH] activate/link failed:', e),
            );
          }

          const effectiveStatus = user.status === 'pending' ? 'active' : user.status;
          if (effectiveStatus !== 'active') {
            console.warn(`[SUPABASE_AUTH] Inactive account (${user.status}) for ${identity.email}`);
            return null;
          }

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
            rememberMe: true,
          };
        } catch (e) {
          console.error('[SUPABASE_AUTH_ERROR]', e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // Multi-domain SaaS: sign-in/sign-out happens on tenant subdomains and
    // registered custom domains. The default same-origin check compares against
    // NEXTAUTH_URL (the root SaaS host), so a logout on a client domain would
    // bounce the browser to the root host — where a different session (e.g. the
    // developer account) may still be active. Allow the root domain, its
    // subdomains, and any tenant-claimed custom domain; everything else falls
    // back to baseUrl.
    async redirect({ url, baseUrl }: any) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        const target = new URL(url);
        if (target.origin === baseUrl) return url;
        if (target.protocol !== 'https:' && target.protocol !== 'http:') return baseUrl;

        const hostname = target.hostname.toLowerCase();
        const rootDomain = (
          process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.APP_ROOT_DOMAIN || ''
        ).toLowerCase().split(':')[0];
        if (rootDomain && (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`))) {
          return url;
        }

        // Explicitly configured standalone client domains (comma-separated,
        // e.g. "loan.samuraibuiness.in"). Covers domains routed to this app
        // before any tenant has claimed them (pre-registration), without
        // opening redirects to arbitrary hosts.
        const standaloneDomains = (process.env.STANDALONE_DOMAINS || '')
          .toLowerCase()
          .split(',')
          .map((d) => d.trim().split(':')[0])
          .filter(Boolean);
        if (standaloneDomains.includes(hostname)) return url;

        const prisma = (await import('./db')).default;
        const tenant = await prisma.tenant.findUnique({
          where: { customDomain: hostname },
          select: { id: true },
        });
        if (tenant) return url;
      } catch (err) {
        console.error('[AUTH_REDIRECT_CALLBACK_ERROR]', err);
      }
      return baseUrl;
    },
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
        
        let role = (user as AuthorizedUser).role;
        let tenantId = (user as AuthorizedUser).tenantId;
        let branchId = (user as AuthorizedUser).branchId;
        let appType = (user as AuthorizedUser).appType;

        // If these are missing (e.g. Google OAuth login), fetch them from the database
        if (!role || !tenantId) {
          try {
            const prisma = (await import('./db')).default;
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { role: true, tenantId: true, branchId: true, appType: true }
            });
            if (dbUser) {
              role = dbUser.role;
              tenantId = dbUser.tenantId;
              branchId = dbUser.branchId;
              appType = dbUser.appType;
            }
          } catch (e) {
            console.error('[AUTH_JWT_DB_LOOKUP_ERROR]', e);
          }
        }

        token.role = role;
        token.tenantId = tenantId;
        token.branchId = branchId;
        token.appType = appType;
        
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

        // Issue a v1 API token when the user first signs in
        const { issueMobileToken } = await import('@/lib/api/v1-auth');
        const apiToken = await issueMobileToken({
          userId: user.id as string,
          tenantId: tenantId as string,
          branchId: branchId ?? null,
          role: role as string,
          appType: appType || 'microlending',
        });
        token.apiToken = apiToken;
        // Track expiry so the refresh block below keeps it alive. Without this
        // the apiToken (1h TTL) silently expires and every serverFetch 401s.
        token.apiTokenExp = Date.now() + 15 * 60 * 1000;
      }

      // Dynamic healing: If the token is already issued but missing role/tenantId,
      // lookup and heal the token dynamically on the fly.
      if (token.userId && (!token.role || !token.tenantId)) {
        try {
          const prisma = (await import('./db')).default;
          const dbUser = await prisma.user.findUnique({
            where: { id: token.userId },
            select: { role: true, tenantId: true, branchId: true, appType: true }
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.tenantId = dbUser.tenantId;
            token.branchId = dbUser.branchId;
            token.appType = dbUser.appType;
            
            // Also issue a new apiToken
            const { issueMobileToken } = await import('@/lib/api/v1-auth');
            const apiToken = await issueMobileToken({
              userId: token.userId,
              tenantId: dbUser.tenantId,
              branchId: dbUser.branchId ?? null,
              role: dbUser.role,
              appType: dbUser.appType || 'microlending',
            });
            token.apiToken = apiToken;
            token.apiTokenExp = Date.now() + 15 * 60 * 1000;
          }
        } catch (e) {
          console.error('[AUTH_JWT_HEAL_ERROR]', e);
        }
      }

      // Refresh if the expiry marker is missing (heals older sessions whose
      // apiToken already expired) or we're within 2 minutes of expiry.
      if (token.apiToken && (!token.apiTokenExp || Date.now() > (token.apiTokenExp as number) - 2 * 60 * 1000)) {
        try {
          const { issueMobileToken } = await import('@/lib/api/v1-auth');
          const apiToken = await issueMobileToken({
            userId: token.userId,
            tenantId: token.tenantId,
            branchId: token.branchId ?? null,
            role: token.role,
            appType: token.appType || 'microlending',
          });
          token.apiToken = apiToken;
          token.apiTokenExp = Date.now() + 15 * 60 * 1000;
        } catch (e) {
          console.error('[AUTH_TOKEN_REFRESH_ERROR]', e);
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
              isPrimaryAdmin: true,
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
                      tenant: { select: { slug: true, name: true } }
                    },
                  });
                  if (targetUser) {
                    // Show the ACCOUNT/business name (e.g. "Jeyam Finance"), not the owner.
                    monitorTargetName = (targetUser.tenant as any)?.name || targetUser.name || targetUser.username;
                    dbUser = targetUser as any; // Override dbUser with targetUser data
                    isMonitoring = true;
                  }
                }
              }
            } catch (e) {
              console.error('[MONITOR_ERROR] Failed to verify monitor token:', e);
            }
          }

          // Re-assert non-null: the monitor block above performs awaits and may
          // reassign dbUser, which loses the earlier narrowing.
          if (!dbUser) return null;
          (session.user as any).role = dbUser.role;
          (session.user as any).isPrimaryAdmin = dbUser.isPrimaryAdmin;
          (session.user as any).appType = dbUser.appType;
          (session.user as any).branchId = dbUser.branchId;
          (session.user as any).tenantId = dbUser.tenantId;
          (session.user as any).phone = dbUser.phone;
          (session.user as any).username = dbUser.username;
          (session.user as any).tenantSlug = dbUser.tenant?.slug || null;
          (session.user as any).isMonitoring = isMonitoring;
          (session.user as any).monitorTargetName = monitorTargetName;

          // Expose the API token in the session object
          session.apiToken = token.apiToken;
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
          ? ((process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.APP_ROOT_DOMAIN) ? `.${(process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.APP_ROOT_DOMAIN)!.split(':')[0]}` : undefined)
          : (process.env.NEXT_PUBLIC_ROOT_DOMAIN && process.env.NEXT_PUBLIC_ROOT_DOMAIN.includes('lvh.me') ? '.lvh.me' : undefined),
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        // The Secure flag must track the actual serving scheme, not the build
        // mode: a production build served over plain HTTP (e.g. an IP-only VPS
        // before SSL) must NOT set Secure, or the browser drops the cookie and
        // login never persists. Derives from the configured public URL, so it
        // auto-enables once APP_URL/NEXT_PUBLIC_APP_URL is https://.
        secure: (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').startsWith('https://'),
      },
    },
  },
});
