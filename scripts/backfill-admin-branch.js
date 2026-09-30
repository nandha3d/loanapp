#!/usr/bin/env node
/**
 * Stamp `User.branchId` on admins that have none.
 *
 * An unbranched admin used to resolve to "All Branches" and read every branch
 * of the tenant (SCOPE-4). `getActiveBranchId()` / `resolveScopeBranchId()` now
 * fail closed for them when the tenant has more than one active branch, so run
 * this first to give each one a home:
 *
 *   1. the admin's only `UserBranchModule` branch, else
 *   2. the tenant's only active branch.
 *
 * Anyone left (several candidate branches) is reported, not guessed — assign
 * them in Admin → Users.
 *
 * Usage (PowerShell):
 *   $env:TENANT='samurai-ml-af-cf'    # optional; omit to sweep every tenant
 *   $env:DRY_RUN='1'; node scripts/backfill-admin-branch.js
 *   # review the report, then re-run without DRY_RUN to write
 */
let PrismaClient;
try { ({ PrismaClient } = require('@prisma/client')); }
catch { ({ PrismaClient } = require('../prisma/generated-client')); }
const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === '1';

async function resolveTenantIds(ref) {
  if (!ref) return prisma.tenant.findMany({ select: { id: true, name: true, slug: true } });
  const t = await prisma.tenant.findFirst({
    where: { OR: [{ id: ref }, { slug: ref }, { customDomain: ref }] },
    select: { id: true, name: true, slug: true },
  });
  if (!t) throw new Error(`No tenant matches "${ref}".`);
  return [t];
}

async function main() {
  const tenants = await resolveTenantIds((process.env.TENANT || '').trim());
  console.log(`mode ${DRY_RUN ? 'DRY RUN — nothing is written' : 'APPLY'}`);
  let fixed = 0, stuck = 0;

  for (const tenant of tenants) {
    const admins = await prisma.user.findMany({
      where: { tenantId: tenant.id, role: 'admin', branchId: null },
      select: { id: true, name: true, username: true },
    });
    if (admins.length === 0) continue;

    const branches = await prisma.branch.findMany({
      where: { tenantId: tenant.id, status: 'active', deletedAt: null },
      select: { id: true, name: true },
    });
    const branchName = new Map(branches.map((b) => [b.id, b.name]));
    console.log(`\n${tenant.name} (${tenant.slug}): ${admins.length} unbranched admin(s), ${branches.length} active branch(es)`);

    for (const admin of admins) {
      const links = await prisma.userBranchModule.findMany({
        where: { userId: admin.id, branchId: { in: branches.map((b) => b.id) } },
        select: { branchId: true },
      });
      const target = links.length === 1 ? links[0].branchId
        : branches.length === 1 ? branches[0].id
        : null;

      if (!target) {
        stuck++;
        console.log(`  STUCK ${admin.username} (${admin.name}) — ${links.length} linked branch(es); assign in Admin → Users`);
        continue;
      }
      fixed++;
      console.log(`  ${admin.username} (${admin.name}) → ${branchName.get(target)}`);
      if (!DRY_RUN) {
        await prisma.user.update({ where: { id: admin.id }, data: { branchId: target } });
      }
    }
  }
  console.log(`\n${DRY_RUN ? 'would fix' : 'fixed'} ${fixed}, stuck ${stuck}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
