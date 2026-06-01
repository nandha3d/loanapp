import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import { SignJWT, importJWK } from 'jose';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (role !== 'developer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { superadminId } = body;

  if (!superadminId) {
    return NextResponse.json({ error: 'superadminId is required' }, { status: 400 });
  }

  // Look up the target superadmin
  const targetUser = await prisma.user.findUnique({
    where: { id: superadminId },
    include: {
      tenant: { select: { slug: true, status: true } },
    },
  });

  if (!targetUser || targetUser.role !== 'superadmin') {
    return NextResponse.json({ error: 'Superadmin not found' }, { status: 404 });
  }

  if (targetUser.tenant.status !== 'active') {
    return NextResponse.json({ error: 'Tenant is not active' }, { status: 400 });
  }

  // Create a JWT token for the target superadmin (same structure as auth.ts jwt callback)
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const now = Math.floor(Date.now() / 1000);
  const encodedSecret = new TextEncoder().encode(secret);

  const token = await new SignJWT({
    userId: targetUser.id,
    role: targetUser.role,
    name: targetUser.name,
    email: targetUser.email || undefined,
    sub: targetUser.id,
    iat: now,
    exp: now + (24 * 60 * 60), // 24 hours
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 24 * 60 * 60)
    .sign(encodedSecret);

  // Set the session cookie
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

  let domain: string | undefined;
  if (isProduction && rootDomain) {
    domain = `.${rootDomain.split(':')[0]}`;
  } else if (rootDomain && rootDomain.includes('lvh.me')) {
    domain = '.lvh.me';
  }

  cookieStore.set('next-auth.session-token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 24 * 60 * 60,
    ...(domain ? { domain } : {}),
  });

  // Log the impersonation
  await prisma.auditLog.create({
    data: {
      tenantId: targetUser.tenantId,
      userId: (session?.user as any)?.id,
      action: 'impersonate',
      entityType: 'user',
      entityId: targetUser.id,
      newValue: JSON.stringify({
        impersonatedUser: targetUser.username,
        impersonatedRole: targetUser.role,
        developerId: (session?.user as any)?.id,
      }),
    },
  }).catch((e) => console.error('[IMPERSONATE] Audit log failed:', e));

  // Build redirect URL
  let redirectUrl = '/portal';
  if (targetUser.tenant.slug && targetUser.tenant.slug !== 'default') {
    const host = request.headers.get('host') || '';
    const hostname = host.split(':')[0];
    const rootHost = (rootDomain || '').split(':')[0];
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const supportsSubdomains = rootDomain && !rootDomain.includes('localhost');

    if (supportsSubdomains && !isLocalhost) {
      const protocol = isProduction ? 'https' : 'http';
      const port = host.split(':')[1] ? `:${host.split(':')[1]}` : '';
      redirectUrl = `${protocol}://${targetUser.tenant.slug}.${rootHost}${port}/portal`;
    }
  }

  return NextResponse.json({
    success: true,
    redirectUrl,
    tenantSlug: targetUser.tenant.slug,
    userName: targetUser.name,
  });
}
