/**
 * Backfill: seed branch cash pools from cash capital that was never mirrored.
 *
 * Capital added before the accounting→pool sync existed (or via a path that
 * skipped it) left BranchCashAccount unseeded, so releasing float drove the pool
 * negative and `branch pool + agent float ≠ capital`. This replays the missing
 * `applyAccountingCashToBranch` for every cash capital_add / capital_withdraw
 * AccountEntry that has no matching branch wallet transaction.
 *
 * Idempotent: an entry that already has its branch wallet tx is skipped.
 *
 *   node scripts/backfill-branch-cash.cjs          # DRY RUN (prints, no writes)
 *   node scripts/backfill-branch-cash.cjs apply     # writes
 */
let PrismaClient;
try { ({ PrismaClient } = require('@prisma/client')); }
catch { ({ PrismaClient } = require('../prisma/generated-client')); }

const APPLY = process.argv[2] === 'apply';
const p = new PrismaClient();

(async () => {
  const tenants = await p.tenant.findMany({ select: { id: true, name: true } });
  let totalFixed = 0;

  for (const t of tenants) {
    const entries = await p.accountEntry.findMany({
      where: { tenantId: t.id, category: 'cash', type: { in: ['capital_add', 'capital_withdraw'] } },
      orderBy: { entryDate: 'asc' },
      select: { id: true, type: true, amount: true, branchId: true, description: true },
    });
    if (entries.length === 0) continue;

    const firstBranch = await p.branch.findFirst({
      where: { tenantId: t.id }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true },
    });

    for (const e of entries) {
      const already = await p.walletTransaction.findFirst({
        where: { tenantId: t.id, accountKind: 'branch', refType: 'account_entry', refId: e.id },
        select: { id: true },
      });
      if (already) continue;

      const branchId = e.branchId || firstBranch?.id;
      if (!branchId) { console.log(`  [skip] ${t.name}: entry ${e.id} has no branch and tenant has none`); continue; }

      const delta = e.type === 'capital_add' ? Number(e.amount) : -Number(e.amount);
      const txType = e.type === 'capital_add' ? 'inject' : 'adjustment';
      console.log(`  ${APPLY ? 'FIX ' : 'WOULD FIX'} ${t.name}: branch ${branchId} ${delta >= 0 ? '+' : ''}${delta} (entry ${e.id})`);
      totalFixed++;

      if (APPLY) {
        await p.$transaction(async (tx) => {
          const acct = await tx.branchCashAccount.upsert({
            where: { tenantId_branchId: { tenantId: t.id, branchId } },
            create: { tenantId: t.id, branchId, balance: 0 },
            update: {},
          });
          const next = Number(acct.balance) + delta;
          await tx.branchCashAccount.update({ where: { id: acct.id }, data: { balance: next } });
          await tx.walletTransaction.create({
            data: {
              tenantId: t.id, accountKind: 'branch', branchId,
              type: txType, amount: delta, balanceAfter: next,
              refType: 'account_entry', refId: e.id,
              note: e.description || 'Backfill: seed branch pool from cash capital',
            },
          });
        });
      }
    }
  }

  console.log(`\n${APPLY ? 'Applied' : 'Would apply'} ${totalFixed} pool corrections.`);
  if (!APPLY && totalFixed > 0) console.log('Re-run with:  node scripts/backfill-branch-cash.cjs apply');
  await p.$disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
