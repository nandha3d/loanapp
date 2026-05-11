import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import prisma from './db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: credentials.username as string },
              { phone: credentials.username as string },
            ],
            status: 'active',
          },
          include: { tenant: true, branch: true },
        });

        if (!user) return null;

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
        token.role = (user as any).role;
        token.appType = (user as any).appType;
        token.tenantId = (user as any).tenantId;
        token.branchId = (user as any).branchId;
        token.phone = (user as any).phone;
        token.username = (user as any).username;
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
