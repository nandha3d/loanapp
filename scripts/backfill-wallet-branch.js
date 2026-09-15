#!/usr/bin/env node
/**
 * Stamp `WalletTransaction.branchId` on agent-side ledger rows written before
 * `applyAgent` in lib/wallet.ts started setting it.
 *
 * The wallet page filters agent movements by branch. An unbranched row matches
 * no branch, so a branch admin saw an empty agent ledger for their own agents
 * while the balances above it were non-zero. This fills the gap from the row's
 * own agent: a movement belongs to the branch that agent works on.
 *
 * Branch-kind rows are never touched — they already carry the branch of the
 * pool they moved, and guessing one would move money between branches' books.
 * Rows whose agent has no branch are left alone and reported.
 *
 * Usage (PowerShell):
 *   $env:TENANT='samurai-ml-af-cf'    # optional; omit to sweep every tenant
 *   $env:DRY_RUN='1'; node scripts/backfill-wallet-branch.js
 *   # review the report, then re-run without DRY_RUN to write
 */
let PrismaClient;
try { ({ PrismaClient } = require('@prisma/client')); }
catch { ({ PrismaClient } = require('../prisma/generated-client')); }
const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === '1';

async function resolveTenantIds(ref) {
  if (!ref) {
    const all = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true } });
    return all;
  }
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

  for (const tenant of tenants) {
    const rows = await prisma.walletTransaction.findMany({
      where: { tenantId: tenant.id, accountKind: 'agent', branchId: null, agentId: { not: null } },
      select: { id: true, agentId: true },
    });
    if (rows.length === 0) continue;

    const agentIds = Array.from(new Set(rows.map((r) => r.agentId)));
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, branchId: true },
    });
    const branchOf = new Map(agents.map((a) => [a.id, a.branchId]));

    const fixable = rows.filter((r) => branchOf.get(r.agentId));
    const stuck = rows.filter((r) => !branchOf.get(r.agentId));

    console.log(`\n=== ${tenant.name} (${tenant.slug}) ===`);
    console.log(`  unbranched agent rows: ${rows.length}`);
    console.log(`  fillable from agent:   ${fixable.length}`);
    if (stuck.length) {
      const names = Array.from(new Set(stuck.map((r) => agents.find((a) => a.id === r.agentId)?.name ?? r.agentId)));
      console.log(`  left alone (agent has no branch): ${stuck.length} -> ${names.join(', ')}`);
    }

    if (DRY_RUN || fixable.length === 0) continue;

    // Grouped by branch so this is a handful of updateMany calls, not one per row.
    const byBranch = new Map();
    for (const r of fixable) {
      const b = branchOf.get(r.agentId);
      if (!byBranch.has(b)) byBranch.set(b, []);
      byBranch.get(b).push(r.id);
    }
    let written = 0;
    for (const [branchId, ids] of byBranch) {
      const res = await prisma.walletTransaction.updateMany({
        where: { id: { in: ids } },
        data: { branchId },
      });
      written += res.count;
    }
    console.log(`  written: ${written}`);
  }

  if (DRY_RUN) console.log('\nDRY RUN complete. Re-run without DRY_RUN=1 to write.');
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
