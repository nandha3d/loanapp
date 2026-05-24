import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { hash } from 'bcryptjs';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { name, email, phone, password } = body as Record<string, string>;

    if (!name?.trim()) return fail('Name required', 400);
    if (!email?.trim()) return fail('Email required', 400);
    if (!phone?.trim()) return fail('Phone required', 400);
    if (!password || password.length < 6)
      return fail('Password must be at least 6 characters', 400);

    const passwordHash = await hash(password, 12);
    const agent = await prisma.user.create({
      data: {
        tenantId: ctx.tenantId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        username: email.trim().toLowerCase(),
        passwordHash,
        role: 'agent',
        appType: ctx.appType,
        status: 'active',
      },
      select: { id: true, name: true, email: true, phone: true },
    });

    return ok(agent);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const target = (e?.meta?.target as string[]) ?? [];
      if (target.includes('username') || target.includes('email'))
        return fail('Email already in use', 409);
      if (target.includes('phone')) return fail('Phone already in use', 409);
    }
    return fail(e?.message ?? 'Agent create failed', 500);
  }
}
