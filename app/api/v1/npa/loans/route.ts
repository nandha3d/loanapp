import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { listNpaLoans, NpaServiceError } from '@/lib/npa/npaService';

function errorStatus(error: unknown): number {
  return error instanceof NpaServiceError ? error.status : 500;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'NPA loans failed';
}

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const { searchParams } = new URL(req.url);
    const result = await listNpaLoans({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      role: ctx.role,
      branchId: ctx.branchId,
      appType: ctx.appType,
    }, {
      category: searchParams.get('category'),
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize') ?? searchParams.get('limit'),
    });
    return ok(result.data, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (error) {
    return fail(errorMessage(error), errorStatus(error));
  }
}
