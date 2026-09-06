import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, failFromError, HttpError } from '@/lib/api/v1-envelope';
import { requireMobileContext, resolveWriteBranchId, scopedBranchWhere } from '@/lib/api/v1-auth';
import { validateChitConfig, assertValidCommissionPct } from '@/lib/chits/validation';
import { generateCode } from '@/lib/utils';

function dateOrNow(value?: string) {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'startDate is invalid');
  return date;
}

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const groups = await prisma.chitGroup.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
      include: {
        _count: { select: { members: true, auctions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(groups);
  } catch (e: any) {
    return failFromError(e, 'Failed to load chit groups');
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);

  const body = await req.json().catch(() => null) as any;
  const name = body?.name?.trim();
  const chitValue = Number(body?.chitValue);
  const monthlyContrib = Number(body?.monthlyContrib ?? body?.installmentAmount);
  const totalMembers = Number(body?.totalMembers);
  const durationMonths = Number(body?.durationMonths ?? totalMembers);
  const commissionPct = Number(body?.commissionPct ?? 5);
  const memberIds = Array.from(new Set((body?.memberIds ?? []) as string[]));

  if (!name) return fail('name is required', 400);
  if (!Number.isFinite(chitValue) || chitValue <= 0) return fail('chitValue must be greater than zero', 400);
  if (!Number.isFinite(monthlyContrib) || monthlyContrib <= 0) return fail('monthlyContrib must be greater than zero', 400);
  if (!Number.isInteger(totalMembers) || totalMembers <= 0) return fail('totalMembers must be a positive integer', 400);
  if (!Number.isFinite(commissionPct) || commissionPct < 0) return fail('commissionPct must be zero or greater', 400);
  if (memberIds.length > totalMembers) return fail('memberIds cannot exceed totalMembers', 400);

  try {
    // CHIT-28 / CF-040 — the foreman commission cap is enforced in the web
    // action but the API path skipped it, so a 7% commission persisted under a
    // 5% cap. Both surfaces are the same capability.
    assertValidCommissionPct({
      commissionPct,
      foremanCommissionCapPct:
        body?.foremanCommissionCapPct == null ? null : Number(body.foremanCommissionCapPct),
    });
    validateChitConfig({
      auctionType: body?.auctionType ?? 'open_manual',
      commissionBasis: body?.commissionBasis ?? 'BID_DISCOUNT',
      dividendPolicy: body?.dividendPolicy ?? 'ALL_MEMBERS',
      dividendDistribution: body?.dividendDistribution ?? 'ADJUST_NEXT_DUE',
      tieBreakRule: body?.tieBreakRule ?? 'EARLIEST_BID',
      minDiscountPct: body?.minDiscountPct == null ? null : Number(body.minDiscountPct),
      maxDiscountPct: body?.maxDiscountPct == null ? null : Number(body.maxDiscountPct),
      fixedDiscountPct: body?.fixedDiscountPct == null ? null : Number(body.fixedDiscountPct),
    });

    // SCOPE-7: stamp the branch the caller is actually working, resolved and
    // tenant-validated. This previously took body.branchId verbatim for
    // superadmin/developer, so an unvalidated id from the request body landed on
    // the row -- including one belonging to another tenant's branch. A superadmin
    // targets a branch by SELECTING it in the switcher, which is what ctx.branchId
    // already carries.
    const branchId = await resolveWriteBranchId(ctx);
    const group = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.chitGroup.count({ where: { tenantId: ctx.tenantId } });
      const groupCode = generateCode('CF', existingCount + 1, 5);
      const created = await tx.chitGroup.create({
        data: {
          tenantId: ctx.tenantId,
          appType: 'chitfunds',
          branchId: branchId || null,
          groupCode,
          name,
          chitValue,
          monthlyContrib,
          totalMembers,
          durationMonths,
          commissionPct,
          startDate: dateOrNow(body?.startDate),
          status: 'draft',
          complianceStatus: 'draft',
          chitType: body?.chitType ?? 'unregistered',
          auctionType: body?.auctionType ?? 'open_manual',
          auctionFrequency: body?.auctionFrequency ?? 'monthly',
          frequencyUnit: body?.frequencyUnit ?? null,
          frequencyInterval: body?.frequencyInterval == null ? null : Number(body.frequencyInterval),
          frequencyWeekdays: body?.frequencyWeekdays ?? null,
          auctionMode: body?.auctionMode ?? 'offline',
          auctionDay: body?.auctionDay == null ? null : Number(body.auctionDay),
          registrationNo: body?.registrationNo ?? null,
          registrationDate: body?.registrationDate ? new Date(body.registrationDate) : null,
          registrarOffice: body?.registrarOffice ?? null,
          bylawNo: body?.bylawNo ?? null,
          commencementCertificate: body?.commencementCertificate ?? null,
          approvedBankName: body?.approvedBankName ?? null,
          approvedBankAccountNo: body?.approvedBankAccountNo ?? null,
          foremanName: body?.foremanName ?? null,
          foremanCommissionCapPct: body?.foremanCommissionCapPct == null ? null : Number(body.foremanCommissionCapPct),
          maxDiscountPct: body?.maxDiscountPct == null ? null : Number(body.maxDiscountPct),
          minDiscountPct: body?.minDiscountPct == null ? null : Number(body.minDiscountPct),
          bidStartAtCommission: body?.bidStartAtCommission == null ? true : Boolean(body.bidStartAtCommission),
          fixedDiscountPct: body?.fixedDiscountPct == null ? null : Number(body.fixedDiscountPct),
          commissionBasis: body?.commissionBasis ?? 'BID_DISCOUNT',
          gstPct: body?.gstPct == null ? null : Number(body.gstPct),
          dividendPolicy: body?.dividendPolicy ?? 'ALL_MEMBERS',
          dividendDistribution: body?.dividendDistribution ?? 'ADJUST_NEXT_DUE',
          dividendRounding: body?.dividendRounding == null ? 0 : Number(body.dividendRounding),
          bidIncrement: body?.bidIncrement == null ? null : Number(body.bidIncrement),
          tieBreakRule: body?.tieBreakRule ?? 'EARLIEST_BID',
          hasForemanTicket: Boolean(body?.hasForemanTicket),
          roomAdmission: body?.roomAdmission === 'approval' ? 'approval' : 'auto',
          bellEnabled: body?.bellEnabled == null ? true : Boolean(body.bellEnabled),
          bellIntervalSeconds: body?.bellIntervalSeconds == null ? 60 : Number(body.bellIntervalSeconds),
          bellCount: body?.bellCount == null ? 3 : Number(body.bellCount),
          bellAutoClose: body?.bellAutoClose == null ? true : Boolean(body.bellAutoClose),
          remarks: body?.remarks ?? null,
        },
      });

      for (const [idx, customerId] of memberIds.entries()) {
        const customer = await tx.customer.findFirst({
          where: {
            id: customerId,
            tenantId: ctx.tenantId,
            appType: 'chitfunds',
            deletedAt: null,
            ...(branchId ? { branchId } : {}),
          },
          select: { id: true },
        });
        if (!customer) throw new HttpError(400, `Invalid member customer: ${customerId}`);
        await tx.chitMember.create({
          data: {
            chitGroupId: created.id,
            customerId,
            memberNumber: idx + 1,
            ticketNo: String(idx + 1),
            ticketShare: 1,
          },
        });
      }
      return created;
    });
    return ok(group);
  } catch (e: any) {
    return failFromError(e, 'Failed to create chit group');
  }
}
