import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  getIntegrationSettingsMasked,
  saveIntegrationSettings,
} from '@/lib/integrations/settings';

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'developer']);

/**
 * GET /api/v1/settings/integrations
 * Returns masked third-party add-on configuration for the tenant.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!ADMIN_ROLES.has(ctx.role)) return fail('Forbidden', 403);

  try {
    return ok(await getIntegrationSettingsMasked(ctx.tenantId));
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load integrations', 500);
  }
}

/**
 * POST /api/v1/settings/integrations
 * Saves add-on connection settings. Secret fields are write-only: omit or send
 * blank values to keep the currently stored secret.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!ADMIN_ROLES.has(ctx.role)) return fail('Forbidden', 403);

  try {
    const body = await req.json();
    const saved = await saveIntegrationSettings(ctx.tenantId, body);
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'integration_settings',
        newValue: JSON.stringify({
          sections: Object.keys(body).filter((key) => body[key] !== undefined),
        }),
      },
    });
    return ok(saved);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to save integrations', 500);
  }
}
