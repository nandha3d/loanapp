import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import prisma from './db';
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
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.username || !credentials?.password) return null;
        const username = String(credentials.username).trim().toLowerCase();

        // ── Distributed rate limiting (MySQL-backed) ─────────────────────────
        // Check both per-IP and per-username limits independently.
        // Per-username: prevents brute-force against a specific account.
        // Per-IP: prevents a single machine from cycling through usernames.
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

        const isValid = await compare(credentials.password as string, user.passwordHash);
        if (!isValid) return null;

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
        };
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
    maxAge: 24 * 60 * 60, // 24 hours
  },
});
