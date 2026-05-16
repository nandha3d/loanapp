import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import prisma from './db';
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

  if (rootDomain) {
    if (hostname === rootDomain) return null;
    if (hostname.endsWith(`.${rootDomain}`)) {
      slug = hostname.slice(0, -(rootDomain.length + 1)).split('.')[0] || null;
    } else {
      return null;
    }
  } else {
    const labels = hostname.split('.');
    slug = labels.length > 2 ? labels[0] : null;
  }

  if (!slug) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  return tenant?.status === 'active' ? tenant.id : null;
}


export const { handlers, signIn, signOut, auth } = NextAuth({
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
          const [ipLimit, userLimit] = await Promise.all([
            checkRateLimit(loginIpKey(ip), { limit: LOGIN_IP_MAX, windowMs: LOGIN_WINDOW_MS }),
            checkRateLimit(loginUserKey(username), { limit: LOGIN_MAX_ATTEMPTS, windowMs: LOGIN_WINDOW_MS }),
          ]);
          if (!ipLimit.allowed || !userLimit.allowed) return null;
          // ─────────────────────────────────────────────────────────────────────

          // ── Tenant-scoped user lookup ─────────────────────────────────────────
          const host = (request as any)?.headers?.get?.('host') ?? null;
          const tenantIdFromHost = await resolveLoginTenantId(host);

          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { username },
                { phone: username },
              ],
              status: 'active',
              ...(tenantIdFromHost ? { tenantId: tenantIdFromHost } : {}),
            },
            include: { tenant: true, branch: true },
          });

          if (!user || user.tenant.status !== 'active') return null;

          if (!tenantIdFromHost && process.env.ALLOW_ROOT_DOMAIN_LOGIN === 'false') {
            return null; // Block login on root domain if disabled
          }

          const isValid = await compare(credentials.password as string, user.passwordHash);
          if (!isValid) return null;

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
          });

          // Audit log login event (fire-and-forget, non-blocking)
          prisma.auditLog.create({
            data: {
              tenantId: user.tenantId,
              userId: user.id,
              action: 'login',
              entityType: 'user',
              entityId: user.id,
            },
          }).catch(() => {});

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
        } catch (error) {
          // Log the actual error to the server console before NextAuth swallows it
          console.error('[AUTH_ERROR_DETAILS] Authorize failed:', error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authorizedUser = user as AuthorizedUser;
        token.role = authorizedUser.role;
        token.appType = authorizedUser.appType;
        token.tenantId = authorizedUser.tenantId;
        token.branchId = authorizedUser.branchId;
        token.phone = authorizedUser.phone;
        token.username = authorizedUser.username;
        token.userId = user.id;
        
        // Handle dynamic expiration based on Remember Me
        const rememberMe = (user as any).rememberMe;
        if (!rememberMe) {
          token.exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
        } else {
          token.exp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).role = token.role;
        (session.user as any).appType = token.appType;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).branchId = token.branchId;
        (session.user as any).phone = token.phone;
        (session.user as any).username = token.username;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days globally, overridden in jwt callback
  },
});
