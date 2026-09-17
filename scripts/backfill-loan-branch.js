#!/usr/bin/env node
/**
 * Repair Loan.branchId so it matches the branch of the loan's CUSTOMER.
 *
 * Loan creation used to stamp `ctx.branchId ?? customer.branchId` — the branch
 * of whoever RAISED the loan, falling back to the customer's. A superadmin sits
 * on one branch and raises loans for every branch, so their loans all landed on
 * the superadmin's own branch. Reads are scoped to the record's own branch
 * (lib/branchScope.ts), so those loans showed up in the WRONG branch admin's
 * list and vanished from the branch that owns the customer — along with their
 * approval notifications.
 *
 * Creation is fixed (`resolveWriteBranchId(ctx, customer.branchId)` in
 * app/api/v1/loans/route.ts); this repairs the rows written before that.
 *
 * Run scripts/backfill-customer-route-agent.js FIRST so customers have their
 * branch, or loans whose customer is still unbranched will be skipped here.
 *
 * Usage (PowerShell):
 *   $env:TENANT='samurai-ml-af-cf'    # slug, customDomain, or tenant id
 *   $env:DRY_RUN='1'; node scripts/backfill-loan-branch.js
 *   # review the report, then re-run without DRY_RUN to write
 *
 * Optional: LOAN_CODE=DL0001 restricts the run to a single loan.
 *
 * Only ever sets a loan's branch to its customer's. A loan whose customer has no
 * branch is left alone and reported — guessing there would move money between
 * branches' books.
 */
let PrismaClient;
try { ({ PrismaClient } = require('@prisma/client')); }
catch { ({ PrismaClient } = require('../prisma/generated-client')); }
const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === '1';
const LOAN_CODE = (process.env.LOAN_CODE || '').trim();

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

  const branches = await prisma.branch.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, name: true },
  });
  const branchName = (id) =>
    id ? branches.find((b) => b.id === id)?.name ?? `<missing ${id}>` : '<none>';

  const loans = await prisma.loan.findMany({
    where: {
      tenantId: tenant.id,
      ...(LOAN_CODE ? { loanCode: LOAN_CODE } : {}),
    },
    select: {
      id: true,
      loanCode: true,
      branchId: true,
      customer: { select: { customerCode: true, name: true, branchId: true } },
      createdBy: { select: { name: true, role: true, branchId: true } },
    },
    orderBy: { loanCode: 'asc' },
  });

  const mismatched = [];
  const unfixable = [];
  for (const loan of loans) {
    const target = loan.customer?.branchId ?? null;
    if (!target) {
      if (!loan.branchId) unfixable.push(loan);
      continue;
    }
    if (loan.branchId !== target) mismatched.push({ loan, target });
  }

  console.log(`Loans scanned      : ${loans.length}`);
  console.log(`On the wrong branch: ${mismatched.length}`);
  console.log(`Unbranched, customer also unbranched (skipped): ${unfixable.length}\n`);

  for (const { loan, target } of mismatched) {
    console.log(
      `  ${loan.loanCode.padEnd(12)} ${branchName(loan.branchId)} → ${branchName(target)}` +
        `   (customer ${loan.customer?.customerCode}, raised by ${loan.createdBy?.name ?? '?'}` +
        `/${loan.createdBy?.role ?? '?'} on ${branchName(loan.createdBy?.branchId)})`,
    );
  }

  if (unfixable.length) {
    console.log('\nSkipped — run scripts/backfill-customer-route-agent.js first:');
    for (const loan of unfixable) {
      console.log(`  ${loan.loanCode.padEnd(12)} customer ${loan.customer?.customerCode ?? '?'} has no branch`);
    }
  }

  if (!mismatched.length) {
    console.log('Nothing to repair.');
    return;
  }

  if (DRY_RUN) {
    console.log('\nDRY_RUN — no rows written.');
    return;
  }

  // Accounting rows written at disbursement carry the same wrong branch, so
  // move them with the loan. Anything keyed to the loan by referenceId is part
  // of that loan's books.
  let loansUpdated = 0;
  let entriesUpdated = 0;
  for (const { loan, target } of mismatched) {
    await prisma.$transaction(async (tx) => {
      await tx.loan.update({ where: { id: loan.id }, data: { branchId: target } });
      const entries = await tx.accountEntry.updateMany({
        where: { tenantId: tenant.id, referenceType: 'loan', referenceId: loan.id },
        data: { branchId: target },
      });
      entriesUpdated += entries.count;
    });
    loansUpdated += 1;
  }

  console.log(`\nUpdated ${loansUpdated} loans and ${entriesUpdated} accounting entries.`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
