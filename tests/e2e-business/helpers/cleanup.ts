import { getPrisma, getRunId } from './testDb';
import { rm } from 'node:fs/promises';
import path from 'node:path';

async function ignoreMissingSchema(operation: Promise<unknown>) {
  try {
    await operation;
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (code === 'P2021' || code === 'P2022') return;
    throw error;
  }
}

export async function cleanupRunData(runId = getRunId()) {
  const prisma = getPrisma();
  const tenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: runId } },
    select: { id: true },
  });
  const tenantIds = tenants.map((tenant) => tenant.id);
  if (tenantIds.length === 0) return;

  const deletions = [
    () => prisma.rateLimit.deleteMany({ where: { key: { contains: runId } } }),
    () => prisma.webhookEvent.deleteMany({ where: { OR: [{ eventId: { contains: runId } }, { payload: { contains: runId } }] } }),
    () => prisma.mobileRefreshToken.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.agentLocationPing.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.notificationLog.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.walletTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.agentAccount.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.branchCashAccount.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.approvalRequest.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.systemNotification.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.accountEntry.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.paymentAllocation.deleteMany({ where: { payment: { tenantId: { in: tenantIds } } } }),
    () => prisma.payment.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.nachPresentation.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.nachMandate.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.clientPaymentToken.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.cashHandover.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.collectionRun.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.collectionEntry.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.dailyCollection.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.penalty.deleteMany({ where: { loan: { tenantId: { in: tenantIds } } } }),
    () => prisma.npaHistory.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.loanProvisioning.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.instalment.deleteMany({ where: { loan: { tenantId: { in: tenantIds } } } }),
    () => prisma.kycDocument.deleteMany({ where: { customer: { tenantId: { in: tenantIds } } } }),
    () => prisma.customerGeocode.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.guarantor.deleteMany({ where: { customer: { tenantId: { in: tenantIds } } } }),
    () => prisma.customerCollectionPoint.deleteMany({ where: { customer: { tenantId: { in: tenantIds } } } }),
    () => prisma.bankRepledge.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.goldOrnamentItem.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.goldLoanCollateral.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.productFinanceItem.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.vehicle.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.chitSubscription.deleteMany({ where: { member: { chitGroup: { tenantId: { in: tenantIds } } } } }),
    () => prisma.chitMember.deleteMany({ where: { chitGroup: { tenantId: { in: tenantIds } } } }),
    () => prisma.chitAuction.deleteMany({ where: { chitGroup: { tenantId: { in: tenantIds } } } }),
    () => prisma.chitGroup.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.loan.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.customer.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.routeAgent.deleteMany({ where: { route: { tenantId: { in: tenantIds } } } }),
    () => prisma.route.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.userBranchModule.deleteMany({ where: { branch: { tenantId: { in: tenantIds } } } }),
    () => prisma.userModule.deleteMany({ where: { user: { tenantId: { in: tenantIds } } } }),
    () => prisma.loanPackage.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.branch.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.appSetting.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    () => prisma.tenantSubscription.deleteMany({ where: { tenantId: { in: tenantIds } } }),
  ];

  for (const deleteRows of deletions) {
    await ignoreMissingSchema(deleteRows());
  }

  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });

  const uploadBaseDir = path.resolve(process.env.UPLOAD_DIR?.trim() || path.join(process.cwd(), 'private', 'uploads'));
  await Promise.all(
    tenantIds.map((tenantId) =>
      rm(path.join(uploadBaseDir, tenantId), { recursive: true, force: true }).catch(() => {}),
    ),
  );
}
