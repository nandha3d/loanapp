import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PricingClient from './PricingClient';

export default async function AdminPricingPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') redirect('/portal');

  const [plans, modules, addons] = await Promise.all([
    prisma.subscriptionPlanCatalog.findMany({
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.modulePriceCatalog.findMany({
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.addonCatalog.findMany({
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  // Format plans features from stringified JSON
  const formattedPlans = plans.map((p) => {
    let parsedFeatures: string[] = [];
    try {
      parsedFeatures = JSON.parse(p.features);
    } catch {
      parsedFeatures = [];
    }
    return {
      ...p,
      features: parsedFeatures,
    };
  });

  return (
    <PricingClient
      initialPlans={formattedPlans}
      initialModules={modules}
      initialAddons={addons}
    />
  );
}
