import { NextRequest } from 'next/server';
import { resolveActor } from '@/lib/api/dualAuth';
import { ok, fail } from '@/lib/api/v1-envelope';
import { getReportDefinitionForAppType } from '@/lib/reports/catalog';
import { getSetting } from '@/lib/tenant';
import { getDictionarySync } from '@/lib/i18n';
import { getReportLabel } from '@/lib/reports/types';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import type { AppType } from '@/lib/appConfig';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const context = await resolveActor(req);
    if (!context) return fail('Unauthorized', 401);
    if (!['admin', 'superadmin', 'developer'].includes(context.role)) return fail('Forbidden', 403);

    const { slug } = await params;

    const { searchParams } = new URL(req.url);

    const requestedAppType = searchParams.get('appType');
    if (requestedAppType && requestedAppType !== context.appType) return fail('Report not found', 404);
    const requestedBranchId = searchParams.get('branchId');
    if (context.branchId && requestedBranchId && requestedBranchId !== context.branchId) {
      return fail('Report not found', 404);
    }
    const effectiveAppType = context.appType;

    const definition = getReportDefinitionForAppType(effectiveAppType as AppType, slug);

    if (!definition) {
      return fail(`Report builder for slug '${slug}' not found`, 404);
    }
    if (definition.addon === 'premium_accounting' && !(await isPremiumAccountingEnabled(context.tenantId))) {
      return fail('Premium accounting subscription required', 403);
    }

    const defaultFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const defaultTo = new Date().toISOString().slice(0, 10);

    const from = searchParams.get('from') || defaultFrom;
    const to = searchParams.get('to') || defaultTo;
    const branchId = context.branchId || requestedBranchId;
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

    const dict = getDictionarySync(searchParams.get('lang') || 'en');
    payload.title = getReportLabel(payload.title, dict);
    payload.columns = payload.columns.map((column) => ({ ...column, label: getReportLabel(column.label, dict) }));
    payload.kpis = payload.kpis?.map((kpi) => ({ ...kpi, label: getReportLabel(kpi.label, dict) }));

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
