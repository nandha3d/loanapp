import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext, resolveWriteBranchId, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { buildAgentCustomerAccessWhere, canAgentAccessCustomer, canCreateLoanForRole, validateLoanNumericInputs } from '@/lib/loanPolicy';
import { InsufficientFloatError, disburseFromAgent, disburseFromBranch } from '@/lib/wallet';
import { isBulletTerm, isInterestOnly } from '@/lib/loanCalculator';
import { isBulletTermEnabled, isInterestOnlyEnabled } from '@/lib/features';
import { buildHpOriginationTerms } from '@/lib/autofinance/origination';
import { validateGoldOrigination } from '@/lib/gold/origination';
import { ornamentTotals, resolveOrnamentLine } from '@/lib/gold/ornaments';
import { nextContractCode } from '@/lib/origination/contractNumber';
import {
  AccountingConfigurationError,
  postLoanOrigination,
} from '@/lib/accounting/originationPosting';

class OriginationInputError extends Error {}

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');
  const status = searchParams.get('status');
  const q = searchParams.get('q') || '';
  const frequency = searchParams.get('frequency') || '';
  const sort = searchParams.get('sort') || 'id';
  const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');

  const where: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    AND: [],
  };

  if (customerId) where.customerId = customerId;
  if (status) where.status = status;
  if (frequency) where.frequency = frequency;

  if (ctx.role === 'agent') {
    // Agents scope by customer-linkage, NOT branch — a branch pin falsely hides
    // their customers' loans with branchId = null or in another branch.
    where.AND.push({ customer: buildAgentCustomerAccessWhere({ userId: ctx.userId }) });
  } else {
    // Strictly the caller's own branch — never the filing staff member's.
    where.AND.push(scopedBranchWhere(ctx));
  }

  if (q) {
    where.AND.push({
      OR: [
        { loanCode: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { customerCode: { contains: q } } },
        { customer: { phone: { contains: q } } },
        // Auto Finance: field staff search by partial vehicle number.
        { vehicle: { registrationNo: { contains: q } } },
      ],
    });
  }

  // Auto Finance universal directory filters. Each is independent so the panel
  // can combine status × vehicle type × dealer × broker × seized.
  const vehicleType = searchParams.get('vehicleType');
  const brokerId = searchParams.get('brokerId');
  const dealerId = searchParams.get('dealerId');
  const seized = searchParams.get('seized');

  if (vehicleType) where.AND.push({ vehicle: { vehicleType } });
  if (brokerId) where.brokerId = brokerId;
  if (dealerId) where.dealerId = dealerId;
  if (seized === 'true') where.AND.push({ vehicle: { repoFlag: true } });
  if (seized === 'false') where.AND.push({ vehicle: { repoFlag: false } });

  if (where.AND.length === 0) delete where.AND;

  // Sorting
  const orderByMap: Record<string, any> = {
    id: { id: dir },
    loanCode: { loanCode: dir },
    customer: { customer: { name: dir } },
    principal: { principal: dir },
    frequency: { frequency: dir },
    startDate: { startDate: dir },
    paid: { totalCollected: dir },
    progress: { paidCount: dir },
    status: { status: dir },
    createdAt: { createdAt: dir },
  };
  const orderBy = orderByMap[sort] || { id: 'desc' };

  try {
    if (pageParam) {
      // Offset pagination
      const page = Math.max(1, parseInt(pageParam) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(limitParam || '20') || 20));
      const skip = (page - 1) * limit;

      const [total, rows] = await Promise.all([
        prisma.loan.count({ where }),
        prisma.loan.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            customer: { select: { id: true, name: true, customerCode: true, phone: true, profilePhoto: true, route: { select: { id: true, name: true } } } },
            // Auto Finance grid/list views show the financed vehicle inline.
            vehicle: { select: { id: true, registrationNo: true, make: true, model: true, vehicleType: true, repoFlag: true } },
            instalments: {
              where: { status: { in: ['upcoming', 'partial', 'missed'] } },
              orderBy: { dueDate: 'asc' },
              take: 1,
            },
          },
        }),
      ]);

      return ok(rows, {
        page,
        limit,
        total,
        pageSize: limit,
      });
    } else {
      // Cursor pagination
      const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 20, maxLimit: 100 });
      const rows = await prisma.loan.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, customerCode: true, phone: true, profilePhoto: true, route: { select: { id: true, name: true } } } },
          vehicle: { select: { id: true, registrationNo: true, make: true, model: true, vehicleType: true, repoFlag: true } },
          instalments: {
            where: { status: { in: ['upcoming', 'partial', 'missed'] } },
            orderBy: { dueDate: 'asc' },
            take: 1,
          },
        },
        orderBy: { id: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]!.id : null;
      return ok(data, { nextCursor, limit });
    }
  } catch (e: any) {
    console.error('[/api/v1/loans GET]', e);
    return fail(e?.message ?? 'Loans list failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!canCreateLoanForRole(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const customerId = String(body.customerId || '');
    const startDateStr = body.startDate || new Date().toISOString();
    const startDate = new Date(startDateStr);
    const autoFinanceInput: any = body.autoFinance;
    let hpTerms: ReturnType<typeof buildHpOriginationTerms> | null = null;
    if (autoFinanceInput && typeof autoFinanceInput === 'object') {
      try {
        hpTerms = buildHpOriginationTerms({
          vehicleValue: Number(autoFinanceInput.vehicleValue),
          downPayment: Number(autoFinanceInput.downPayment ?? 0),
          interestRate: Number(autoFinanceInput.interestRate ?? 0),
          interestMethod: autoFinanceInput.interestMethod,
          tenureMonths: Number(body.tenure),
          roundOffEmi: Boolean(autoFinanceInput.roundOffEmi),
          startDate,
          firstDueDate: autoFinanceInput.firstDueDate ?? null,
          dueDay: body.dueDay != null ? Number(body.dueDay) : null,
          handLoanAmount: Number(autoFinanceInput.handLoanAmount ?? 0),
          insuranceCharge: Number(autoFinanceInput.insuranceCharge ?? 0),
          documentCharge: Number(autoFinanceInput.documentCharge ?? 0),
          brokerCommission: Number(autoFinanceInput.brokerCommission ?? 0),
          payoutMode1: autoFinanceInput.payoutMode1 ?? null,
          payoutAmount1: autoFinanceInput.payoutAmount1,
          payoutMode2: autoFinanceInput.payoutMode2 ?? null,
          payoutAmount2: autoFinanceInput.payoutAmount2,
        });
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Invalid HP terms', 400);
      }
    }
    const principal = hpTerms?.principal ?? Number(body.principal);
    const rate = hpTerms
      ? Number(autoFinanceInput.interestRate ?? 0)
      : Number(body.deduction ?? body.interestRate ?? 0);
    const deductionType = hpTerms?.deductionType ?? String(
      body.deductionType ?? body.interestType ?? 'upfront_fixed',
    );
    const tenure = hpTerms?.schedule.length ?? Number(body.tenure);
    const frequency = hpTerms ? 'monthly' : String(body.frequency || 'daily');
    const penaltyRate = hpTerms
      ? Number(autoFinanceInput.penaltyPerDay ?? 0)
      : Number(body.penaltyRate ?? 0);
    // Term axis (STABLE-2): absent means 'scheduled', which is the shape every
    // caller written before this field existed already sends. HP terms build
    // their own amortising schedule and are always scheduled.
    const termType = hpTerms ? 'scheduled' : String(body.termType || 'scheduled');
    const termDays = body.termDays != null ? Number(body.termDays) : null;
    const loanType = String(body.loanType || 'cheque');
    const collateralDetails: string | null = body.collateralDetails ?? null;
    const voucherRef: string | null = body.voucherRef ?? null;
    const dueDay = body.dueDay != null ? Number(body.dueDay) : null;
    const guarantorInput = body.guarantor as
      | {
          name?: string;
          phone?: string;
          aadharNumber?: string;
          address?: string;
          relation?: string;
          photoUrl?: string;
        }
      | undefined;
    const cheques = Array.isArray(body.securityCheques)
      ? (body.securityCheques as Array<{
          bankName?: string;
          chequeNumber?: string;
          amount?: number;
          imageUrl?: string;
        }>)
      : [];

    if (!customerId || !principal || !tenure) {
      return fail('customerId, principal, tenure required', 400);
    }
    const numeric = validateLoanNumericInputs({
      principal,
      rate,
      tenure,
      penaltyRate,
    });
    if (!numeric.valid) return fail(numeric.error, 400);

    // Interest-Only is opt-in per tenant. Enforced here and not only in the UI —
    // the form is one of several ways into this route (mobile, API clients).
    if (isInterestOnly(deductionType) && !(await isInterestOnlyEnabled(ctx.tenantId))) {
      return fail('Interest-Only is not enabled for this account', 403);
    }
    // Same shape as Interest-Only: opt-in per tenant, enforced here because the
    // web form is one of several ways into this route.
    if (isBulletTerm(termType) && !(await isBulletTermEnabled(ctx.tenantId))) {
      return fail('Single-payment (bullet) loans are not enabled for this account', 403);
    }
    if (Number.isNaN(startDate.getTime())) {
      return fail('Invalid start date', 400);
    }
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        // Match the list scope, or an admin could see a customer they then
        // could not raise a loan for.
        ...scopedBranchWhere(ctx),
      },
    });
    if (!customer) return fail('Customer not found', 404);

    if (ctx.role === 'agent') {
      const routeIds = await getAgentRouteIds(ctx.userId);
      if (!canAgentAccessCustomer(customer, routeIds, ctx.userId)) {
        return fail('Forbidden', 403);
      }
    }

    if (voucherRef) {
      const dup = await prisma.loan.findFirst({
        where: { tenantId: ctx.tenantId, voucherRef },
      });
      if (dup) return fail(`Voucher reference "${voucherRef}" already used`, 409);
    }

    // Auto Finance (HP): broker/dealer must belong to this tenant and be of the
    // right kind, otherwise a crafted id could link a loan across tenants.
    const brokerId: string | null = body.brokerId || null;
    const dealerId: string | null = body.dealerId || null;
    for (const [id, kind] of [[brokerId, 'broker'], [dealerId, 'dealer']] as const) {
      if (!id) continue;
      const partner = await prisma.financePartner.findFirst({
        where: { id, tenantId: ctx.tenantId, type: kind, deletedAt: null },
        select: { id: true },
      });
      if (!partner) return fail(`Selected ${kind} not found`, 404);
    }

    // Vehicle registration is unique per tenant+module; reject early so the
    // wizard reports a clean error instead of failing after the loan is made.
    const vehicleInput: any = body.vehicle;
    if (vehicleInput?.registrationNo) {
      const existingVehicle = await prisma.vehicle.findFirst({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          registrationNo: String(vehicleInput.registrationNo).trim().toUpperCase(),
        },
        select: { id: true },
      });
      if (existingVehicle) {
        return fail(`Vehicle ${vehicleInput.registrationNo} is already registered`, 409);
      }
    }

    const { calculateLoanPreview } = await import('@/lib/loanCalculator');
    const preview = hpTerms
      ? {
          principal: hpTerms.principal,
          deduction: hpTerms.deduction,
          disbursedAmount: hpTerms.disbursedAmount,
          totalPayable: hpTerms.totalPayable,
          perInstalment: hpTerms.perInstalment,
          schedule: hpTerms.schedule.map((row) => ({
            instalmentNo: row.instalmentNo,
            dueDate: row.dueDate,
            dueAmount: row.dueAmount,
            principalComponent: row.principalComponent,
            interestComponent: row.interestComponent,
          })),
        }
      : calculateLoanPreview({
          principal,
          interestType: deductionType,
          interestRate: rate,
          tenure,
          frequency,
          startDate,
          dueDay,
          termType,
          termDays,
        });

    const goldInput: any = body.goldCollateral;
    let goldOrigination: null | {
      items: any[];
      grossWeightGrams: number;
      netWeightGrams: number;
      assessedValue: number;
      validation: ReturnType<typeof validateGoldOrigination>;
    } = null;
    if (ctx.appType === 'goldloan' && (!goldInput || typeof goldInput !== 'object')) {
      return fail('Gold or silver collateral is required for a gold loan', 400);
    }
    if (goldInput && typeof goldInput === 'object') {
      const items = Array.isArray(goldInput.items) ? goldInput.items : [];
      const totals = ornamentTotals(items);
      const grossWeightGrams = items.length > 0
        ? totals.totalGrossWeight
        : Number(goldInput.grossWeightGrams ?? 0);
      const netWeightGrams = items.length > 0
        ? totals.totalNetWeight
        : Number(goldInput.netWeightGrams ?? 0);
      const assessedValue = totals.totalValue > 0
        ? totals.totalValue
        : Number(goldInput.assessedValue ?? 0);
      if (!(grossWeightGrams > 0) || !(netWeightGrams > 0)) {
        return fail('Gross and net collateral weights must be greater than zero', 400);
      }
      if (netWeightGrams > grossWeightGrams) {
        return fail('Net collateral weight cannot exceed gross weight', 400);
      }

      const existingGoldLoans = await prisma.loan.findMany({
        where: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          customerId,
          status: { in: ['active', 'pending_review'] },
          goldCollateral: { isNot: null },
        },
        select: { principal: true, outstandingPrincipal: true },
      });
      const existingExposure = existingGoldLoans.reduce(
        (sum, existing) => sum + Number(existing.outstandingPrincipal ?? existing.principal),
        0,
      );
      try {
        const validation = validateGoldOrigination({
          assessedValue,
          requestedPrincipal: principal,
          totalPayableAtMaturity: preview.totalPayable,
          repaymentModel: goldInput.repaymentModel === 'bullet' ? 'bullet' : 'amortizing',
          requestedLtvPercent: goldInput.eligibleLtvPercent,
          borrowerExistingConsumptionExposure: existingExposure,
        });
        goldOrigination = {
          items,
          grossWeightGrams,
          netWeightGrams,
          assessedValue,
          validation,
        };
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Invalid gold LTV', 400);
      }
    }

    let bypassLoanApproval = false;
    let autoReleaseFloat = true;
    if (ctx.role === 'agent') {
       const agentUser = await prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { bypassLoanApproval: true, autoReleaseFloat: true }
       });
       bypassLoanApproval = agentUser?.bypassLoanApproval === true;
       autoReleaseFloat = agentUser?.autoReleaseFloat !== false;
    } else {
       // Non-agents (admin/superadmin/manager/...) keep their original
       // privileges: loans go straight to active and float auto-releases. The
       // agent permission toggles must NEVER gate non-agent users.
       bypassLoanApproval = true;
       autoReleaseFloat = true;
    }
    // Loan starts active when approval is bypassed, else waits for review.
    // (This was referenced at create time but never declared — loan creation
    // 500'd with "status is not defined" until now.)
    const status = bypassLoanApproval ? 'active' : 'pending_review';
    const { getBranding } = await import('@/lib/tenant');
    const branding = await getBranding(ctx.tenantId);
    // Frequency-specific prefixes (DL/WL/BWL/ML); tenant prefix is the fallback
    // for any other/legacy frequency value.
    const FREQUENCY_PREFIX: Record<string, string> = {
      daily: 'DL',
      weekly: 'WL',
      biweekly: 'BWL',
      monthly: 'ML',
    };
    // A bullet loan has no cadence, so its contract number is keyed on the term
    // shape instead. Existing prefixes are untouched (ORIG-1: the counter behind
    // them stays tenant-wide either way).
    const contractPrefix = isBulletTerm(termType)
      ? 'BTL'
      : FREQUENCY_PREFIX[frequency] ?? branding.loanCodePrefix;
    // A loan belongs where its CUSTOMER sits, not where the person raising it
    // sits. Resolved before the transaction so the lookup it may need never
    // widens the write window.
    const loanBranchId = await resolveWriteBranchId(ctx, customer.branchId);

    const result = await prisma.$transaction(async (tx) => {
      // Tenant-wide, no appType in the key: loan codes are unique per tenant, so
      // the counter behind them must be too. appType is passed for reference only
      // and is never used as scope (see nextContractCode, rule ORIG-1).
      const loanCode = await nextContractCode(tx, {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        prefix: contractPrefix,
      });

      if (goldOrigination) {
        const existingGoldLoans = await tx.loan.findMany({
          where: {
            tenantId: ctx.tenantId,
            appType: ctx.appType,
            customerId,
            status: { in: ['active', 'pending_review'] },
            goldCollateral: { isNot: null },
          },
          select: { principal: true, outstandingPrincipal: true },
        });
        const existingExposure = existingGoldLoans.reduce(
          (sum, existing) => sum + Number(existing.outstandingPrincipal ?? existing.principal),
          0,
        );
        try {
          goldOrigination.validation = validateGoldOrigination({
            assessedValue: goldOrigination.assessedValue,
            requestedPrincipal: principal,
            totalPayableAtMaturity: preview.totalPayable,
            repaymentModel: goldInput.repaymentModel === 'bullet' ? 'bullet' : 'amortizing',
            requestedLtvPercent: goldInput.eligibleLtvPercent,
            borrowerExistingConsumptionExposure: existingExposure,
          });
        } catch (error) {
          throw new OriginationInputError(
            error instanceof Error ? error.message : 'Invalid gold LTV',
          );
        }
      }

      let guarantorId: string | null = null;
      if (guarantorInput?.name && guarantorInput?.phone) {
        const { encryptAadharNumber } = await import('@/lib/pii');
        const g = await tx.guarantor.create({
        data: {
          customerId,
          name: guarantorInput.name,
          phone: guarantorInput.phone,
          aadharNumber: guarantorInput.aadharNumber
            ? encryptAadharNumber(guarantorInput.aadharNumber)
            : null,
          address: guarantorInput.address || null,
          relation: guarantorInput.relation || null,
          photo: guarantorInput.photoUrl || null,
        },
      });
        guarantorId = g.id;
      }

    // HP deals commonly carry two or three guarantors. Only the first is the
    // loan's guarantor of record; the rest are attached to the customer so they
    // show up on the Customer 360° guarantors tab.
    const extraGuarantors = Array.isArray(body.additionalGuarantors)
      ? (body.additionalGuarantors as Array<Record<string, string>>)
      : [];
    if (extraGuarantors.length > 0) {
      const { encryptAadharNumber } = await import('@/lib/pii');
      await tx.guarantor.createMany({
        data: extraGuarantors
          .filter((g) => g?.name && g?.phone)
          .map((g) => ({
            customerId,
            name: g.name,
            phone: g.phone,
            aadharNumber: g.aadharNumber ? encryptAadharNumber(g.aadharNumber) : null,
            address: g.address || null,
            relation: g.relation || null,
          })),
      });
    }

    const chequeData = cheques
      .filter((c) => c.bankName && c.chequeNumber)
      .map((c) => ({
        customerId,
        bankName: String(c.bankName),
        chequeNumber: String(c.chequeNumber),
        amount: c.amount != null ? Number(c.amount) : null,
        imagePath: c.imageUrl || null,
      }));

    const loan = await tx.loan.create({
      data: {
        tenantId: ctx.tenantId,
        // The customer's branch, NOT the raiser's. Taking the raiser's first put
        // every loan a superadmin raised onto the superadmin's own branch: that
        // branch's admin saw loans belonging to other branches, and the owning
        // branch's admin lost both the loan and its approval notification.
        branchId: loanBranchId,
        appType: ctx.appType,
        loanCode,
        customerId,
        loanType,
        collateralDetails,
        guarantorId,
        principal,
        deduction: preview.deduction,
        deductionType,
        disbursed: preview.disbursedAmount,
        frequency,
        dueDay,
        tenure,
        termType,
        // Only meaningful for a bullet term; stays null for every cadence loan
        // so the column reads the same as it did before it existed.
        termDays: isBulletTerm(termType) ? termDays : null,
        startDate,
        // For a bullet term the last (only) schedule row IS the maturity, so this
        // keeps working unchanged.
        endDate: new Date(preview.schedule[preview.schedule.length - 1].dueDate),
        perInstalment: preview.perInstalment,
        penaltyRate,
        voucherRef,
        totalPayable: preview.totalPayable,
        totalInstalments: preview.schedule.length,
        createdById: ctx.userId,
        status,
        brokerId,
        dealerId,
        productFamily: hpTerms
          ? 'hire_purchase'
          : goldOrigination
            ? 'gold_pledge'
            : null,
        ...(hpTerms
          ? { termsSnapshot: {
              version: 'HP_TERMS_V1',
              vehicleValue: Number(autoFinanceInput.vehicleValue),
              downPayment: Number(autoFinanceInput.downPayment ?? 0),
              interestMethod: autoFinanceInput.interestMethod === 'diminishing' ? 'diminishing' : 'flat',
              interestRate: rate,
              tenureMonths: tenure,
              totalInterest: hpTerms.totalInterest,
              totalPayable: hpTerms.totalPayable,
              grossPayout: hpTerms.grossPayout,
              recoveredCharges: hpTerms.recoveredCharges,
              netPayout: hpTerms.netPayout,
              payoutLegs: hpTerms.payoutLegs,
            } }
          : {}),
        ...(goldOrigination
          ? { policySnapshot: {
              version: 'RBI_GOLD_SILVER_2025_V1',
              maximumLtvPercent: goldOrigination.validation.maximumLtvPercent,
              appliedLtvPercent: goldOrigination.validation.appliedLtvPercent,
              eligibleAmount: goldOrigination.validation.eligibleAmount,
              exposureForLtv: goldOrigination.validation.exposureForLtv,
            } }
          : {}),
        // Interest-Only servicing state. The rate must survive origination because
        // interest is recomputed whenever principal is prepaid; every other model
        // keeps only the rate's result, so both stay null for them.
        ...(isInterestOnly(deductionType)
          ? { interestRate: rate, outstandingPrincipal: principal }
          : {}),
        instalments: {
          create: preview.schedule.map((i: any) => ({
            instalmentNo: i.instalmentNo,
            dueDate: new Date(i.dueDate),
            dueAmount: i.dueAmount,
            principalComponent: i.principalComponent ?? null,
            interestComponent: i.interestComponent ?? null,
            status: 'upcoming',
          })),
        },
        ...(chequeData.length > 0
          ? { securityCheques: { create: chequeData } }
          : {}),
      },
      include: { instalments: true, customer: true },
    });

    await tx.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'loan',
        entityId: loan.id,
        newValue: JSON.stringify({ loanCode, principal, customerId }),
      },
    });

    // Gold/Silver pledge: collateral and ornament rows are part of the same
    // transaction as the loan, schedule, wallet debit and accounting entry.
    if (goldInput && typeof goldInput === 'object' && goldOrigination) {
        const itemsInput = goldOrigination.items;
        await tx.goldLoanCollateral.create({
          data: {
            tenantId: ctx.tenantId,
            branchId: loan.branchId,
            loanId: loan.id,
            customerId,
            packetNo: goldInput.packetNo ?? null,
            ornamentDescription: goldInput.ornamentDescription ?? null,
            grossWeightGrams: goldOrigination.grossWeightGrams,
            netWeightGrams: goldOrigination.netWeightGrams,
            purityKarat: String(goldInput.purityKarat ?? itemsInput[0]?.purityKarat ?? '22K'),
            marketRatePerGram: goldInput.marketRatePerGram != null ? Number(goldInput.marketRatePerGram) : null,
            assessedValue: goldOrigination.assessedValue,
            eligibleLtvPercent: goldOrigination.validation.appliedLtvPercent,
            eligibleAmount: goldOrigination.validation.eligibleAmount,
            ltvAtOrigination: (goldOrigination.validation.exposureForLtv / goldOrigination.assessedValue) * 100,
            policySnapshot: {
              version: 'RBI_GOLD_SILVER_2025_V1',
              purpose: 'consumption',
              repaymentModel: goldInput.repaymentModel === 'bullet' ? 'bullet' : 'amortizing',
              maximumLtvPercent: goldOrigination.validation.maximumLtvPercent,
              appliedLtvPercent: goldOrigination.validation.appliedLtvPercent,
              borrowerConsumptionExposure: goldOrigination.validation.borrowerConsumptionExposure,
              exposureForLtv: goldOrigination.validation.exposureForLtv,
            },
            storageLocation: goldInput.storageLocation ?? null,
            valuerName: goldInput.valuerName ?? null,
            valuationDate: goldInput.valuationDate ? new Date(goldInput.valuationDate) : null,
            photoPath: goldInput.photoPath ?? null,
            documentPath: goldInput.documentPath ?? null,
            ...(itemsInput.length > 0
              ? {
                  items: {
                    create: itemsInput.map((it: any, idx: number) => {
                      const line = resolveOrnamentLine({
                        quantity: Number(it.quantity),
                        grossWeightGrams: Number(it.grossWeightGrams),
                        wastageGrams: Number(it.wastageGrams),
                        netWeightGrams: it.netWeightGrams != null ? Number(it.netWeightGrams) : undefined,
                        ratePerGram: Number(it.ratePerGram),
                      });
                      return {
                        tenantId: ctx.tenantId,
                        ornamentType: String(it.ornamentType ?? ''),
                        specification: it.specification ?? null,
                        purityKarat: it.purityKarat ?? null,
                        quantity: line.quantity,
                        grossWeightGrams: line.grossWeightGrams,
                        wastageGrams: line.wastageGrams,
                        netWeightGrams: line.netWeightGrams,
                        ratePerGram: line.ratePerGram,
                        value: line.value,
                        bankName: it.bankName ?? null,
                        refNo: it.refNo ?? null,
                        photoPath: it.photoPath ?? null,
                        sortOrder: idx,
                      };
                    }),
                  },
                }
              : {}),
          },
        });
    }

    // Property collateral (mortgage).
    const propertyInput: any = body.propertyCollateral;
    if (propertyInput && typeof propertyInput === 'object') {
        await tx.propertyCollateral.create({
          data: {
            tenantId: ctx.tenantId,
            branchId: loan.branchId,
            loanId: loan.id,
            customerId,
            propertyType: propertyInput.propertyType ?? null,
            address: propertyInput.address ?? null,
            surveyNo: propertyInput.surveyNo ?? null,
            extentValue: propertyInput.extentValue != null ? Number(propertyInput.extentValue) : null,
            extentUnit: propertyInput.extentUnit ?? null,
            marketValue: propertyInput.marketValue != null ? Number(propertyInput.marketValue) : null,
            eligibleLtvPercent: propertyInput.eligibleLtvPercent != null ? Number(propertyInput.eligibleLtvPercent) : null,
            eligibleAmount: propertyInput.eligibleAmount != null ? Number(propertyInput.eligibleAmount) : null,
            encumbranceStatus: propertyInput.encumbranceStatus ?? null,
            registrationNo: propertyInput.registrationNo ?? null,
            valuerName: propertyInput.valuerName ?? null,
            valuationDate: propertyInput.valuationDate ? new Date(propertyInput.valuationDate) : null,
            titleDeedPath: propertyInput.titleDeedPath ?? null,
            ecPath: propertyInput.ecPath ?? null,
            taxReceiptPath: propertyInput.taxReceiptPath ?? null,
            photoPath: propertyInput.photoPath ?? null,
          },
        });
    }

    // Product-finance item.
    const productInput: any = body.productItem ?? body.productFinanceItem;
    if (productInput && typeof productInput === 'object') {
        await tx.productFinanceItem.create({
          data: {
            tenantId: ctx.tenantId,
            branchId: loan.branchId,
            loanId: loan.id,
            customerId,
            category: productInput.category ?? null,
            productName: productInput.productName ?? null,
            brand: productInput.brand ?? null,
            modelNo: productInput.modelNo ?? null,
            serialNo: productInput.serialNo ?? null,
            dealerName: productInput.dealerName ?? null,
            dealerId: productInput.dealerId ?? null,
            invoiceNo: productInput.invoiceNo ?? null,
            invoiceAmount: productInput.invoiceAmount != null ? Number(productInput.invoiceAmount) : null,
            downPayment: productInput.downPayment != null ? Number(productInput.downPayment) : null,
            financedAmount: productInput.financedAmount != null ? Number(productInput.financedAmount) : null,
            tenureMonths: productInput.tenureMonths != null ? Number(productInput.tenureMonths) : null,
            warrantyExpiry: productInput.warrantyExpiry ? new Date(productInput.warrantyExpiry) : null,
            invoicePath: productInput.invoicePath ?? null,
            photoPath: productInput.photoPath ?? null,
          },
        });
    }

    // Auto Finance (HP): financial configuration + the financed vehicle, both
    // created in the same origination call so the 4-step wizard is one
    // transaction from the operator's point of view. Any failure rolls the
    // complete origination back.
    if (autoFinanceInput && typeof autoFinanceInput === 'object') {
        await tx.autoFinanceDetail.create({
          data: {
            tenantId: ctx.tenantId,
            loanId: loan.id,
            vehicleValue: autoFinanceInput.vehicleValue != null ? Number(autoFinanceInput.vehicleValue) : null,
            downPayment: autoFinanceInput.downPayment != null ? Number(autoFinanceInput.downPayment) : null,
            interestMethod: autoFinanceInput.interestMethod === 'diminishing' ? 'diminishing' : 'flat',
            interestRate: autoFinanceInput.interestRate != null ? Number(autoFinanceInput.interestRate) : null,
            roundOffEmi: Boolean(autoFinanceInput.roundOffEmi),
            gracePeriodDays: Number(autoFinanceInput.gracePeriodDays) || 0,
            penaltyPerDay: Number(autoFinanceInput.penaltyPerDay) || 0,
            handLoanAmount: Number(autoFinanceInput.handLoanAmount) || 0,
            insuranceCharge: Number(autoFinanceInput.insuranceCharge) || 0,
            documentCharge: Number(autoFinanceInput.documentCharge) || 0,
            brokerCommission: Number(autoFinanceInput.brokerCommission) || 0,
            payoutMode1: autoFinanceInput.payoutMode1 || null,
            payoutAmount1: autoFinanceInput.payoutAmount1 != null ? Number(autoFinanceInput.payoutAmount1) : null,
            payoutMode2: autoFinanceInput.payoutMode2 || null,
            payoutAmount2: autoFinanceInput.payoutAmount2 != null ? Number(autoFinanceInput.payoutAmount2) : null,
            grossPayout: hpTerms?.grossPayout ?? null,
            recoveredCharges: hpTerms?.recoveredCharges ?? null,
            netPayout: hpTerms?.netPayout ?? null,
          },
        });
    }

    if (vehicleInput && typeof vehicleInput === 'object' && vehicleInput.registrationNo) {
        const vehicle = await tx.vehicle.create({
          data: {
            tenantId: ctx.tenantId,
            appType: ctx.appType,
            customerId,
            loanId: loan.id,
            registrationNo: String(vehicleInput.registrationNo).trim().toUpperCase(),
            make: vehicleInput.make || '—',
            model: vehicleInput.model || '—',
            year: vehicleInput.year != null ? Number(vehicleInput.year) : null,
            vehicleType: vehicleInput.vehicleType || 'two_wheeler',
            engineNo: vehicleInput.engineNo || null,
            chassisNo: vehicleInput.chassisNo || null,
            color: vehicleInput.color || null,
            rcDocPath: vehicleInput.rcDocPath || null,
            insurancePath: vehicleInput.insurancePath || null,
            insuranceExpiry: vehicleInput.insuranceExpiry ? new Date(vehicleInput.insuranceExpiry) : null,
            status: 'active',
          },
        });

        const photos: any[] = Array.isArray(vehicleInput.photos) ? vehicleInput.photos : [];
        const photoRows = photos
          .filter((p) => p?.path)
          .map((p) => ({
            tenantId: ctx.tenantId,
            vehicleId: vehicle.id,
            kind: p.kind || 'vehicle',
            path: String(p.path),
            caption: p.caption || null,
          }));
        if (photoRows.length > 0) {
          await tx.vehiclePhoto.createMany({ data: photoRows });
        }
    }

    // Only cash payout legs move the physical float. Bank, UPI, cheque and DD
    // legs remain visible in the operational cash book and statutory journal.
    const shouldDisburse = loan.status === 'active' && (ctx.role === 'agent' || autoReleaseFloat);
    if (shouldDisburse) {
      const disburseAmt = hpTerms?.cashPayout ?? Number(preview.disbursedAmount);
      if (ctx.role === 'agent') {
        await disburseFromAgent(tx, {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          agentId: ctx.userId,
          amount: disburseAmt,
          loanId: loan.id,
          byUserId: ctx.userId,
        });
      } else if (loan.branchId) {
        await disburseFromBranch(tx, {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          branchId: loan.branchId,
          amount: disburseAmt,
          loanId: loan.id,
          byUserId: ctx.userId,
        });
      } else {
        throw new OriginationInputError('Branch is required to fund an active loan');
      }
    }

    if (loan.status === 'active') {
      const payoutLegs = hpTerms?.payoutLegs ?? [
        { mode: 'cash', amount: Number(preview.disbursedAmount) },
      ];
      await tx.accountEntry.createMany({
        data: payoutLegs.map((leg) => ({
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          branchId: loan.branchId || undefined,
          entryDate: startDate,
          type: 'loan_disburse',
          category: leg.mode,
          amount: leg.amount,
          description: `Loan ${loanCode} disbursed to customer via ${leg.mode}`,
          referenceId: loan.id,
          referenceType: 'loan',
          createdBy: ctx.userId,
        })),
      });
      await postLoanOrigination(tx, {
        tenantId: ctx.tenantId,
        branchId: loan.branchId,
        loanId: loan.id,
        loanCode,
        customerId,
        createdById: ctx.userId,
        entryDate: startDate,
        principal,
        disbursedAmount: Number(preview.disbursedAmount),
        payoutLegs,
        upfrontCreditKey: hpTerms ? 'processing_fee_income' : 'interest_income',
      });
    }

      return { loan, loanCode };
    }, { isolationLevel: 'Serializable' });

    const { loan, loanCode } = result;
    if (status === 'pending_review') {
      const { notifyApprovers } = await import('@/lib/notify/approvers');
      const { modulePath } = await import('@/types/modules');
      await notifyApprovers({
        tenantId: ctx.tenantId,
        branchId: loan.branchId,
        requesterBranchId: ctx.branchId,
        requesterRole: ctx.role,
        appType: ctx.appType,
        type: 'approval_pending',
        icon: 'account_balance',
        title: 'Loan awaiting approval',
        message: `Loan ${loanCode} (${loan.customer?.name ?? 'customer'}) was submitted and needs review.`,
        link: modulePath(ctx.appType, '/approvals'),
      });
    }

    return ok(loan);
  } catch (e: any) {
    console.error('[/api/v1/loans POST]', e);
    if (e instanceof OriginationInputError) return fail(e.message, 400);
    if (e instanceof InsufficientFloatError) {
      return fail(`Insufficient float: available ${e.available}, required ${e.required}`, 409);
    }
    if (e instanceof AccountingConfigurationError) return fail(e.message, 409);
    return fail(e?.message ?? 'Loan create failed', 500);
  }
}
