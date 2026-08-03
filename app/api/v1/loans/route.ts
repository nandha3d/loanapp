import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { buildAgentCustomerAccessWhere, canAgentAccessCustomer, canCreateLoanForRole, validateLoanNumericInputs } from '@/lib/loanPolicy';
import { getAgentBalance, disburseFromAgent, disburseFromBranch } from '@/lib/wallet';

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
    Object.assign(where, scopedBranchWhere(ctx));
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
    const principal = Number(body.principal);
    const rate = Number(body.deduction ?? body.interestRate ?? 0);
    const deductionType = String(
      body.deductionType ?? body.interestType ?? 'upfront_fixed',
    );
    const tenure = Number(body.tenure);
    const frequency = String(body.frequency || 'daily');
    const startDateStr = body.startDate || new Date().toISOString();
    const startDate = new Date(startDateStr);
    const penaltyRate = Number(body.penaltyRate ?? 0);
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
    if (Number.isNaN(startDate.getTime())) {
      return fail('Invalid start date', 400);
    }
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
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
    const preview = calculateLoanPreview({
      principal,
      interestType: deductionType,
      interestRate: rate,
      tenure,
      frequency,
      startDate,
      dueDay,
    });

    const { calculateEndDate, generateCode } = await import('@/lib/utils');
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
    const count = await prisma.loan.count({
      where: { tenantId: ctx.tenantId, appType: ctx.appType },
    });
    // Frequency-specific prefixes (DL/WL/BWL/ML); tenant prefix is the fallback
    // for any other/legacy frequency value.
    const FREQUENCY_PREFIX: Record<string, string> = {
      daily: 'DL',
      weekly: 'WL',
      biweekly: 'BWL',
      monthly: 'ML',
    };
    const loanCode = generateCode(
      FREQUENCY_PREFIX[frequency] ?? branding.loanCodePrefix,
      count + 1,
      5,
    );
    const endDate = calculateEndDate(startDate, frequency, tenure);

    let guarantorId: string | null = null;
    if (guarantorInput?.name && guarantorInput?.phone) {
      const { encryptAadharNumber } = await import('@/lib/pii');
      const g = await prisma.guarantor.create({
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
      await prisma.guarantor.createMany({
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

    const loan = await prisma.loan.create({
      data: {
        tenantId: ctx.tenantId,
        // Inherit the customer's branch when the creator has none (e.g. a
        // superadmin with no branch) so loans are never branchless and stay
        // visible in branch-scoped views.
        branchId: ctx.branchId ?? customer.branchId ?? null,
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
        startDate,
        endDate: new Date(preview.schedule[preview.schedule.length - 1].dueDate),
        perInstalment: preview.perInstalment,
        penaltyRate,
        voucherRef,
        totalPayable: preview.totalPayable,
        totalInstalments: tenure,
        createdById: ctx.userId,
        status,
        brokerId,
        dealerId,
        instalments: {
          create: preview.schedule.map((i: any) => ({
            instalmentNo: i.instalmentNo,
            dueDate: new Date(i.dueDate),
            dueAmount: i.dueAmount,
            status: 'upcoming',
          })),
        },
        ...(chequeData.length > 0
          ? { securityCheques: { create: chequeData } }
          : {}),
      },
      include: { instalments: true, customer: true },
    });

    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'loan',
      entityId: loan.id,
      newValue: { loanCode, principal, customerId },
    });

    // Gold/Silver pledge: persist the collateral header + ornament line items
    // when the form sent a structured goldCollateral payload. Additive and
    // best-effort — a gold failure must never roll back an already-created loan.
    const goldInput: any = body.goldCollateral;
    if (goldInput && typeof goldInput === 'object') {
      try {
        const { ornamentTotals, resolveOrnamentLine } = await import('@/lib/gold/ornaments');
        const itemsInput: any[] = Array.isArray(goldInput.items) ? goldInput.items : [];
        const totals = ornamentTotals(itemsInput);
        await prisma.goldLoanCollateral.create({
          data: {
            tenantId: ctx.tenantId,
            branchId: loan.branchId,
            loanId: loan.id,
            customerId,
            packetNo: goldInput.packetNo ?? null,
            ornamentDescription: goldInput.ornamentDescription ?? null,
            grossWeightGrams: totals.totalGrossWeight,
            netWeightGrams: totals.totalNetWeight,
            purityKarat: String(goldInput.purityKarat ?? itemsInput[0]?.purityKarat ?? '22K'),
            marketRatePerGram: goldInput.marketRatePerGram != null ? Number(goldInput.marketRatePerGram) : null,
            assessedValue: totals.totalValue > 0
              ? totals.totalValue
              : (goldInput.assessedValue != null ? Number(goldInput.assessedValue) : null),
            eligibleLtvPercent: goldInput.eligibleLtvPercent != null ? Number(goldInput.eligibleLtvPercent) : null,
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
      } catch (e) {
        console.error('[GOLD_COLLATERAL] persist failed for loan', loan.id, e);
      }
    }

    // Property collateral (mortgage). Additive, best-effort.
    const propertyInput: any = body.propertyCollateral;
    if (propertyInput && typeof propertyInput === 'object') {
      try {
        await prisma.propertyCollateral.create({
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
      } catch (e) {
        console.error('[PROPERTY_COLLATERAL] persist failed for loan', loan.id, e);
      }
    }

    // Product-finance item. Additive, best-effort.
    const productInput: any = body.productItem ?? body.productFinanceItem;
    if (productInput && typeof productInput === 'object') {
      try {
        await prisma.productFinanceItem.create({
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
      } catch (e) {
        console.error('[PRODUCT_ITEM] persist failed for loan', loan.id, e);
      }
    }

    // Auto Finance (HP): financial configuration + the financed vehicle, both
    // created in the same origination call so the 4-step wizard is one
    // transaction from the operator's point of view. Best-effort like the other
    // module side-tables — a failure here must not orphan the loan.
    const autoFinanceInput: any = body.autoFinance;
    if (autoFinanceInput && typeof autoFinanceInput === 'object') {
      try {
        await prisma.autoFinanceDetail.create({
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
          },
        });
      } catch (e) {
        console.error('[AUTO_FINANCE_DETAIL] persist failed for loan', loan.id, e);
      }
    }

    if (vehicleInput && typeof vehicleInput === 'object' && vehicleInput.registrationNo) {
      try {
        const vehicle = await prisma.vehicle.create({
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
          await prisma.vehiclePhoto.createMany({ data: photoRows });
        }
      } catch (e) {
        console.error('[AUTO_FINANCE_VEHICLE] persist failed for loan', loan.id, e);
      }
    }

    if (status === 'pending_review') {
      const { notifyApprovers } = await import('@/lib/notify/approvers');
      const { modulePath } = await import('@/types/modules');
      await notifyApprovers({
        tenantId: ctx.tenantId,
        branchId: loan.branchId,
        appType: ctx.appType,
        type: 'approval_pending',
        icon: 'account_balance',
        title: 'Loan awaiting approval',
        message: `Loan ${loanCode} (${loan.customer?.name ?? 'customer'}) was submitted and needs review.`,
        link: modulePath(ctx.appType, '/approvals'),
      });
    }

    // Disburse cash from the float ledger. An agent physically hands the NET
    // disbursed cash to the customer, so their float ALWAYS drops by that amount
    // when the loan is active (not gated by autoReleaseFloat). Admin/superadmin
    // loans draw from the branch cash pool. Note: `disbursedAmount` is already
    // net of the upfront fee for upfront loans (= principal for EMI loans), so the
    // upfront fee is never deducted from the float.
    const shouldDisburse = loan.status === 'active' && (ctx.role === 'agent' || autoReleaseFloat);
    if (shouldDisburse) {
      try {
        const disburseAmt = Number(preview.disbursedAmount);
        if (ctx.role === 'agent') {
          await prisma.$transaction((tx) =>
            disburseFromAgent(tx, {
              tenantId: ctx.tenantId,
              appType: ctx.appType,
              agentId: ctx.userId,
              amount: disburseAmt,
              loanId: loan.id,
              byUserId: ctx.userId,
            }),
          );
        } else if (loan.branchId) {
          await prisma.$transaction((tx) =>
            disburseFromBranch(tx, {
              tenantId: ctx.tenantId,
              appType: ctx.appType,
              branchId: loan.branchId!,
              amount: disburseAmt,
              loanId: loan.id,
              byUserId: ctx.userId,
            }),
          );
        }
      } catch (err) {
        console.error('[wallet] disbursement debit failed:', err);
      }
    }

    if (loan.status === 'active') {
      await prisma.accountEntry.create({
        data: {
          tenantId: ctx.tenantId,
          appType: ctx.appType,
          branchId: ctx.branchId || undefined,
          entryDate: startDate,
          type: 'loan_disburse',
          category: 'cash',
          amount: preview.disbursedAmount,
          description: `Loan ${loanCode} disbursed to customer`,
          referenceId: loan.id,
          referenceType: 'loan',
          createdBy: ctx.userId,
        },
      }).catch((error) => console.error('Failed to create accounting entry:', error));

      const { autoPostLoanDisburse } = await import('@/lib/accounting/autoPost');
      autoPostLoanDisburse({
        tenantId: ctx.tenantId,
        loanId: loan.id,
        loanCode,
        amount: preview.disbursedAmount,
        date: startDate,
        branchId: ctx.branchId || null,
        createdById: ctx.userId,
        category: 'cash',
      }).catch(() => {});
    }

    return ok(loan);
  } catch (e: any) {
    console.error('[/api/v1/loans POST]', e);
    return fail(e?.message ?? 'Loan create failed', 500);
  }
}
