import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { computeRestructure, restructuredAmountFor, computeExtendedSchedule } from '@/lib/restructure';
import { calculateEndDate } from '@/lib/utils';
import { calculateLoanPreview } from '@/lib/loanCalculator';
import { validateGuarantorPhone } from '@/lib/guarantorPolicy';
import { encryptAadharNumber, decryptAadharNumber } from '@/lib/pii';
import { writeAudit } from '@/lib/audit';
import { validateLoanNumericInputs, buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { hasFinancialActivity } from '@/lib/repayments';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  const loanWhere: any = {
    OR: [
      { id },
      { loanCode: id }
    ],
    tenantId: ctx.tenantId,
    appType: ctx.appType,
  };
  if (ctx.role === 'agent') {
    // Agents see only their own customers' loans (linkage), regardless of branch.
    loanWhere.customer = buildAgentCustomerAccessWhere({ userId: ctx.userId });
  } else {
    Object.assign(loanWhere, scopedBranchWhere(ctx));
  }

  const loan = await prisma.loan.findFirst({
    where: loanWhere,
    include: {
      customer: {
        include: {
          securityCheques: true,
          guarantors: true,
          loans: {
            include: { instalments: true, penalties: true }
          }
        }
      },
      instalments: {
        include: {
          collectionEntry: { select: { id: true } }
        },
        orderBy: { instalmentNo: 'asc' }
      },
      penalties: { orderBy: { createdAt: 'desc' } },
      collaterals: true,
      guarantor: true,
      goldCollateral: true,
      propertyCollateral: true,
      productFinanceItem: true,
      payments: {
        orderBy: { paymentDate: 'asc' }
      }
    },
  });
  if (!loan) return fail('Loan not found', 404);

  // Date string YYYY-MM-DD in UTC — instalment dueDates are stored at UTC
  // midnight, so UTC getters keep the calendar date stable on any server TZ.
  const toDateStr = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Anchor "today" to the IST business day (matches /api/v1/collection/today
  // and the web client running in the user's browser) so statuses and the
  // restructured rate don't drift when the server runs in UTC.
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const today = new Date(
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()),
  );

  // Per-instalment receivedAmount comes straight from the DB — it is the
  // actual money recorded on each row (no redistribution, no payment-to-row
  // guessing), so web, mobile and reports all read identical figures.
  const preMappedInstalments = loan.instalments.map((inst) => {
    const actualAmount = Number(inst.receivedAmount ?? 0);
    const isPaid = actualAmount >= Number(inst.dueAmount);
    const isPartial = actualAmount > 0 && actualAmount < Number(inst.dueAmount);

    let computedStatus = inst.status;
    if (inst.status !== 'waived') {
      if (isPaid) {
        computedStatus = 'paid';
      } else if (isPartial) {
        computedStatus = 'partial';
      } else if (new Date(inst.dueDate) < today) {
        computedStatus = 'missed';
      } else if (toDateStr(inst.dueDate) === toDateStr(today)) {
        computedStatus = 'due today';
      } else {
        computedStatus = 'upcoming';
      }
    }

    return {
      ...inst,
      receivedAmount: actualAmount,
      status: computedStatus,
    };
  });

  // Restructured rate — computed server-side (single source of truth). Each
  // instalment gets a `restructuredAmount`; the loan carries the loan-level
  // figures. Clients render these directly and never recompute.
  const restructure = computeRestructure(preMappedInstalments, loan.frequency, loan.endDate, today);
  const instalments = preMappedInstalments.map((inst) => ({
    ...inst,
    restructuredAmount: restructuredAmountFor(inst, restructure.restructuredRate, today),
  }));

  // Default "extend term" projection — same server-side source of truth the
  // web page uses for its heatmap tail cells, so mobile can render the
  // identical projected extra days without re-deriving the math.
  const extendedSchedule = computeExtendedSchedule(
    preMappedInstalments,
    Number(loan.perInstalment),
    loan.frequency,
    today,
  );

  return ok({ ...loan, instalments, restructure, extendedSchedule });
}

/**
 * PATCH /api/v1/loans/[id] — request a loan edit.
 * Mirrors the web's approval-gated `requestLoanEdit`: computes a diff of the
 * submitted editable fields vs the current loan and files an ApprovalRequest
 * (requestType 'loan_edit'). Schedule-affecting core fields are rejected if the
 * loan already has repayments (same guard as web). No schedule math runs here.
 */
const LOAN_EDIT_SCALAR_FIELDS = [
  'penaltyRate',
  'voucherRef',
  'loanType',
  'collateralDetails',
  'dueDay',
] as const;
const LOAN_EDIT_CORE_FIELDS = ['principal', 'tenure', 'frequency', 'startDate'] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  const loan = await prisma.loan.findFirst({
    where: { id, tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx) },
  });
  if (!loan) return fail('Loan not found', 404);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail('Invalid body', 400);
  }
  const reason = typeof body.reason === 'string' ? body.reason : '';

  const proposed: Record<string, unknown> = {};
  // Scalar (non-schedule) fields — safe to change without regenerating instalments.
  for (const f of LOAN_EDIT_SCALAR_FIELDS) {
    if (body[f] === undefined) continue;
    const current = (loan as any)[f];
    const next = body[f];
    const changed =
      f === 'penaltyRate' || f === 'dueDay'
        ? Number(current ?? 0) !== Number(next ?? 0)
        : String(current ?? '') !== String(next ?? '');
    if (changed) proposed[f] = f === 'penaltyRate' || f === 'dueDay' ? Number(next) : next;
  }

  // Core schedule fields — guard against loans with recorded activity.
  let coreChanged = false;
  for (const f of LOAN_EDIT_CORE_FIELDS) {
    if (body[f] === undefined) continue;
    const current = f === 'startDate' ? new Date(loan.startDate).toISOString().slice(0, 10) : (loan as any)[f];
    const next = f === 'startDate' ? String(body[f]).slice(0, 10) : body[f];
    const changed =
      f === 'frequency' || f === 'startDate'
        ? String(current ?? '') !== String(next ?? '')
        : Number(current ?? 0) !== Number(next ?? 0);
    if (changed) {
      proposed[f] = f === 'principal' || f === 'tenure' ? Number(next) : next;
      coreChanged = true;
    }
  }

  if (coreChanged) {
    const { hasFinancialActivity } = await import('@/lib/repayments');
    if (await hasFinancialActivity(id)) {
      return fail(
        'Schedule cannot be regenerated: loan has recorded repayments. Close & renew instead.',
        409,
      );
    }
  }

  if (Object.keys(proposed).length === 0) return fail('No changes detected', 400);

  await prisma.approvalRequest.create({
    data: {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      requestType: 'loan_edit',
      entityType: 'loan',
      entityId: id,
      requestedById: ctx.userId,
      requestedChanges: JSON.stringify(proposed),
      reason,
      status: 'pending',
    },
  });

  await prisma.systemNotification
    .create({
      data: {
        tenantId: ctx.tenantId,
        branchId: loan.branchId,
        appType: ctx.appType,
        type: 'loan_edit_review',
        icon: 'rate_review',
        title: 'Loan edit pending review',
        message: `Edit requested for loan ${loan.loanCode}.`,
        link: '/approvals',
        targetRole: 'admin',
      },
    })
    .catch(() => {});

  return ok({ requested: true, changes: proposed });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { id: loanId } = await params;
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId: ctx.tenantId, appType: ctx.appType },
    include: { guarantor: true, customer: { select: { phone: true } }, goldCollateral: true }
  });

  if (!loan) return fail('Loan not found', 404);

  try {
    const body = await req.json();
    const principal = Number(body.principal) || 0;
    const interestType = String(body.deductionType || 'upfront_fixed');
    const rate = Number(body.deduction) || 0;
    const frequency = String(body.frequency);
    const tenure = Number(body.tenure) || 1;
    const startDateStr = String(body.startDate);
    const penaltyRate = Number(body.penaltyRate) || 0;
    const voucherRef = String(body.voucherRef || '');
    const loanType = String(body.loanType || '');
    const collateralDetails = body.collateralDetails ? String(body.collateralDetails) : null;
    const guarantorName = body.guarantorName ? String(body.guarantorName) : '';
    const guarantorPhone = body.guarantorPhone ? String(body.guarantorPhone) : '';
    const guarantorAadhar = body.guarantorAadhar ? String(body.guarantorAadhar) : '';
    const guarantorAddress = body.guarantorAddress ? String(body.guarantorAddress) : '';
    const guarantorRelation = body.guarantorRelation ? String(body.guarantorRelation) : '';
    const guarantorIdFromForm = body.guarantorId ? String(body.guarantorId) : null;
    const guarantorPhotoUrl = body.guarantorPhotoUrl ? String(body.guarantorPhotoUrl) : null;
    const dueDay = body.dueDay != null ? Number(body.dueDay) : null;

    const startDate = new Date(startDateStr);
    const numericValidation = validateLoanNumericInputs({ principal, rate, tenure, penaltyRate });
    if (!numericValidation.valid) {
      return fail(numericValidation.error, 400);
    }

    const guarantorPhoneValidation = validateGuarantorPhone({
      customerPhone: loan.customer?.phone,
      guarantorPhone,
    });
    if (!guarantorPhoneValidation.valid) {
      return fail(guarantorPhoneValidation.error, 400);
    }

    const coreChanged = 
      Number(loan.principal) !== principal ||
      Number(loan.tenure) !== tenure ||
      loan.frequency !== frequency ||
      loan.dueDay !== dueDay ||
      new Date(loan.startDate).toISOString().slice(0, 10) !== startDate.toISOString().slice(0, 10);

    if (coreChanged) {
      if (await hasFinancialActivity(loanId)) {
        return fail('Cannot reschedule a loan that already has payment history. Please close and renew this loan instead.', 409);
      }
    }

    const endDate = calculateEndDate(startDate, frequency, tenure);
    const calculation = calculateLoanPreview({
      principal,
      interestType,
      interestRate: rate,
      tenure,
      frequency,
      startDate,
      dueDay,
    });

    const disbursed = calculation.disbursedAmount;
    const totalPayable = calculation.totalPayable;
    const perInstalment = calculation.perInstalment;
    const deduction = calculation.deduction;

    await prisma.$transaction(async (tx) => {
      let currentGuarantorId = guarantorIdFromForm || loan.guarantorId;
      if (guarantorName && guarantorPhone) {
        let gPhoto = guarantorPhotoUrl || loan.guarantor?.photo || null;

        const gData = {
          customerId: loan.customerId,
          name: guarantorName,
          phone: guarantorPhone,
          aadharNumber: guarantorAadhar ? encryptAadharNumber(guarantorAadhar) : undefined,
          address: guarantorAddress || undefined,
          relation: guarantorRelation || undefined,
          photo: gPhoto || undefined
        };

        if (currentGuarantorId) {
          await tx.guarantor.update({
            where: { id: currentGuarantorId },
            data: gData
          });
        } else {
          const g = await tx.guarantor.create({
            data: gData
          });
          currentGuarantorId = g.id;
        }
      }

      await tx.loan.update({
        where: { id: loanId },
        data: {
          principal,
          deduction,
          deductionType: interestType,
          disbursed,
          frequency,
          dueDay,
          tenure,
          startDate,
          endDate,
          perInstalment,
          penaltyRate,
          voucherRef,
          loanType: ctx.appType === 'goldloan' ? 'gold' : loanType,
          collateralDetails,
          totalPayable,
          guarantorId: currentGuarantorId,
          totalInstalments: tenure
        }
      });

      if (ctx.appType === 'goldloan') {
        const goldBody = body.goldCollateral || {};
        await tx.goldLoanCollateral.upsert({
          where: { loanId },
          update: {
            packetNo: goldBody.packetNo || null,
            ornamentDescription: goldBody.ornamentDescription || null,
            grossWeightGrams: Number(goldBody.grossWeightGrams) || 0,
            netWeightGrams: Number(goldBody.netWeightGrams) || 0,
            purityKarat: goldBody.purityKarat || '22K',
            marketRatePerGram: goldBody.marketRatePerGram ? Number(goldBody.marketRatePerGram) : null,
            assessedValue: goldBody.assessedValue ? Number(goldBody.assessedValue) : null,
            eligibleLtvPercent: goldBody.eligibleLtvPercent ? Number(goldBody.eligibleLtvPercent) : null,
            storageLocation: goldBody.storageLocation || null,
            valuerName: goldBody.valuerName || null,
            valuationDate: goldBody.valuationDate ? new Date(goldBody.valuationDate) : null,
            photoPath: goldBody.photoPath || null,
            documentPath: goldBody.documentPath || null
          },
          create: {
            tenantId: ctx.tenantId,
            branchId: loan.branchId,
            loanId,
            customerId: loan.customerId,
            packetNo: goldBody.packetNo || null,
            ornamentDescription: goldBody.ornamentDescription || null,
            grossWeightGrams: Number(goldBody.grossWeightGrams) || 0,
            netWeightGrams: Number(goldBody.netWeightGrams) || 0,
            purityKarat: goldBody.purityKarat || '22K',
            marketRatePerGram: goldBody.marketRatePerGram ? Number(goldBody.marketRatePerGram) : null,
            assessedValue: goldBody.assessedValue ? Number(goldBody.assessedValue) : null,
            eligibleLtvPercent: goldBody.eligibleLtvPercent ? Number(goldBody.eligibleLtvPercent) : null,
            storageLocation: goldBody.storageLocation || null,
            valuerName: goldBody.valuerName || null,
            valuationDate: goldBody.valuationDate ? new Date(goldBody.valuationDate) : null,
            photoPath: goldBody.photoPath || null,
            documentPath: goldBody.documentPath || null,
            releaseStatus: 'pledged'
          }
        });

        await tx.loan.update({
          where: { id: loanId },
          data: {
            collateralDetails: JSON.stringify(goldBody)
          }
        });
      }

      if (coreChanged) {
        await tx.instalment.deleteMany({ where: { loanId } });

        const instalments = calculation.schedule.map((item) => ({
          loanId,
          instalmentNo: item.instalmentNo,
          dueDate: new Date(item.dueDate),
          dueAmount: item.dueAmount,
          status: 'upcoming' as const,
        }));

        await tx.instalment.createMany({ data: instalments });

        await tx.loan.update({
          where: { id: loanId },
          data: { paidCount: 0 },
        });
      }
    });

    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'loan',
      entityId: loanId,
      newValue: { principal, tenure, coreChanged }
    });

    return ok({ success: true });
  } catch (e: any) {
    console.error('[/api/v1/loans/[id] PUT]', e);
    return fail(e?.message ?? 'Loan update failed', 500);
  }
}
