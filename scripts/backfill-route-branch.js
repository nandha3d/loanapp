#!/usr/bin/env node
/**
 * Backfill Route.branchId — the missing first link in the branch repair chain.
 *
 * scripts/backfill-customer-route-agent.js copies a branch from the ROUTE onto
 * the customer, so an unbranched route silently stops that repair dead: every
 * customer on it is skipped with "route has no branch to copy". Routes filed
 * before branches existed, or imported, carry a null branch and strand every
 * customer behind them. Run this FIRST, then the customer backfill.
 *
 * A null branch matters for visibility: a branch admin sees their own branch and
 * nothing else (lib/api/v1-auth.ts#scopedBranchWhere), so an unbranched record is
 * visible to superadmins only, and POST /api/v1/loans rejects the customer with
 * "Customer not found" even though the picker just listed them. Per SCOPE-4 the
 * repair belongs in the data, never in a widened where-clause.
 *
 * Branch resolution mirrors resolveWriteBranchId (SCOPE-7): an explicit
 * BRANCH_CODE wins; otherwise the tenant's only branch is used. A tenant with
 * several branches requires BRANCH_CODE — guessing which branch owns a route
 * would silently hand one branch's book to another.
 *
 * Only fills NULLs — never reassigns a route that already has a branch.
 *
 * Usage (PowerShell):
 *   $env:TENANT='samurai-ml-af-cf'   # slug, customDomain, or tenant id
 *   $env:DRY_RUN='1'; node scripts/backfill-route-branch.js
 *   # then re-run without DRY_RUN to write
 *
 * Optional: BRANCH_CODE=HQ pins the branch explicitly (required if the tenant
 * has more than one branch). ROUTE_NAME='erode' restricts the run to one route.
 */
let PrismaClient;
try { ({ PrismaClient } = require('@prisma/client')); }
catch { ({ PrismaClient } = require('../prisma/generated-client')); }
const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === '1';
const BRANCH_CODE = (process.env.BRANCH_CODE || '').trim();
const ROUTE_NAME = (process.env.ROUTE_NAME || '').trim();

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

async function resolveBranch(tenantId) {
  const branches = await prisma.branch.findMany({
    where: { tenantId },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });
  if (branches.length === 0) throw new Error('This tenant has no branches. Create one first (scripts/add-branch.js).');

  if (BRANCH_CODE) {
    const match = branches.find((b) => b.code.toLowerCase() === BRANCH_CODE.toLowerCase());
    if (!match) {
      throw new Error(`No branch "${BRANCH_CODE}". Available: ${branches.map((b) => b.code).join(', ')}`);
    }
    return match;
  }
  if (branches.length > 1) {
    throw new Error(
      `This tenant has ${branches.length} branches (${branches.map((b) => b.code).join(', ')}). ` +
        'Set BRANCH_CODE to say which one owns these routes — guessing would move a book of business.',
    );
  }
  return branches[0];
}

async function main() {
  const tenant = await resolveTenant((process.env.TENANT || '').trim());
  console.log(`Tenant : ${tenant.name} (${tenant.slug})`);
  console.log(DRY_RUN ? 'Mode   : DRY_RUN — nothing will be written\n' : 'Mode   : WRITE\n');

  const orphans = await prisma.route.findMany({
    where: {
      tenantId: tenant.id,
      branchId: null,
      ...(ROUTE_NAME ? { name: ROUTE_NAME } : {}),
    },
    select: { id: true, name: true, _count: { select: { customers: true } } },
    orderBy: { name: 'asc' },
  });

  if (orphans.length === 0) {
    console.log('No unbranched routes in this tenant. Nothing to do.');
    return;
  }

  const branch = await resolveBranch(tenant.id);
  console.log(`Branch : ${branch.code} (${branch.name})\n`);

  let fixed = 0;
  for (const r of orphans) {
    console.log(
      `  ${DRY_RUN ? 'WOULD SET' : 'SET'} route "${r.name}" -> branch ${branch.code}` +
        `  (${r._count.customers} customer${r._count.customers === 1 ? '' : 's'} behind it)`,
    );
    if (!DRY_RUN) {
      await prisma.route.update({ where: { id: r.id }, data: { branchId: branch.id } });
    }
    fixed++;
  }

  console.log(`\n${DRY_RUN ? 'Would update' : 'Updated'}: ${fixed} route(s)`);
  if (DRY_RUN) {
    console.log('DRY_RUN=1 — nothing written.');
  } else {
    console.log('Next: node scripts/backfill-customer-route-agent.js  (propagates the branch to customers)');
    console.log('Then: node scripts/backfill-loan-branch.js           (re-derives Loan.branchId from the customer)');
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
