import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { PremiumAccountingServiceError } from '@/lib/accounting/premiumMobileService';
import {
  addBudgetLine,
  getBudget,
  getBudgetVariance,
  setBudgetStatus,
  updateBudgetLine,
} from '@/lib/accounting/budgets';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const budget = await getBudget(auth.context, id);
    const periodKey = req.nextUrl.searchParams.get('periodKey');
    return ok({ budget, variance: periodKey ? await getBudgetVariance(auth.context, id, periodKey) : null });
  } catch (error) {
    return fail(message(error), status(error));
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.action === 'add_line') return ok(await addBudgetLine(auth.context, id, body.accountId));
    if (body.action === 'approve' || body.action === 'archive') {
      return ok(await setBudgetStatus(auth.context, id, body.action));
    }
    return fail('Invalid action', 400);
  } catch (error) {
    return fail(message(error), status(error));
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const body = await req.json();
    return ok(await updateBudgetLine(auth.context, body.lineId, body.field, body.value, id));
  } catch (error) {
    return fail(message(error), status(error));
  }
}

function status(error: unknown) {
  return error instanceof PremiumAccountingServiceError ? error.status : 500;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Budget action failed';
}
