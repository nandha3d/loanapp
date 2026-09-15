#!/usr/bin/env node
/**
 * Assign `LoanPackage.branchId` to packages created before the column existed.
 *
 * A null branch means "published tenant-wide" — every branch still sees the
 * package (`branchOrSharedWhere` in lib/branchScope.ts). That is the right
 * default for a tenant that runs one product catalogue. Run this only when a
 * tenant wants its catalogue split per branch.
 *
 * With one active branch the assignment is unambiguous and happens
 * automatically. With several, name the target explicitly — this script will
 * not guess which branch owns a shared product.
 *
 * Usage (PowerShell):
 *   $env:TENANT='samurai-ml-af-cf'
 *   $env:BRANCH='Head Office'        # required when the tenant has >1 branch
 *   $env:DRY_RUN='1'; node scripts/backfill-package-branch.js
 *   # review the report, then re-run without DRY_RUN to write
 *
 * Nothing is deleted and no package is duplicated: a package can belong to one
 * branch or to everyone, never to two branches at once. To give a second branch
 * the same product, create it there.
 */
let PrismaClient;
try { ({ PrismaClient } = require('@prisma/client')); }
catch { ({ PrismaClient } = require('../prisma/generated-client')); }
const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  const ref = (process.env.TENANT || '').trim();
  if (!ref) throw new Error('Set TENANT before running this script.');
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ id: ref }, { slug: ref }, { customDomain: ref }] },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) throw new Error(`No tenant matches "${ref}".`);

  const branches = await prisma.branch.findMany({
    where: { tenantId: tenant.id, status: 'active' },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
  if (branches.length === 0) throw new Error('Tenant has no active branch.');

  const branchRef = (process.env.BRANCH || '').trim();
  let target;
  if (branchRef) {
    target = branches.find((b) => b.id === branchRef || b.name === branchRef || b.code === branchRef);
    if (!target) throw new Error(`No active branch matches BRANCH="${branchRef}".`);
  } else if (branches.length === 1) {
    target = branches[0];
  } else {
    throw new Error(
      `Tenant has ${branches.length} active branches (${branches.map((b) => b.name).join(', ')}). ` +
        'Set BRANCH to the one that owns the existing packages.',
    );
  }

  const shared = await prisma.loanPackage.findMany({
    where: { tenantId: tenant.id, branchId: null },
    select: { id: true, name: true, appType: true, status: true },
    orderBy: { name: 'asc' },
  });

  console.log(`tenant  ${tenant.name} (${tenant.slug})`);
  console.log(`target  ${target.name} [${target.code}]`);
  console.log(`mode    ${DRY_RUN ? 'DRY RUN — nothing is written' : 'APPLY'}`);
  console.log(`\ntenant-wide packages to assign: ${shared.length}`);
  for (const p of shared) console.log(`  ${String(p.appType).padEnd(13)} ${String(p.status).padEnd(8)} ${p.name}`);

  if (DRY_RUN || shared.length === 0) {
    if (DRY_RUN) console.log('\nDRY RUN complete. Re-run without DRY_RUN=1 to write.');
    return;
  }

  const res = await prisma.loanPackage.updateMany({
    where: { tenantId: tenant.id, branchId: null },
    data: { branchId: target.id },
  });
  console.log(`\nwritten: ${res.count} package(s) now owned by ${target.name}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
