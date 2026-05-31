import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireDeveloper() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function GET() {
  try {
    await requireDeveloper();
    const plans = await prisma.subscriptionPlanCatalog.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    
    const formattedPlans = plans.map(p => ({
      ...p,
      features: JSON.parse(p.features)
    }));

    return NextResponse.json({ success: true, plans: formattedPlans });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unauthorized' },
      { status: err.message === 'Unauthorized' ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireDeveloper();
    const body = await request.json();
    const {
      id,
      plan,
      displayName,
      description,
      monthlyPrice,
      maxBranches,
      maxAgents,
      maxActiveLoans,
      features = [],
      razorpayPlanId,
      isActive = true,
      sortOrder = 0
    } = body;

    if (!plan || !displayName || monthlyPrice === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const planData = {
      plan,
      displayName,
      description,
      monthlyPrice: Number(monthlyPrice),
      maxBranches: Number(maxBranches),
      maxAgents: Number(maxAgents),
      maxActiveLoans: Number(maxActiveLoans),
      features: JSON.stringify(features),
      razorpayPlanId: razorpayPlanId || null,
      isActive: Boolean(isActive),
      sortOrder: Number(sortOrder)
    };

    if (id) {
      const updated = await prisma.subscriptionPlanCatalog.update({
        where: { id },
        data: planData
      });
      return NextResponse.json({ success: true, plan: updated });
    } else {
      const created = await prisma.subscriptionPlanCatalog.create({
        data: planData
      });
      return NextResponse.json({ success: true, plan: created });
    }
  } catch (err: any) {
    console.error('[DEV_PLANS_POST_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save plan' },
      { status: err.message === 'Unauthorized' ? 403 : 500 }
    );
  }
}
