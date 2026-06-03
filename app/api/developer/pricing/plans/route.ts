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
      trialDays = 0,
      isActive = true,
      sortOrder = 0
    } = body;

    if (!plan || !displayName || monthlyPrice === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Build base data without trialDays first; add it only if the Prisma
    // client knows about the column (guard against stale generated client).
    const planData: Record<string, unknown> = {
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
      sortOrder: Number(sortOrder),
    };

    // trialDays was added in migration 20260603000000. After `prisma generate`
    // runs, the client will accept this field. Until then, set it via raw SQL
    // so the rest of the update still succeeds.
    const trialDaysNum = Number(trialDays ?? 0);

    if (id) {
      let updated: any;
      try {
        updated = await prisma.subscriptionPlanCatalog.update({
          where: { id },
          data: { ...planData, trialDays: trialDaysNum } as any,
        });
      } catch (e: any) {
        if (e?.message?.includes('trialDays')) {
          // Prisma client stale — update without trialDays then patch via raw.
          updated = await prisma.subscriptionPlanCatalog.update({ where: { id }, data: planData as any });
          await prisma.$executeRawUnsafe(
            'UPDATE subscription_plan_catalogs SET trial_days = ? WHERE id = ?',
            trialDaysNum, id,
          );
          updated.trialDays = trialDaysNum;
        } else {
          throw e;
        }
      }
      return NextResponse.json({ success: true, plan: updated });
    } else {
      let created: any;
      try {
        created = await prisma.subscriptionPlanCatalog.create({
          data: { ...planData, trialDays: trialDaysNum } as any,
        });
      } catch (e: any) {
        if (e?.message?.includes('trialDays')) {
          created = await prisma.subscriptionPlanCatalog.create({ data: planData as any });
          await prisma.$executeRawUnsafe(
            'UPDATE subscription_plan_catalogs SET trial_days = ? WHERE id = ?',
            trialDaysNum, created.id,
          );
          created.trialDays = trialDaysNum;
        } else {
          throw e;
        }
      }
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
