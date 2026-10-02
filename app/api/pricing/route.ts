import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
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

    // Parse JSON string features field safely back into actual array objects for client
    const formattedPlans = plans.map(p => {
      let features: string[] = [];
      try {
        const parsed = typeof p.features === 'string' ? JSON.parse(p.features) : p.features;
        features = Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        features = [];
      }
      return {
        ...p,
        features,
        // Feature keys the plan bundles (lib/planFeatures.ts), as an array for clients.
        includedFeatures: parseFeatureKeys(p.includedFeatures),
      };
    });

    return NextResponse.json(
      {
        success: true,
        plans: formattedPlans,
        modules: withStandardVerticalBases(modules),
        addons: [] as never[]
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  } catch (err: any) {
    console.error('[PRICING_API_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pricing catalog' },
      { status: 500 }
    );
  }
}
