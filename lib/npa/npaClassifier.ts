import prisma from '@/lib/db';
import { calculateProvisioning } from './provisioningCalculator';

// ─── Asset Category Types ────────────────────────────────────────────────────

export type AssetCategory =
  | 'standard'
  | 'sma_0'
  | 'sma_1'
  | 'sma_2'
  | 'sub_standard'
  | 'doubtful_d1'
  | 'doubtful_d2'
  | 'doubtful_d3'
  | 'loss'
  | 'written_off';

export interface ClassificationResult {
  loanId: string;
  previousCategory: AssetCategory;
  newCategory: AssetCategory;
  daysOverdue: number;
  changed: boolean;
}

interface InstalmentForNpa {
  dueDate: Date | string;
  dueAmount: any;
  receivedAmount: any;
  status: string;
}

interface LoanForClassification {
  id: string;
  customerId: string;
  npaStatus: string | null;
  npaClassifiedAt: Date | null;
  npaDaysOverdue: number;
  totalPayable: any;
  totalCollected: any;
  isSecured: boolean;
  instalments: InstalmentForNpa[];
}

// ─── Main Engine Entry Point ─────────────────────────────────────────────────

export async function runNpaClassification(
  tenantId: string,
  triggeredBy: string = 'cron_auto',
  triggeredById?: string
): Promise<{ processed: number; changed: number; errors: number }> {

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch all active or already-NPA loans for this tenant
  const loans = await prisma.loan.findMany({
    where: {
      tenantId,
      status: { in: ['active', 'npa', 'overdue'] },
      deletedAt: null,
    },
    select: {
      id: true,
      customerId: true,
      npaStatus: true,
      npaClassifiedAt: true,
      npaDaysOverdue: true,
      totalPayable: true,
      totalCollected: true,
      isSecured: true,
      instalments: {
        where: { status: { not: 'paid' } },
        select: { dueDate: true, dueAmount: true, receivedAmount: true, status: true },
        orderBy: { dueDate: 'asc' },
      },
    },
  });

  let processed = 0;
  let changed = 0;
  let errors = 0;

  for (const loan of loans) {
    try {
      const result = await classifyLoan(
        loan as LoanForClassification,
        today,
        triggeredBy,
        triggeredById,
        tenantId
      );
      processed++;
      if (result.changed) changed++;
    } catch (err) {
      errors++;
      console.error(`NPA classification failed for loan ${loan.id}:`, err);
      // Continue processing other loans — never crash the whole batch
    }
  }

  return { processed, changed, errors };
}

// ─── Per-Loan Classification ─────────────────────────────────────────────────

async function classifyLoan(
  loan: LoanForClassification,
  today: Date,
  triggeredBy: string,
  triggeredById: string | undefined,
  tenantId: string
): Promise<ClassificationResult> {

  // Compute outstanding amount
  const outstandingAmount = Number(loan.totalPayable) - Number(loan.totalCollected);

  // 1. Find the oldest unpaid overdue instalment
  const maxOverdueDays = calculateMaxOverdueDays(loan.instalments, today);

  // 2. Determine the new asset category
  const newCategory = determineCategory(
    maxOverdueDays,
    loan.npaClassifiedAt,
    today
  );

  const previousCategory = (loan.npaStatus ?? 'standard') as AssetCategory;
  const changed = newCategory !== previousCategory;

  // 3. Calculate provisioning for the new category
  const provisioning = calculateProvisioning(
    newCategory,
    outstandingAmount,
    loan.isSecured ?? false
  );

  // 4. Only write to DB if something changed
  if (changed) {
    await prisma.$transaction(async (tx) => {

      // Update the loan record
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          npaStatus: newCategory,
          npaSubCategory: getNpaSubCategory(newCategory),
          npaDaysOverdue: maxOverdueDays,
          npaClassifiedAt: newCategory !== 'standard' && !loan.npaClassifiedAt
            ? today
            : loan.npaClassifiedAt,
          lastNpaReviewDate: today,
          provisioningRate: provisioning.rate,
          provisioningAmount: provisioning.amount,
          provisioningCategory: newCategory,
          // Update loan status if it becomes NPA (sub_standard or worse)
          status: ['sub_standard', 'doubtful_d1', 'doubtful_d2', 'doubtful_d3', 'loss', 'written_off'].includes(newCategory)
            ? 'npa'
            : 'active',
        },
      });

      // Create history record
      await tx.npaHistory.create({
        data: {
          tenantId,
          loanId: loan.id,
          customerId: loan.customerId,
          fromCategory: previousCategory,
          toCategory: newCategory,
          daysOverdue: maxOverdueDays,
          outstandingAmt: outstandingAmount,
          triggeredBy,
          triggeredById: triggeredById ?? null,
          provisioningRate: provisioning.rate,
          provisioningAmount: provisioning.amount,
        },
      });

      // Daily provisioning snapshot
      await tx.loanProvisioning.upsert({
        where: { loanId_snapshotDate: { loanId: loan.id, snapshotDate: today } },
        update: {
          category: newCategory,
          outstandingAmt: outstandingAmount,
          provisioningRate: provisioning.rate,
          provisioningAmt: provisioning.amount,
        },
        create: {
          tenantId,
          loanId: loan.id,
          snapshotDate: today,
          category: newCategory,
          outstandingAmt: outstandingAmount,
          provisioningRate: provisioning.rate,
          provisioningAmt: provisioning.amount,
          isSecured: loan.isSecured ?? false,
        },
      });
    });

    // Audit log the change
    await prisma.auditLog.create({
      data: {
        tenantId,
        action: 'npa_classification_change',
        entityType: 'loan',
        entityId: loan.id,
        oldValue: JSON.stringify({ category: previousCategory }),
        newValue: JSON.stringify({
          category: newCategory,
          daysOverdue: maxOverdueDays,
          provisioningAmount: provisioning.amount,
          triggeredBy,
        }),
      },
    });
  } else {
    // Even if not changed, update the daily review date and overdue days
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        npaDaysOverdue: maxOverdueDays,
        lastNpaReviewDate: today,
      },
    });

    // Always write today's provisioning snapshot
    await prisma.loanProvisioning.upsert({
      where: { loanId_snapshotDate: { loanId: loan.id, snapshotDate: today } },
      update: { outstandingAmt: outstandingAmount, provisioningAmt: provisioning.amount },
      create: {
        tenantId,
        loanId: loan.id,
        snapshotDate: today,
        category: newCategory,
        outstandingAmt: outstandingAmount,
        provisioningRate: provisioning.rate,
        provisioningAmt: provisioning.amount,
        isSecured: loan.isSecured ?? false,
      },
    });
  }

  return { loanId: loan.id, previousCategory, newCategory, daysOverdue: maxOverdueDays, changed };
}

// ─── Overdue Days Calculation ────────────────────────────────────────────────

/**
 * Finds the oldest unpaid instalment and counts days since it was due.
 * RBI rule: the clock starts from the FIRST unpaid due date.
 * If any instalment is partially paid, it still counts as overdue
 * unless receivedAmount >= dueAmount.
 */
export function calculateMaxOverdueDays(
  instalments: InstalmentForNpa[],
  today: Date
): number {
  const overdueInstalments = instalments.filter((inst) => {
    const dueDate = new Date(inst.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const isPastDue = dueDate < today;
    const isUnpaid = Number(inst.receivedAmount ?? 0) < Number(inst.dueAmount);
    return isPastDue && isUnpaid;
  });

  if (overdueInstalments.length === 0) return 0;

  // Find the oldest overdue instalment
  const oldestDue = overdueInstalments.reduce((oldest, inst) =>
    new Date(inst.dueDate) < new Date(oldest.dueDate) ? inst : oldest
  );

  const dueDate = new Date(oldestDue.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - dueDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ─── Category Determination ──────────────────────────────────────────────────

/**
 * Determines asset category from overdue days.
 * For Doubtful sub-categories, we need the original NPA classification
 * date to measure how long it has been in NPA status.
 */
export function determineCategory(
  daysOverdue: number,
  npaClassifiedAt: Date | null,
  today: Date
): AssetCategory {

  if (daysOverdue === 0) return 'standard';
  if (daysOverdue <= 30) return 'sma_0';
  if (daysOverdue <= 60) return 'sma_1';
  if (daysOverdue <= 90) return 'sma_2';

  // 90+ days = NPA. Now determine sub-category by
  // how long it has been in NPA (from npaClassifiedAt)
  const npaDate = npaClassifiedAt ?? today;
  const daysInNpa = Math.floor(
    (today.getTime() - npaDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysInNpa <= 365) return 'sub_standard';   // 0–12 months in NPA
  if (daysInNpa <= 730) return 'doubtful_d1';    // 12–24 months in NPA
  if (daysInNpa <= 1095) return 'doubtful_d2';   // 24–36 months in NPA
  return 'doubtful_d3';                           // 36+ months in NPA
}

function getNpaSubCategory(category: AssetCategory): string | null {
  const map: Partial<Record<AssetCategory, string>> = {
    sub_standard: 'sub_standard',
    doubtful_d1: 'd1',
    doubtful_d2: 'd2',
    doubtful_d3: 'd3',
    loss: 'loss',
  };
  return map[category] ?? null;
}
