import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { setSetting } from '@/lib/tenant';
import { FEATURE_FLAG_KEYS } from '@/lib/features';
import { encryptField } from '@/lib/pii';
import { DEAD_KEYS, ROLE_RANK, SECRET_KEYS, SETTING_GROUPS, SETTING_KEY_MIN_ROLE } from '@/lib/settings/keyPolicy';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const rawSettings = await prisma.appSetting.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
    // Blank values of secret keys (matching web settings/page.tsx:74-78)
    const settings = rawSettings.map((s) => ({
      ...s,
      value: SECRET_KEYS.has(s.key) ? '' : s.value,
    }));
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail('Invalid request body', 400);
    }

    const entries = Object.entries(body);
    if (entries.length === 0) {
      return fail('No settings provided', 400);
    }

    const callerRank = ROLE_RANK[ctx.role] ?? 0;

    // Reject dead, unknown, or unauthorized keys before mutating anything
    for (const [key] of entries) {
      if (DEAD_KEYS.has(key)) {
        return fail(`Setting "${key}" is obsolete and cannot be modified`, 400);
      }
      const minRole = SETTING_KEY_MIN_ROLE[key];
      if (!minRole) {
        return fail(`Unknown setting key: "${key}"`, 400);
      }
      const requiredRank = ROLE_RANK[minRole] ?? 99;
      if (callerRank < requiredRank) {
        return fail(`Forbidden: "${key}" requires ${minRole} role or higher`, 403);
      }
    }

    const saved: Record<string, string> = {};
    for (const [k, v] of entries) {
      let val = String(v);
      if (SECRET_KEYS.has(k)) {
        val = encryptField(val.trim()) || '';
      }
      const group = (FEATURE_FLAG_KEYS as readonly string[]).includes(k)
        ? 'features'
        : (SETTING_GROUPS[k] || 'system');
      await setSetting(ctx.tenantId, k, val, group);
      saved[k] = SECRET_KEYS.has(k) ? '' : val;
    }

    // Audit: log the list of keys only, never raw values (SEC-08)
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'settings',
        newValue: JSON.stringify({ keys: Object.keys(saved) }),
      },
    });

    return ok(saved);
  } catch (e: any) {
    return fail(e?.message ?? 'Save failed', 500);
  }
}
