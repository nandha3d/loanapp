import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  listPremiumBudgets,
  PremiumAccountingServiceError,
} from '@/lib/accounting/premiumMobileService';
import { createBudget } from '@/lib/accounting/budgets';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    return ok(await listPremiumBudgets(auth.context, {
      periodKey: searchParams.get('periodKey'),
    }));
  } catch (error) {
    return fail(message(error, 'Budget failed'), status(error));
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const body = await req.json();
    return ok(await createBudget(auth.context, {
      name: body.name,
      fiscalYear: body.fiscalYear,
    }));
  } catch (error) {
    return fail(message(error, 'Budget creation failed'), status(error));
  }
}

function status(error: unknown) {
  return error instanceof PremiumAccountingServiceError ? error.status : 500;
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
