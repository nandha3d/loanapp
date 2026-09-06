import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { validateChitConfig } from '@/lib/chits/validation';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  try {
    const group = await prisma.chitGroup.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
      include: {
        members: {
          include: { customer: { select: { id: true, name: true, phone: true, customerCode: true } } },
          orderBy: { memberNumber: 'asc' },
        },
        auctions: {
          include: {
            winnerMember: { include: { customer: { select: { id: true, name: true, phone: true } } } },
            bids: { orderBy: { bidTime: 'asc' } },
            attendance: true,
          },
          orderBy: { periodNumber: 'asc' },
        },
      },
    });
    if (!group) return fail('Chit group not found', 404);
    return ok(group);
  } catch (e: any) {
    return failFromError(e, 'Failed to load chit group');
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);

  const body = await req.json().catch(() => null) as any;
  try {
    const existing = await prisma.chitGroup.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
    });
    if (!existing) return fail('Chit group not found', 404);
    if (existing.status === 'active' && ctx.role === 'admin') {
      return fail('Only superadmin/developer can edit active compliance metadata', 403);
    }

    validateChitConfig({
      auctionType: body?.auctionType ?? existing.auctionType,
      commissionBasis: body?.commissionBasis ?? existing.commissionBasis,
      dividendPolicy: body?.dividendPolicy ?? existing.dividendPolicy,
      dividendDistribution: body?.dividendDistribution ?? existing.dividendDistribution,
      tieBreakRule: body?.tieBreakRule ?? existing.tieBreakRule,
      minDiscountPct: body?.minDiscountPct == null ? (existing.minDiscountPct ? Number(existing.minDiscountPct) : null) : Number(body.minDiscountPct),
      maxDiscountPct: body?.maxDiscountPct == null ? (existing.maxDiscountPct ? Number(existing.maxDiscountPct) : null) : Number(body.maxDiscountPct),
      fixedDiscountPct: body?.fixedDiscountPct == null ? (existing.fixedDiscountPct ? Number(existing.fixedDiscountPct) : null) : Number(body.fixedDiscountPct),
    });

    const data: any = {};
    if (body?.name != null) data.name = body.name;
    if (body?.chitValue != null) data.chitValue = Number(body.chitValue);
    if (body?.monthlyContrib != null) data.monthlyContrib = Number(body.monthlyContrib);
    if (body?.durationMonths != null) data.durationMonths = Number(body.durationMonths);
    if (body?.commissionPct != null) data.commissionPct = Number(body.commissionPct);
    if (body?.startDate != null) data.startDate = new Date(body.startDate);
    if (body?.registrationNo !== undefined) data.registrationNo = body.registrationNo;
    if (body?.registrationDate !== undefined) data.registrationDate = body.registrationDate ? new Date(body.registrationDate) : null;
    if (body?.registrarOffice !== undefined) data.registrarOffice = body.registrarOffice;
    if (body?.bylawNo !== undefined) data.bylawNo = body.bylawNo;
    if (body?.commencementCertificate !== undefined) data.commencementCertificate = body.commencementCertificate;
    if (body?.approvedBankName !== undefined) data.approvedBankName = body.approvedBankName;
    if (body?.approvedBankAccountNo !== undefined) data.approvedBankAccountNo = body.approvedBankAccountNo;
    if (body?.foremanName !== undefined) data.foremanName = body.foremanName;
    if (body?.foremanCommissionCapPct !== undefined) data.foremanCommissionCapPct = body.foremanCommissionCapPct == null ? null : Number(body.foremanCommissionCapPct);
    if (body?.maxDiscountPct !== undefined) data.maxDiscountPct = body.maxDiscountPct == null ? null : Number(body.maxDiscountPct);
    if (body?.minDiscountPct !== undefined) data.minDiscountPct = body.minDiscountPct == null ? null : Number(body.minDiscountPct);
    if (body?.fixedDiscountPct !== undefined) data.fixedDiscountPct = body.fixedDiscountPct == null ? null : Number(body.fixedDiscountPct);
    if (body?.chitType != null) data.chitType = body.chitType;
    if (body?.auctionType != null) data.auctionType = body.auctionType;
    const changesFrequency =
      body?.auctionFrequency != null || body?.frequencyUnit !== undefined ||
      body?.frequencyInterval !== undefined || body?.frequencyWeekdays !== undefined;
    if (changesFrequency && existing.status === 'active') {
      return fail('Frequency cannot be changed after activation — subscriptions/auctions are already scheduled', 409);
    }
    if (body?.auctionFrequency != null) data.auctionFrequency = body.auctionFrequency;
    if (body?.frequencyUnit !== undefined) data.frequencyUnit = body.frequencyUnit;
    if (body?.frequencyInterval !== undefined) data.frequencyInterval = body.frequencyInterval == null ? null : Number(body.frequencyInterval);
    if (body?.frequencyWeekdays !== undefined) data.frequencyWeekdays = body.frequencyWeekdays;
    if (body?.bidStartAtCommission != null) data.bidStartAtCommission = Boolean(body.bidStartAtCommission);
    if (body?.roomAdmission != null) data.roomAdmission = body.roomAdmission === 'approval' ? 'approval' : 'auto';
    if (body?.bellEnabled != null) data.bellEnabled = Boolean(body.bellEnabled);
    if (body?.bellIntervalSeconds != null) data.bellIntervalSeconds = Number(body.bellIntervalSeconds);
    if (body?.bellCount != null) data.bellCount = Number(body.bellCount);
    if (body?.bellAutoClose != null) data.bellAutoClose = Boolean(body.bellAutoClose);
    if (body?.auctionMode != null) data.auctionMode = body.auctionMode;
    if (body?.auctionDay !== undefined) data.auctionDay = body.auctionDay == null ? null : Number(body.auctionDay);
    if (body?.commissionBasis != null) data.commissionBasis = body.commissionBasis;
    if (body?.gstPct !== undefined) data.gstPct = body.gstPct == null ? null : Number(body.gstPct);
    if (body?.dividendPolicy != null) data.dividendPolicy = body.dividendPolicy;
    if (body?.dividendDistribution != null) data.dividendDistribution = body.dividendDistribution;
    if (body?.dividendRounding != null) data.dividendRounding = Number(body.dividendRounding);
    if (body?.bidIncrement !== undefined) data.bidIncrement = body.bidIncrement == null ? null : Number(body.bidIncrement);
    if (body?.tieBreakRule != null) data.tieBreakRule = body.tieBreakRule;
    if (body?.hasForemanTicket != null) data.hasForemanTicket = Boolean(body.hasForemanTicket);
    if (body?.remarks !== undefined) data.remarks = body.remarks;

    const updated = await prisma.chitGroup.update({
      where: { id },
      data,
    });
    return ok(updated);
  } catch (e: any) {
    return failFromError(e, 'Failed to update chit group');
  }
}
