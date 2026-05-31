import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';

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

    const formattedPlans = plans.map(p => ({
      ...p,
      features: JSON.parse(p.features)
    }));

    return ok({
      plans: formattedPlans,
      modules,
      addons
    });
  } catch (err: any) {
    console.error('[PRICING_API_ERROR_V1]', err);
    return fail('Failed to fetch pricing catalog', 500);
  }
}
