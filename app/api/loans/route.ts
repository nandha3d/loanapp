import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { getDefaultTenantId } from '@/lib/tenant';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return apiError('Unauthorized', 401);

    const tenantId = await getDefaultTenantId();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');

    const where: any = { tenantId };
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    const loans = await prisma.loan.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        instalments: {
          where: { dueDate: { lte: new Date() }, status: 'upcoming' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return apiSuccess(loans);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
