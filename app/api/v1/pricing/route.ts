import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { withStandardVerticalBases } from '@/lib/pricing';
import { parseFeatureKeys } from '@/lib/planFeatures';

export const dynamic = 'force-dynamic';

// Add-ons are bundled into plans (lib/planFeatures.ts) and no longer sold, so the
// catalog is always empty; the key stays so older clients keep parsing.

export async function GET() {
  try {
    const [plans, modules] = await Promise.all([
      prisma.subscriptionPlanCatalog.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.modulePriceCatalog.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      })
    ]);

    const formattedPlans = plans.map(p => ({
      ...p,
      features: JSON.parse(p.features),
      // Feature keys the plan bundles (lib/planFeatures.ts), as an array for clients.
      includedFeatures: parseFeatureKeys(p.includedFeatures),
    }));

    return ok({
      plans: formattedPlans,
      modules: withStandardVerticalBases(modules),
      addons: [] as never[]
    });
  } catch (err: any) {
    console.error('[PRICING_API_ERROR_V1]', err);
    return fail('Failed to fetch pricing catalog', 500);
  }
}
