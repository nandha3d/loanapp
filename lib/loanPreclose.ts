import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { reallocateLoanRepayments } from './repayments';

// Existing admin settlement, shared with approval execution (STRUCT-3).
// Keep its allocation and accounting behavior unchanged.
export async function precloseLoanInTx(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string; userId: string },
  loan: { id: string; appType: string; branchId: string | null; customerId: string; customer: { name: string } },
  input: { amount: number; paymentMode: string; remarks: string },
) {
  const id = loan.id;
  const { amount, paymentMode, remarks } = input;
  // A direct admin settlement can race an approval for the same loan. Both
  // Micro Lending paths must hold the subject lock before reading unpaid dues.
  if (loan.appType === 'microlending') {
    await tx.$queryRaw`SELECT id FROM loans WHERE id = ${id} AND tenant_id = ${ctx.tenantId} AND app_type = ${loan.appType} FOR UPDATE`;
  }
  // Find all unpaid or partially paid instalments
  const unpaidInstalments = await tx.instalment.findMany({
    where: {
      loanId: id,
      status: { in: ['upcoming', 'missed', 'partial'] },
    },
    orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
  });

  if (unpaidInstalments.length === 0) {
    throw new Error('All instalments for this loan have already been fully collected.');
  }

  // Create a master Payment record
  const payment = await tx.payment.create({
    data: {
      tenantId: ctx.tenantId,
      loanId: id,
      amount,
      paymentMode,
      referenceNumber: `PRECLOSE-${randomUUID().substring(0, 8).toUpperCase()}`,
      paymentDate: new Date(),
      status: 'completed',
    },
  });

  // Get or create DailyCollection atomically using SQL to avoid Prisma timezone bugs
  const newCollectionId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO daily_collections
       (id, tenant_id, app_type, agent_id, branch_id, date, total_expected, total_collected, entries_count, status, created_at, updated_at)
     VALUES (${newCollectionId}, ${ctx.tenantId}, ${loan.appType}, ${ctx.userId}, ${loan.branchId ?? null}, CURDATE(), 0, 0, 0, 'open', NOW(), NOW())
     ON DUPLICATE KEY UPDATE id = id
  `;

  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM daily_collections
     WHERE tenant_id = ${ctx.tenantId} AND app_type = ${loan.appType} AND agent_id = ${ctx.userId} AND date = CURDATE()
     LIMIT 1
  `;
  if (!rows[0]) throw new Error('DailyCollection not found after upsert');
  const dailyCollectionId = rows[0].id;

  // Pick the instalment closest to today (first one with dueDate >= today, or last if all past-due)
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const closureInst = unpaidInstalments.find(i => new Date(i.dueDate) >= todayStart) || unpaidInstalments[unpaidInstalments.length - 1];
  const allocationsDesc: string[] = [];

  // 1. Create ONE PaymentAllocation for the closure instalment
  await tx.paymentAllocation.create({
    data: {
      paymentId: payment.id,
      instalmentId: closureInst.id,
      amount: amount, // The full lump-sum
    },
  });

  // 2. Update the closure Instalment record with the FULL amount
  const received = Number(closureInst.receivedAmount || 0);
  const nextReceived = Number((received + amount).toFixed(2));
  
  await tx.instalment.update({
    where: { id: closureInst.id },
    data: {
      receivedAmount: nextReceived,
      status: 'paid',
      receivedAt: new Date(),
      remarks: remarks || `Preclosed`,
    },
  });

  // 3. Create ONE CollectionEntry
  await tx.collectionEntry.create({
    data: {
      id: randomUUID(),
      collectionId: dailyCollectionId,
      customerId: loan.customerId,
      loanId: loan.id,
      dueAmount: Number(closureInst.dueAmount),
      receivedAmount: amount, // The full lump-sum
      paymentMode,
      remarks: remarks || `Preclosed | Payment ID: ${payment.id}`,
      agentId: ctx.userId,
      submittedAt: new Date(),
      isLocked: true,
      verificationStatus: 'verified',
      tenantId: ctx.tenantId,
    },
  });

  // 3.5 Record the AccountEntry so it reflects in the company's capital balance
  await tx.accountEntry.create({
    data: {
      tenantId: ctx.tenantId,
      appType: loan.appType,
      entryDate: new Date(),
      type: 'collection',
      category: paymentMode === 'cash' ? 'cash' : 'upi',
      amount: amount,
      description: `Preclosure Settlement: ${loan.customer.name}`,
    }
  });

  allocationsDesc.push(`#${closureInst.instalmentNo} (+₹${amount})`);

  // 4. Mark all OTHER unpaid instalments as 'waived'
  const otherInstIds = unpaidInstalments.filter(i => i.id !== closureInst.id).map(i => i.id);
  if (otherInstIds.length > 0) {
    await tx.instalment.updateMany({
      where: { id: { in: otherInstIds } },
      data: {
        status: 'waived',
        remarks: 'Waived due to Preclosure',
      }
    });
    allocationsDesc.push(`Waived ${otherInstIds.length} instalments`);
  }

  // Recalculate and reallocate loan totals
  await reallocateLoanRepayments(tx, id);

  // Update DailyCollection totals
  const allEntries = await tx.collectionEntry.findMany({
    where: { collectionId: dailyCollectionId },
  });

  await tx.dailyCollection.update({
    where: { id: dailyCollectionId },
    data: {
      totalCollected: allEntries.reduce((sum, entry) => sum + Number(entry.receivedAmount), 0),
      totalExpected: allEntries.reduce((sum, entry) => sum + Number(entry.dueAmount), 0),
      entriesCount: allEntries.length,
    },
  });

  // Close the loan
  await tx.loan.update({
    where: { id },
    data: {
      status: 'closed',
      closedAt: new Date(),
    },
  });

  // Write to AuditLog
  await tx.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'payment',
      entityId: payment.id,
      newValue: JSON.stringify({
        action: 'preclose',
        amount,
        paymentMode,
        allocations: allocationsDesc.join(', '),
      }),
    },
  });
}
