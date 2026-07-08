/**
 * Seed customer GPS locations clustered by route — so the mobile map / "sort by
 * nearest" / geofence features have realistic test data.
 *
 * Each route gets its own centre point spread around the operating town
 * (Gobichettipalayam, Erode, Tamil Nadu). Customers on that route are scattered
 * within ~1.5 km of their route centre, so a route reads as a tight cluster on
 * the map. Customers without a route cluster around the town centre.
 *
 * Idempotent-ish: re-running re-randomises jitter but keeps each customer near
 * their route. Pass `--only-missing` to only fill customers that have no lat/lng.
 *
 * Run:  npx tsx prisma/seed_locations.ts            (all customers)
 *       npx tsx prisma/seed_locations.ts --only-missing
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Town centre — Gobichettipalayam.
const BASE_LAT = 11.4564;
const BASE_LNG = 77.436;

// ~0.009° ≈ 1 km at this latitude. Routes are spread on a loose grid; customers
// jitter within ~1.5 km of their route centre.
const ROUTE_SPREAD_DEG = 0.025; // ~2.7 km between route centres
const CUSTOMER_JITTER_DEG = 0.013; // ~1.5 km cluster radius

function jitter(range: number): number {
  return (Math.random() * 2 - 1) * range;
}

// Deterministic-ish route centre from its index on a spiral grid around town.
function routeCentre(index: number): { lat: number; lng: number } {
  const ring = Math.floor(Math.sqrt(index));
  const angle = index * 2.399963; // golden-angle spread
  const radius = ring * ROUTE_SPREAD_DEG;
  return {
    lat: BASE_LAT + Math.sin(angle) * radius,
    lng: BASE_LNG + Math.cos(angle) * radius,
  };
}

async function main() {
  const onlyMissing = process.argv.includes('--only-missing');

  const routes = await prisma.route.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  const routeCentreById = new Map<string, { lat: number; lng: number }>();
  routes.forEach((r, i) => routeCentreById.set(r.id, routeCentre(i + 1)));

  const customers = await prisma.customer.findMany({
    where: onlyMissing ? { OR: [{ lat: null }, { lng: null }] } : {},
    select: { id: true, name: true, routeId: true },
  });

  let updated = 0;
  for (const c of customers) {
    const centre = (c.routeId && routeCentreById.get(c.routeId)) || { lat: BASE_LAT, lng: BASE_LNG };
    const lat = Number((centre.lat + jitter(CUSTOMER_JITTER_DEG)).toFixed(6));
    const lng = Number((centre.lng + jitter(CUSTOMER_JITTER_DEG)).toFixed(6));
    await prisma.customer.update({
      where: { id: c.id },
      data: { lat, lng, geocodedAt: new Date() },
    });
    updated++;
  }

  console.log(`Seeded GPS for ${updated} customer(s) across ${routes.length} route(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
