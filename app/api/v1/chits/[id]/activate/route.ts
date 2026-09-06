import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { validateChitGroupActivation } from '@/lib/chits/validation';
import { parseFrequency, nextPeriodDate } from '@/lib/chits/frequency';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id } = await params;

  try {
    const group = await prisma.chitGroup.findFirst({
      where: { id, tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
    });
    if (!group) return fail('Chit group not found', 404);
    if (group.status === 'active') return fail('Chit group is already active', 409);

    const members = await prisma.chitMember.findMany({
      where: { chitGroupId: id },
      select: { id: true, ticketNo: true, ticketShare: true, agreementStatus: true, isForemanTicket: true },
    });
    const ticketShares = new Map<string, number>();
    for (const member of members) {
      if (member.ticketNo) ticketShares.set(member.ticketNo, (ticketShares.get(member.ticketNo) ?? 0) + Number(member.ticketShare));
    }
    const invalidShareCount = Array.from(ticketShares.values()).filter((sum) => Math.abs(sum - 1) > 0.001).length;
    if (invalidShareCount) return fail('Each ticket share total must equal 1.00', 400);

    // Activation pre-conditions (unsigned agreements, missing compliance
    // fields, ticket setup, …) are user-actionable — surface them as a 400
    // with the descriptive message rather than a generic 500.
    try {
      validateChitGroupActivation({
        chitType: group.chitType,
        registrationNo: group.registrationNo,
        registrationDate: group.registrationDate,
        registrarOffice: group.registrarOffice,
        bylawNo: group.bylawNo,
        commencementCertificate: group.commencementCertificate,
        approvedBankName: group.approvedBankName,
        foremanName: group.foremanName,
        commissionPct: Number(group.commissionPct),
        foremanCommissionCapPct: group.foremanCommissionCapPct ? Number(group.foremanCommissionCapPct) : null,
        maxDiscountPct: group.maxDiscountPct ? Number(group.maxDiscountPct) : null,
        totalMembers: group.totalMembers,
        actualMembers: members.length,
        distinctTicketCount: ticketShares.size,
        missingTicketCount: members.filter((member) => !member.ticketNo).length,
        pendingAgreementCount: members.filter((member) => !['signed', 'verified'].includes(member.agreementStatus)).length,
        hasForemanTicket: group.hasForemanTicket,
        foremanTicketCount: members.filter((member) => member.isForemanTicket).length,
      });
    } catch (e: any) {
      return fail(e?.message ?? 'Chit group cannot be activated yet', 400);
    }

    const freq = parseFrequency(group);
    const updated = await prisma.$transaction(async (tx) => {
      const existingSubscriptions = await tx.chitSubscription.count({ where: { member: { chitGroupId: id } } });
      const existingAuctions = await tx.chitAuction.count({ where: { chitGroupId: id } });
      if (!existingSubscriptions) {
        for (let period = 1; period <= group.totalMembers; period++) {
          for (const member of members) {
            const amount = Number(group.monthlyContrib) * Number(member.ticketShare);
            await tx.chitSubscription.create({
              data: {
                memberId: member.id,
                periodNumber: period,
                dueDate: nextPeriodDate(group.startDate, period, freq),
                dueAmount: amount,
                baseDueAmount: amount,
                status: 'upcoming',
              },
            });
          }
        }
      }
      if (!existingAuctions) {
        for (let period = 1; period <= group.totalMembers; period++) {
          const periodDate = nextPeriodDate(group.startDate, period, freq);
          await tx.chitAuction.create({
            data: {
              chitGroupId: id,
              periodNumber: period,
              auctionDate: periodDate,
              scheduledAt: periodDate,
              status: 'pending',
            },
          });
        }
      }
      return tx.chitGroup.update({
        where: { id },
        data: { status: 'active', complianceStatus: 'active' },
      });
    });
    return ok(updated);
  } catch (e: any) {
    return failFromError(e, 'Chit activation failed');
  }
}
