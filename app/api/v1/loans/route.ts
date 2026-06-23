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
      ],
    });
  }

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
            customer: { select: { id: true, name: true, customerCode: true, phone: true, profilePhoto: true } },
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
          customer: { select: { id: true, name: true, customerCode: true, phone: true, profilePhoto: true } },
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
