import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { setSetting } from '@/lib/tenant';
import {
  APP_LOCK_ENABLED_KEY,
  APP_LOCK_TIMEOUT_KEY,
  APP_LOCK_TIMEOUT_OPTIONS,
  getAppLockPolicy,
} from '@/lib/appLock';

const READ_ROLES = new Set(['admin', 'superadmin', 'developer']);
// The lock is a tenant-wide security policy: the tenant owner decides it.
const WRITE_ROLES = new Set(['superadmin', 'developer']);

/** GET /api/v1/settings/security — the tenant app-lock policy and its choices. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!READ_ROLES.has(ctx.role)) return fail('Forbidden', 403);

  try {
    return ok({ ...(await getAppLockPolicy(ctx.tenantId)), canEdit: WRITE_ROLES.has(ctx.role) });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load security settings', 500);
  }
}

/** POST /api/v1/settings/security — { biometricLockRequired?, timeoutMinutes? } */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!WRITE_ROLES.has(ctx.role)) return fail('Only the account owner can change the app lock', 403);

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Invalid request body', 400);

    const changed: string[] = [];
    if (body.biometricLockRequired !== undefined) {
      if (typeof body.biometricLockRequired !== 'boolean') return fail('biometricLockRequired must be true or false', 400);
      await setSetting(ctx.tenantId, APP_LOCK_ENABLED_KEY, String(body.biometricLockRequired), 'security');
      changed.push(APP_LOCK_ENABLED_KEY);
    }
    if (body.timeoutMinutes !== undefined) {
      if (!(APP_LOCK_TIMEOUT_OPTIONS as readonly number[]).includes(body.timeoutMinutes)) {
        return fail(`timeoutMinutes must be one of ${APP_LOCK_TIMEOUT_OPTIONS.join(', ')}`, 400);
      }
      await setSetting(ctx.tenantId, APP_LOCK_TIMEOUT_KEY, String(body.timeoutMinutes), 'security');
      changed.push(APP_LOCK_TIMEOUT_KEY);
    }
    if (changed.length === 0) return fail('No settings provided', 400);

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'settings',
        newValue: JSON.stringify({ keys: changed }),
      },
    });

    return ok({ ...(await getAppLockPolicy(ctx.tenantId)), canEdit: true });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to save security settings', 500);
  }
}
