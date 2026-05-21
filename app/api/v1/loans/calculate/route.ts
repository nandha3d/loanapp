import { NextRequest } from 'next/server';
import { calculateLoanPreview } from '@/lib/loanCalculator';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const preview = calculateLoanPreview({
      principal: Number(body.principal ?? 0),
      interestType: String(body.interestType ?? 'upfront_fixed'),
      interestRate: Number(body.interestRate ?? 0),
      tenure: Number(body.tenure ?? 1),
      frequency: String(body.frequency ?? 'daily'),
      startDate: String(body.startDate ?? new Date().toISOString()),
      dueDay: body.dueDay ?? null,
    });
    return ok(preview);
  } catch (e: any) {
    return fail(e?.message ?? 'Calculation failed', 400);
  }
}
