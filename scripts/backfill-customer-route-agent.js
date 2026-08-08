#!/usr/bin/env node
/**
 * Backfill Customer.agentId from the customer's route.
 *
 * Customer creation derives the collecting agent from the ROUTE
 * (`resolvedAgentId = route.assignedAgentId` in app/api/v1/customers/route.ts).
 * Customers filed before a route had an agent — or imported — can end up on a
 * route while carrying `agentId = null`.
 *
 * That orphan state matters for visibility: a branch admin reaches records on
 * their own branch, unbranched records, or records filed by staff on their
 * branch (lib/api/v1-auth.ts#scopedBranchReachWhere). A customer sitting on
 * ANOTHER branch with no agent matches none of those, so it is visible only to
 * superadmins.
 *
 * Only fills NULLs — never reassigns a customer that already has an agent.
 *
 * Usage (PowerShell):
 *   $env:TENANT='samurai-ml-af-cf'    # slug, customDomain, or tenant id
 *   $env:DRY_RUN='1'; node scripts/backfill-customer-route-agent.js
 *   # then re-run without DRY_RUN to write
 *
 * Optional: CUSTOMER_CODE=CUS0001 restricts the run to a single customer.
 */
let PrismaClient;
try { ({ PrismaClient } = require('@prisma/client')); }
catch { ({ PrismaClient } = require('../prisma/generated-client')); }
const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === '1';
const CUSTOMER_CODE = (process.env.CUSTOMER_CODE || '').trim();

async function resolveTenant(ref) {
  if (!ref) throw new Error('Set TENANT before running this script.');
  const byId = await prisma.tenant.findUnique({ where: { id: ref } }).catch(() => null);
  if (byId) return byId;
  const bySlug = await prisma.tenant.findUnique({ where: { slug: ref } }).catch(() => null);
  if (bySlug) return bySlug;
  const byDomain = await prisma.tenant
    .findUnique({ where: { customDomain: ref.toLowerCase() } })
    .catch(() => null);
  if (byDomain) return byDomain;
  throw new Error(`No tenant matches "${ref}" (tried id, slug, customDomain).`);
}

async function main() {
  const tenant = await resolveTenant((process.env.TENANT || '').trim());
  console.log(`Tenant : ${tenant.name} (${tenant.slug})`);
  console.log(DRY_RUN ? 'Mode   : DRY_RUN — nothing will be written\n' : 'Mode   : WRITE\n');

  const orphans = await prisma.customer.findMany({
    where: {
      tenantId: tenant.id,
      agentId: null,
      routeId: { not: null },
      ...(CUSTOMER_CODE ? { customerCode: CUSTOMER_CODE } : {}),
    },
    select: { id: true, customerCode: true, name: true, routeId: true, branchId: true },
    orderBy: { customerCode: 'asc' },
  });

  if (orphans.length === 0) {
    console.log('No customers on a route are missing an agent. Nothing to do.');
    return;
  }

  const routeIds = [...new Set(orphans.map((c) => c.routeId))];
  const routes = await prisma.route.findMany({
    where: { id: { in: routeIds }, tenantId: tenant.id },
    select: { id: true, name: true, assignedAgentId: true, assignedAgent: { select: { name: true } } },
  });
  const routeById = new Map(routes.map((r) => [r.id, r]));

  let fixed = 0;
  let skipped = 0;
  for (const c of orphans) {
    const route = routeById.get(c.routeId);
    if (!route) {
      console.log(`  SKIP ${c.customerCode} ${c.name} — route not found in this tenant`);
      skipped++;
      continue;
    }
    if (!route.assignedAgentId) {
      console.log(`  SKIP ${c.customerCode} ${c.name} — route "${route.name}" has no assigned agent`);
      skipped++;
      continue;
    }
    console.log(
      `  ${DRY_RUN ? 'WOULD SET' : 'SET'} ${c.customerCode} ${c.name} -> agent ${route.assignedAgent?.name} (route "${route.name}")`,
    );
    if (!DRY_RUN) {
      await prisma.customer.update({
        where: { id: c.id },
        data: { agentId: route.assignedAgentId },
      });
    }
    fixed++;
  }

  console.log(`\n${DRY_RUN ? 'Would update' : 'Updated'}: ${fixed}   Skipped: ${skipped}`);
  if (DRY_RUN) console.log('DRY_RUN=1 — nothing written.');
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
