import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { CHIT_ENGINE_CATALOG, CHIT_ENGINE_TYPES } from '@/lib/chits/engineTypes';
import { getChitTypeSettings, saveChitTypeSettings } from '@/lib/chits/settings';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const settings = await getChitTypeSettings(ctx.tenantId);
    const catalog = CHIT_ENGINE_TYPES.map((code) => CHIT_ENGINE_CATALOG[code]);
    return ok({
      enabledTypes: settings.enabledTypes,
      typeDefaults: settings.typeDefaults,
      catalog,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load chit type settings', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const body = await req.json().catch(() => null) as any;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Invalid request body', 400);
  }

  try {
    const updated = await saveChitTypeSettings(ctx.tenantId, {
      enabledTypes: body.enabledTypes,
      typeDefaults: body.typeDefaults,
    });

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'settings',
        newValue: JSON.stringify({ category: 'chit_types', enabledTypes: updated.enabledTypes }),
      },
    });

    return ok({
      enabledTypes: updated.enabledTypes,
      typeDefaults: updated.typeDefaults,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to save chit type settings', 400);
  }
}
