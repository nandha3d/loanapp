#!/usr/bin/env node
/**
 * Backfill Customer.branchId and Customer.agentId from the customer's route.
 *
 * Customer creation derives both from the ROUTE (`resolvedBranchId =
 * route.branchId ?? ctx.branchId`, `resolvedAgentId = route.assignedAgentId` in
 * app/api/v1/customers/route.ts). Customers filed before a route had a branch or
 * an agent — or imported — can end up on a route while carrying nulls.
 *
 * A null branch matters for visibility: a branch admin sees records on their own
 * branch and nothing else (lib/api/v1-auth.ts#scopedBranchWhere), so an
 * unbranched customer is visible to superadmins only. Broadcasting it to every
 * branch instead would share customers across branches, so the repair is here,
 * in the data.
 *
 * Only fills NULLs — never reassigns a customer that already has a branch or an
 * agent.
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
      routeId: { not: null },
      OR: [{ agentId: null }, { branchId: null }],
      ...(CUSTOMER_CODE ? { customerCode: CUSTOMER_CODE } : {}),
    },
    select: { id: true, customerCode: true, name: true, routeId: true, branchId: true, agentId: true },
    orderBy: { customerCode: 'asc' },
  });

  if (orphans.length === 0) {
    console.log('No customers on a route are missing a branch or an agent. Nothing to do.');
    return;
  }

  const routeIds = [...new Set(orphans.map((c) => c.routeId))];
  const routes = await prisma.route.findMany({
    where: { id: { in: routeIds }, tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      branchId: true,
      assignedAgentId: true,
      assignedAgent: { select: { name: true } },
      branch: { select: { name: true } },
    },
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

    // Fill only what is missing, and only from what the route actually knows.
    const data = {};
    const parts = [];
    if (!c.branchId && route.branchId) {
      data.branchId = route.branchId;
      parts.push(`branch ${route.branch?.name ?? route.branchId}`);
    }
    if (!c.agentId && route.assignedAgentId) {
      data.agentId = route.assignedAgentId;
      parts.push(`agent ${route.assignedAgent?.name ?? route.assignedAgentId}`);
    }

    if (parts.length === 0) {
      const missing = [!c.branchId && 'branch', !c.agentId && 'agent'].filter(Boolean).join(' and ');
      console.log(`  SKIP ${c.customerCode} ${c.name} — route "${route.name}" has no ${missing} to copy`);
      skipped++;
      continue;
    }

    console.log(
      `  ${DRY_RUN ? 'WOULD SET' : 'SET'} ${c.customerCode} ${c.name} -> ${parts.join(', ')} (route "${route.name}")`,
    );
    if (!DRY_RUN) {
      await prisma.customer.update({ where: { id: c.id }, data });
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
