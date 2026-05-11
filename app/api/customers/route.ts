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
    const q = searchParams.get('q');
    
    const where: any = { tenantId };
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { customerCode: { contains: q } }
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        route: { select: { name: true } },
        loans: {
          where: { status: 'active' },
          select: { id: true, principal: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return apiSuccess(customers);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
