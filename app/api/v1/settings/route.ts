import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { setSetting } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const settings = await prisma.appSetting.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
    return ok(settings);
  } catch (e: any) {
    return fail(e?.message ?? 'Settings failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const saved: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      await setSetting(ctx.tenantId, k, String(v), 'mobile');
      saved[k] = String(v);
    }

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'settings',
        newValue: JSON.stringify(saved),
      },
    });

    return ok(saved);
  } catch (e: any) {
    return fail(e?.message ?? 'Save failed', 500);
  }
}
