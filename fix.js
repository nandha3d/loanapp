const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Group all penalties by loanId
  const allPenalties = await prisma.penalty.findMany({
    orderBy: [{ loanId: 'asc' }, { createdAt: 'asc' }],
  });

  const loanMap = new Map();
  for (const p of allPenalties) {
    const arr = loanMap.get(p.loanId) || [];
    arr.push(p);
    loanMap.set(p.loanId, arr);
  }

  let deletedCount = 0;
  let mergedCount = 0;

  for (const [loanId, penalties] of loanMap) {
    if (penalties.length <= 1) continue;

    // Separate resolved (settled/waived) from active (pending/partial)
    const resolved = penalties.filter(p => p.status === 'settled' || p.status === 'waived');
    const active = penalties.filter(p => p.status === 'pending' || p.status === 'partial');

    if (active.length <= 1) continue; // Only 0 or 1 active, no duplicates

    // Keep the first active one (oldest), merge data, delete the rest
    const keeper = active[0];
    const duplicates = active.slice(1);

    // The keeper already has the correct grossPenalty since they're all the same per-loan calc
    // Just take the max grossPenalty and max missedDays from all duplicates
    let maxGross = Number(keeper.grossPenalty);
    let maxMissed = keeper.missedDays;
    for (const dup of duplicates) {
      maxGross = Math.max(maxGross, Number(dup.grossPenalty));
      maxMissed = Math.max(maxMissed, dup.missedDays);
    }

    // Update keeper with the max values
    await prisma.penalty.update({
      where: { id: keeper.id },
      data: { grossPenalty: maxGross, missedDays: maxMissed },
    });
    mergedCount++;

    // Delete duplicates
    const dupIds = duplicates.map(d => d.id);
    await prisma.penalty.deleteMany({ where: { id: { in: dupIds } } });
    deletedCount += dupIds.length;
    console.log(`Loan ${loanId}: kept ${keeper.id}, deleted ${dupIds.length} duplicates`);
  }

  console.log(`\nDone. Merged ${mergedCount} keepers, deleted ${deletedCount} duplicates.`);

  // Print remaining penalties
  const remaining = await prisma.penalty.findMany({
    include: { loan: { select: { loanCode: true } } },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`\nRemaining penalties: ${remaining.length}`);
  const totalGross = remaining.reduce((s, p) => s + Number(p.grossPenalty), 0);
  console.log(`Total gross penalty: ${totalGross}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
