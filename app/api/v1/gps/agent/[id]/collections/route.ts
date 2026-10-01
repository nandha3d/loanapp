import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { gpsAgentWhere, gpsEntryWhere } from '@/lib/gps/routeProgress';
import { isGpsTrackingEnabled } from '@/lib/gps/locationVerifier';
import { startOfBusinessToday, startOfBusinessTomorrow } from '@/lib/businessTime';

/**
 * GET /api/v1/gps/agent/:id/collections
 * Today's collection entries for an agent — customer name, due, and collected
 * amount. Powers the table under the agent-tracking detail view. Admin only.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  if (!['admin', 'superadmin', 'developer'].includes(auth.context.role)) {
    return fail('Forbidden', 403);
  }
  if (!(await isGpsTrackingEnabled(auth.context.tenantId))) {
    return fail('GPS tracking not enabled', 403);
  }
  const { id } = await ctx.params;

  // Agent scope check (module + active branch) — foreign agent must be 404 (SCOPE-2/3/12/17.5, API-5).
  const targetAgent = await prisma.user.findFirst({
    where: { id, ...gpsAgentWhere(auth.context) },
    select: { id: true },
  });
  if (!targetAgent) return fail('Not found', 404);

  // Date range (inclusive `from`, exclusive `to`). Defaults to today.
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const todayStart = startOfBusinessToday();
  const todayEnd = startOfBusinessTomorrow();

  const from = fromParam ? new Date(fromParam) : todayStart;
  const submittedAt: { gte: Date; lt?: Date } = {
    gte: Number.isNaN(from.getTime()) ? todayStart : from,
  };
  if (toParam) {
    const to = new Date(toParam);
    if (!Number.isNaN(to.getTime())) submittedAt.lt = to;
  } else if (!fromParam) {
    submittedAt.lt = todayEnd;
  }

  try {
    const entries = await prisma.collectionEntry.findMany({
      where: {
        ...gpsEntryWhere(auth.context),
        agentId: id,
        submittedAt,
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        dueAmount: true,
        receivedAmount: true,
        paymentMode: true,
        submittedAt: true,
        lat: true,
        lng: true,
        locationStatus: true,
        customerId: true,
        customer: { select: { name: true, customerCode: true, profilePhoto: true } },
      },
    });

    return ok(
      entries.map((e) => ({
        id: e.id,
        customerId: e.customerId,
        customerName: e.customer?.name ?? '—',
        customerCode: e.customer?.customerCode ?? '',
        customerPhoto: e.customer?.profilePhoto ?? null,
        dueAmount: Number(e.dueAmount),
        receivedAmount: Number(e.receivedAmount),
        paymentMode: e.paymentMode,
        submittedAt: e.submittedAt,
        // Where the entry was collected — powers the photo pins on the
        // agent-tracking map.
        lat: e.lat,
        lng: e.lng,
        // RTE-01: verified / mismatch / not_captured, as on the web tracker.
        locationStatus: e.locationStatus,
      })),
    );
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to fetch agent collections', 500);
  }
}
