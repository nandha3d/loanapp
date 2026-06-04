import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { writeAudit } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role !== 'superadmin' && ctx.role !== 'admin') {
    return fail('Forbidden: Only admins can reset passwords.', 403);
  }

  const { id: customerId } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: ctx.tenantId }
  });

  if (!customer) return fail('Customer not found', 404);

  try {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        passwordHash: null,
      },
    });

    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'reset_borrower_password',
      entityType: 'customer',
      entityId: customerId,
      newValue: { action: 'password_reset_to_null' }
    });

    return ok({ success: true });
  } catch (err: any) {
    console.error('[/api/v1/customers/[id]/reset-password POST]', err);
    return fail(err?.message ?? 'Failed to reset password', 500);
  }
}
