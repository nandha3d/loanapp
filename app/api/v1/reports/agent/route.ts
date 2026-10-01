import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { buildAgentPerformance } from '@/lib/reports/builders/agent-performance';

/**
 * RPT-01: agent performance = the catalog builder the web report uses
 * (lib/reports/builders/agent-performance.ts), reshaped for the mobile list.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role === 'agent') {
    return fail('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const day = (d: Date) => d.toISOString().split('T')[0];
  const from = searchParams.get('from') ?? day(new Date(Date.now() - 30 * 86400000));
  const to = searchParams.get('to') ?? day(new Date());
  const agentId = searchParams.get('agentId') ?? undefined;

  try {
    const report = await buildAgentPerformance({
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      from,
      to,
      branchId: ctx.branchId,
      agentId,
    });
    const rows = report.rows as Array<Record<string, any>>;
    return ok({
      from,
      to,
      agents: rows.map((r) => ({
        agentId: r.agentId,
        name: r.agentName,
        expected: Number(r.expected ?? 0),
        collected: Number(r.collected ?? 0),
        entryCount: Number(r.visits ?? 0),
        hitRate: Number(r.recovery ?? 0),
      })),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Report failed', 500);
  }
}
