import { NextRequest } from 'next/server';
import { ok, fail, failWithData } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { ChitPlanLimitError } from '@/lib/chits/planEntitlements';
import {
  migrateRunningChit,
  validateRunningChitMigration,
  type MigrateRunningChitInput,
} from '@/lib/chits/migrateRunningChit';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const body = (await req.json().catch(() => null)) as MigrateRunningChitInput | null;
  if (!body || typeof body !== 'object') {
    return fail('Invalid migration payload', 400);
  }

  const dryRunParam = new URL(req.url).searchParams.get('dryRun') === '1';
  if (dryRunParam) {
    const summary = validateRunningChitMigration(body);
    return ok(summary);
  }

  try {
    const res = await migrateRunningChit(
      {
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        branchId: ctx.branchId ?? null,
        userId: ctx.userId,
      },
      body,
    );
    return ok(res);
  } catch (e: any) {
    if (e instanceof ChitPlanLimitError) {
      return failWithData(e.message, 402, {
        code: e.code,
        activeCount: e.activeCount,
        maxActiveChitGroups: e.maxActiveChitGroups,
      });
    }
    return fail(e?.message ?? 'Mid-cycle chit migration failed', 400);
  }
}
