import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { assertMemberSubstitutionAllowed } from '@/lib/chits/groupService';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, memberId } = await params;
  const body = await req.json().catch(() => null) as any;

  try {
    const member = await prisma.chitMember.findFirst({
      where: {
        id: memberId,
        chitGroupId: id,
        chitGroup: { tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
      },
      include: { chitGroup: true },
    });
    if (!member) return fail('Chit member not found', 404);
    if (body?.subscriberStatus === 'substituted' && member.subscriberStatus !== 'substituted') {
      try {
        await assertMemberSubstitutionAllowed(prisma, { group: member.chitGroup });
      } catch (err: any) {
        return fail(err?.message ?? 'Substitution disallowed', 400);
      }
    }
    const data: any = {};
    if (body?.ticketNo !== undefined) data.ticketNo = body.ticketNo;
    if (body?.fractionNo !== undefined) data.fractionNo = body.fractionNo;
    if (body?.ticketShare !== undefined) data.ticketShare = Number(body.ticketShare);
    if (body?.nomineeName !== undefined) data.nomineeName = body.nomineeName;
    if (body?.nomineeRelation !== undefined) data.nomineeRelation = body.nomineeRelation;
    if (body?.nomineePhone !== undefined) data.nomineePhone = body.nomineePhone;
    if (body?.introducedBy !== undefined) data.introducedBy = body.introducedBy;
    if (body?.agreementStatus !== undefined) data.agreementStatus = body.agreementStatus;
    if (body?.subscriberStatus !== undefined) data.subscriberStatus = body.subscriberStatus;
    if (body?.isForemanTicket !== undefined) data.isForemanTicket = Boolean(body.isForemanTicket);

    const updated = await prisma.chitMember.update({
      where: { id: member.id },
      data,
    });
    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'Member update failed', 500);
  }
}
