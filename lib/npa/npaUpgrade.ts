import prisma from '@/lib/db';
import { calculateProvisioning } from './provisioningCalculator';

/**
 * Checks if an NPA loan is eligible for upgrade.
 * Eligibility: 3 consecutive instalments paid on time after NPA classification.
 */
export async function checkUpgradeEligibility(loanId: string): Promise<{
  eligible: boolean;
  reason: string;
  consecutiveCleanInstalments: number;
}> {
  const loan = await prisma.loan.findUniqueOrThrow({
    where: { id: loanId },
    include: {
      instalments: {
        orderBy: { dueDate: 'desc' },
        take: 6,   // check last 6 instalments
      },
    },
  });

  // Only NPA loans can be upgraded
  if (!['sub_standard', 'doubtful_d1', 'doubtful_d2', 'doubtful_d3'].includes(
    loan.npaStatus ?? ''
  )) {
    return { eligible: false, reason: 'Loan is not in NPA status', consecutiveCleanInstalments: 0 };
  }

  // Count consecutive paid instalments from most recent backwards
  let consecutive = 0;
  for (const inst of loan.instalments) {
    if (inst.status === 'paid' && Number(inst.receivedAmount) >= Number(inst.dueAmount)) {
      consecutive++;
    } else {
      break;   // stop at first non-clean instalment
    }
  }

  const eligible = consecutive >= 3;
  return {
    eligible,
    consecutiveCleanInstalments: consecutive,
    reason: eligible
      ? '3 consecutive clean instalments paid. Eligible for upgrade to Standard.'
      : `Only ${consecutive} consecutive clean instalments. 3 required for upgrade.`,
  };
}

/**
 * Admin-triggered upgrade. Requires explicit approval — not automatic.
 */
export async function upgradeNpaToStandard(
  loanId: string,
  adminUserId: string,
  tenantId: string,
  notes: string
): Promise<void> {
  const { eligible, reason } = await checkUpgradeEligibility(loanId);

  if (!eligible) {
    throw new Error(`UPGRADE_NOT_ELIGIBLE: ${reason}`);
  }

  const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
  const outstandingAmount = Number(loan.totalPayable) - Number(loan.totalCollected);
  const provisioning = calculateProvisioning('standard', outstandingAmount, false);

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: loanId },
      data: {
        npaStatus: 'standard',
        npaSubCategory: null,
        npaClassifiedAt: null,  // clear — no longer NPA
        npaDaysOverdue: 0,
        npaUpgradeEligible: false,
        provisioningRate: provisioning.rate,
        provisioningAmount: provisioning.amount,
        provisioningCategory: 'standard',
        status: 'active',
      },
    });

    await tx.npaHistory.create({
      data: {
        tenantId,
        loanId,
        customerId: loan.customerId,
        fromCategory: loan.npaStatus ?? 'sub_standard',
        toCategory: 'standard',
        daysOverdue: 0,
        outstandingAmt: outstandingAmount,
        triggeredBy: 'manual_admin',
        triggeredById: adminUserId,
        notes,
        provisioningRate: provisioning.rate,
        provisioningAmount: provisioning.amount,
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: adminUserId,
      action: 'npa_upgrade',
      entityType: 'loan',
      entityId: loanId,
      newValue: JSON.stringify({ upgradedTo: 'standard', notes }),
    },
  });
}
