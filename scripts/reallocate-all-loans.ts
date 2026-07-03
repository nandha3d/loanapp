/**
 * One-time repair: re-run oldest-first repayment allocation for every open
 * loan so instalment statuses, loan status, overdue figures and the calendar
 * all agree. Run on the server with:  npx tsx scripts/reallocate-all-loans.ts
 */
import prisma from '../lib/db';
import { reallocateLoanRepayments } from '../lib/repayments';

async function main() {
  const loans = await prisma.loan.findMany({
    where: { status: { in: ['active', 'overdue'] } },
    select: { id: true, loanCode: true, status: true },
  });
  console.log(`Reallocating ${loans.length} open loans (oldest-first)...`);
  let changed = 0;
  for (const loan of loans) {
    const summary = await prisma.$transaction((tx) =>
      reallocateLoanRepayments(tx, loan.id),
    );
    const note = summary.loanStatus !== loan.status ? `status ${loan.status} -> ${summary.loanStatus}` : '';
    if (note) changed++;
    console.log(
      `${loan.loanCode}: paid=${summary.paidCount} overdueDays=${summary.overdueCount} overdueAmt=${summary.overdueAmount} ${note}`,
    );
  }
  console.log(`Done. ${changed} loan status change(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
