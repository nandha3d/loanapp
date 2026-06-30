import { NextRequest } from 'next/server';
import { requireApiContext, ADMIN_API_ROLES } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';
import { reportRegistry } from '@/lib/reports/registry';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if ('response' in authResult && authResult.response) return authResult.response;
    const context = 'context' in authResult ? authResult.context : (authResult as any);

    const { slug } = await params;
    const builder = reportRegistry[slug];

    if (!builder) {
      return apiError(`Report builder for slug '${slug}' not found`, 404);
    }

    const { searchParams } = new URL(req.url);

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

    const payload = await builder({
      tenantId: context.tenantId,
      appType: context.appType,
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
    });

    return apiSuccess(payload);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
