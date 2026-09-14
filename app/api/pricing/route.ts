import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withStandardVerticalBases } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [plans, modules, addons] = await Promise.all([
      prisma.subscriptionPlanCatalog.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.modulePriceCatalog.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.addonCatalog.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      })
    ]);

    // Parse JSON string features field back into actual array objects for client
    const formattedPlans = plans.map(p => ({
      ...p,
      features: JSON.parse(p.features)
    }));

    return NextResponse.json(
      {
        success: true,
        plans: formattedPlans,
        modules: withStandardVerticalBases(modules),
        addons
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[PRICING_API_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pricing catalog' },
      { status: 500 }
    );
  }
}
