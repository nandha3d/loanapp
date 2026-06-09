import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getNpaSummary, NpaServiceError } from '@/lib/npa/npaService';

function errorStatus(error: unknown): number {
  return error instanceof NpaServiceError ? error.status : 500;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'NPA summary failed';
}

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const { searchParams } = new URL(req.url);
    const data = await getNpaSummary({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      role: ctx.role,
      branchId: ctx.branchId,
      appType: ctx.appType,
    }, { asOfDate: searchParams.get('date') });
    return ok(data);
  } catch (error) {
    return fail(errorMessage(error), errorStatus(error));
  }
}
