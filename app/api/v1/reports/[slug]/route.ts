import { NextRequest } from 'next/server';
import { resolveActor } from '@/lib/api/dualAuth';
import { ok, fail } from '@/lib/api/v1-envelope';
import { getReportDefinitionForAppType } from '@/lib/reports/catalog';
import { getSetting } from '@/lib/tenant';
import type { AppType } from '@/lib/appConfig';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const context = await resolveActor(req);
    if (!context) return fail('Unauthorized', 401);

    if (context.role === 'agent') {
      return fail('Forbidden', 403);
    }

    const { slug } = await params;
    const { searchParams } = new URL(req.url);

    const requestedAppType = searchParams.get('appType') || req.headers.get('x-app-type');
    const privileged = ['superadmin', 'developer', 'admin'].includes(context.role);
    const effectiveAppType = (requestedAppType && (privileged || requestedAppType === context.appType))
      ? requestedAppType
      : context.appType;

    const definition = getReportDefinitionForAppType(effectiveAppType as AppType, slug);

    if (!definition) {
      return fail(`Report builder for slug '${slug}' not found`, 404);
    }

    const defaultFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const defaultTo = new Date().toISOString().slice(0, 10);

    const from = searchParams.get('from') || defaultFrom;
    const to = searchParams.get('to') || defaultTo;
    const branchId = searchParams.get('branchId') || context.branchId;
    const agentId = searchParams.get('agentId') || undefined;
    const routeId = searchParams.get('routeId') || undefined;
    const customerId = searchParams.get('customerId') || undefined;
    const loanType = searchParams.get('loanType') || undefined;
    const status = searchParams.get('status') || undefined;
    const frequency = searchParams.get('frequency') || undefined;
    const minAmount = searchParams.get('minAmount') ? Number(searchParams.get('minAmount')) : undefined;
    const maxAmount = searchParams.get('maxAmount') ? Number(searchParams.get('maxAmount')) : undefined;
    const paymentMode = searchParams.get('paymentMode') || undefined;
    const paymentStatus = searchParams.get('paymentStatus') || undefined;
    const loanId = searchParams.get('loanId') || undefined;
    const groupId = searchParams.get('groupId') || undefined;

    const payload = await definition.builder({
      tenantId: context.tenantId,
      appType: effectiveAppType,
      from,
      to,
      branchId,
      agentId,
      routeId,
      customerId,
      loanType,
      status,
      frequency,
      minAmount,
      maxAmount,
      paymentMode,
      paymentStatus,
      loanId,
      groupId,
    });

    const currencySymbol = await getSetting(context.tenantId, 'currency_symbol', '₹');
    payload.meta = {
      ...(payload.meta || {}),
      from,
      to,
      currencySymbol: currencySymbol || payload.meta?.currencySymbol || '₹',
    };

    return ok(payload);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
