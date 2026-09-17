#!/usr/bin/env node
/**
 * Move a branch's OPERATIONAL data onto another branch of the same tenant.
 *
 * Written for the case where a branch was created, worked for a while, and then
 * the tenant decided that book belongs to another branch after all. Reads are
 * scoped to a record's own `branchId` (lib/branchScope.ts) and an admin cannot
 * switch branches, so records left on the wrong branch are invisible to the
 * admin who is supposed to approve them — the notification arrives, the
 * approvals queue is empty. Re-stamping the rows is the repair.
 *
 * WHAT MOVES (operational rows — who works the book):
 *   Route, Customer, SystemNotification, DailyCollection
 *   plus a derived repair: Loan.branchId := its customer's branch,
 *                          DailyCollection.branchId := its route's branch.
 *
 * WHAT NEVER MOVES (the branch's own identity and its money):
 *   BranchCashAccount, WalletTransaction, AccountEntry — a branch's cash pool is
 *     physical cash in a physical office. Merging two pools is a money decision,
 *     not a data repair; do it deliberately through the wallet, not here.
 *   User            — staff posting is an admin decision, not a side effect.
 *   SuperadminBranch, UserBranchModule — access grants, likewise.
 *   DayClosingLog   — a closed business day belongs to the branch that closed it.
 *
 * Nothing is ever deleted, and no id, customerCode or loanCode is rewritten.
 *
 * Usage (PowerShell):
 *   $env:TENANT='samurai-ml-af-cf'      # slug, customDomain, or tenant id
 *   $env:FROM_BRANCH='Erode_Manoj'      # branch name, code, or id
 *   $env:TO_BRANCH='Head Office'
 *   $env:DRY_RUN='1'; node scripts/backfill-branch-merge.js
 *   # review the report, then re-run without DRY_RUN to write
 *
 * Refuses to run when a route name would collide in the target branch: two
 * routes called the same thing in one branch is a merge, and this script does
 * not merge — rename one first.
 */
let PrismaClient;
try { ({ PrismaClient } = require('@prisma/client')); }
catch { ({ PrismaClient } = require('../prisma/generated-client')); }
const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === '1';

// Models re-stamped wholesale. Order is irrelevant — all inside one transaction.
const MOVE_MODELS = ['route', 'customer', 'systemNotification', 'dailyCollection'];

// Models deliberately left where they are, with the reason shown in the report.
const KEEP_MODELS = [
  ['branchCashAccount', 'physical cash pool — move it through the wallet, not here'],
  ['walletTransaction', 'cash ledger backing that pool'],
  ['accountEntry', 'cash book backing that pool'],
  ['user', 'staff posting is an admin decision'],
  ['superadminBranch', 'access grant'],
  ['userBranchModule', 'access grant'],
  ['dayClosingLog', 'a closed day belongs to the branch that closed it'],
  ['branchRequest', 'request history against the branch itself'],
];

async function resolveTenant(ref) {
  if (!ref) throw new Error('Set TENANT before running this script.');
  const t = await prisma.tenant.findFirst({
    where: { OR: [{ id: ref }, { slug: ref }, { customDomain: ref }] },
    select: { id: true, name: true, slug: true },
  });
  if (!t) throw new Error(`No tenant matches "${ref}".`);
  return t;
}

async function resolveBranch(tenantId, ref, label) {
  if (!ref) throw new Error(`Set ${label} before running this script.`);
  const b = await prisma.branch.findFirst({
    where: { tenantId, OR: [{ id: ref }, { name: ref }, { code: ref }] },
    select: { id: true, name: true, code: true },
  });
  if (!b) throw new Error(`No branch matches ${label}="${ref}" in this tenant.`);
  return b;
}

async function main() {
  const tenant = await resolveTenant((process.env.TENANT || '').trim());
  const from = await resolveBranch(tenant.id, (process.env.FROM_BRANCH || '').trim(), 'FROM_BRANCH');
  const to = await resolveBranch(tenant.id, (process.env.TO_BRANCH || '').trim(), 'TO_BRANCH');
  if (from.id === to.id) throw new Error('FROM_BRANCH and TO_BRANCH are the same branch.');

  console.log(`tenant     ${tenant.name} (${tenant.slug})`);
  console.log(`from       ${from.name} [${from.code}] ${from.id}`);
  console.log(`to         ${to.name} [${to.code}] ${to.id}`);
  console.log(`mode       ${DRY_RUN ? 'DRY RUN — nothing is written' : 'APPLY — rows will be updated'}`);

  // ---- pre-flight: route names must stay unambiguous inside the target branch.
  const [fromRoutes, toRoutes] = await Promise.all([
    prisma.route.findMany({ where: { branchId: from.id }, select: { id: true, name: true } }),
    prisma.route.findMany({ where: { branchId: to.id }, select: { id: true, name: true } }),
  ]);
  const norm = (s) => String(s).trim().toLowerCase();
  const toNames = new Set(toRoutes.map((r) => norm(r.name)));
  const clashes = fromRoutes.filter((r) => toNames.has(norm(r.name)));
  if (clashes.length) {
    console.error(
      `\nREFUSING: ${clashes.length} route name(s) already exist in ${to.name}: ` +
        clashes.map((r) => `"${r.name}"`).join(', ') +
        '\nRename one side first — this script never merges two routes into one.',
    );
    process.exitCode = 1;
    return;
  }

  // ---- what is about to move
  console.log('\n-- moving --');
  const plan = [];
  for (const m of MOVE_MODELS) {
    const n = await prisma[m].count({ where: { branchId: from.id } });
    plan.push([m, n]);
    console.log(`  ${m.padEnd(20)} ${String(n).padStart(5)}`);
  }
  console.log('\n-- staying on ' + from.name + ' --');
  for (const [m, why] of KEEP_MODELS) {
    if (!prisma[m]) continue;
    const n = await prisma[m].count({ where: { branchId: from.id } });
    if (n > 0) console.log(`  ${m.padEnd(20)} ${String(n).padStart(5)}   (${why})`);
  }

  const movingCustomers = await prisma.customer.findMany({
    where: { branchId: from.id },
    select: { customerCode: true, name: true, status: true },
    orderBy: { customerCode: 'asc' },
  });
  if (movingCustomers.length) {
    console.log('\n-- customers moving (codes preserved) --');
    for (const c of movingCustomers) {
      console.log(`  ${String(c.customerCode).padEnd(10)} ${String(c.name).slice(0, 24).padEnd(24)} ${c.status}`);
    }
  }

  // ---- derived repairs, reported before they are applied
  const misLoans = await prisma.loan.findMany({
    where: { tenantId: tenant.id, customer: { branchId: { not: null } } },
    select: { id: true, loanCode: true, branchId: true, customer: { select: { branchId: true } } },
  });
  const loanFixes = misLoans.filter((l) => l.branchId !== l.customer.branchId);
  console.log(`\n-- loan branch repair (loan.branchId := customer's branch) --`);
  console.log(`  ${loanFixes.length} loan(s) mis-stamped BEFORE the move`);

  if (DRY_RUN) {
    console.log('\nDRY RUN complete. Re-run without DRY_RUN=1 to write.');
    return;
  }

  // ---- write, all or nothing
  const result = await prisma.$transaction(async (tx) => {
    const moved = {};
    for (const m of MOVE_MODELS) {
      const r = await tx[m].updateMany({ where: { branchId: from.id }, data: { branchId: to.id } });
      moved[m] = r.count;
    }

    // A loan belongs to its customer's branch, always. Recomputed AFTER the move
    // so loans of moved customers land on the target branch.
    const loans = await tx.loan.findMany({
      where: { tenantId: tenant.id, customer: { branchId: { not: null } } },
      select: { id: true, branchId: true, customer: { select: { branchId: true } } },
    });
    let loansFixed = 0;
    for (const l of loans) {
      if (l.branchId === l.customer.branchId) continue;
      await tx.loan.update({ where: { id: l.id }, data: { branchId: l.customer.branchId } });
      loansFixed++;
    }

    // A collection sheet belongs to the branch of the route it was worked on.
    const sheets = await tx.dailyCollection.findMany({
      where: { tenantId: tenant.id, routeId: { not: null } },
      select: { id: true, branchId: true, route: { select: { branchId: true } } },
    });
    let sheetsFixed = 0;
    for (const s of sheets) {
      if (!s.route?.branchId || s.branchId === s.route.branchId) continue;
      await tx.dailyCollection.update({ where: { id: s.id }, data: { branchId: s.route.branchId } });
      sheetsFixed++;
    }

    return { moved, loansFixed, sheetsFixed };
  }, { timeout: 120000 });

  console.log('\n-- written --');
  for (const [m, n] of Object.entries(result.moved)) console.log(`  ${m.padEnd(20)} ${n} re-stamped`);
  console.log(`  ${'loan (derived)'.padEnd(20)} ${result.loansFixed} re-stamped to their customer's branch`);
  console.log(`  ${'dailyCollection'.padEnd(20)} ${result.sheetsFixed} re-stamped to their route's branch`);

  // ---- verify
  console.log('\n-- verification --');
  for (const m of MOVE_MODELS) {
    const n = await prisma[m].count({ where: { branchId: from.id } });
    console.log(`  ${m.padEnd(20)} left on ${from.name}: ${n}`);
  }
  const stillMis = await prisma.loan.findMany({
    where: { tenantId: tenant.id, customer: { branchId: { not: null } } },
    select: { loanCode: true, branchId: true, customer: { select: { branchId: true } } },
  });
  const bad = stillMis.filter((l) => l.branchId !== l.customer.branchId);
  console.log(`  loans still mis-stamped: ${bad.length}${bad.length ? ' -> ' + bad.map((l) => l.loanCode).join(', ') : ''}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
