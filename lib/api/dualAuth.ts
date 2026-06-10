import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireMobileContext } from '@/lib/api/v1-auth';

export type ApiActor = {
  tenantId: string;
  userId: string;
  role: string;
  branchId: string | null;
  appType: string;
};

/**
 * Resolve the acting user from EITHER a mobile JWT (`Authorization: Bearer`)
 * OR a web NextAuth session cookie. Returns null when neither is valid.
 *
 * A present-but-invalid Bearer token does NOT fall through to web auth —
 * an explicit credential that fails must be rejected, not silently ignored.
 */
export async function resolveActor(req: NextRequest): Promise<ApiActor | null> {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    const mobileAuth = await requireMobileContext(req);
    if (mobileAuth.response) return null;
    const ctx = mobileAuth.context;
    return {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      role: ctx.role,
      branchId: ctx.branchId,
      appType: ctx.appType,
    };
  }

  const session = await auth();
  const user = session?.user as
    | { id?: string | null; tenantId?: string | null; role?: string | null; branchId?: string | null; appType?: string | null }
    | undefined;
  if (!user?.id || !user.tenantId || !user.role) return null;
  return {
    tenantId: user.tenantId,
    userId: user.id,
    role: user.role,
    branchId: user.branchId ?? null,
    appType: user.appType ?? 'microlending',
  };
}
