import prisma from '@/lib/db';

export function isTenantFileAccessAllowed(input: {
  role: string | null | undefined;
  requestedTenantId: string;
  sessionTenantId: string;
}): boolean {
  return ['superadmin', 'developer'].includes(input.role || '')
    || input.requestedTenantId === input.sessionTenantId;
}

// Borrowers get per-entity authorization, not tenant-wide: a borrower may only
// fetch files referenced by their OWN records. Without this, any borrower of
// tenant X could download any other customer's KYC document or payment proof
// in that tenant just by knowing the filename (files are stored flat per
// tenant). Deny by default; staff access stays tenant-wide via the check above.
export async function isBorrowerFileAllowed(
  customerId: string,
  tenantId: string,
  fileUrl: string,
): Promise<boolean> {
  // Stored references are either the full "/api/files/<tenant>/<name>" URL or
  // a bare path — match on the URL suffix to cover both.
  const suffix = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { profilePhoto: true, aadhaarPhoto: true },
  });
  if (!customer) return false;
  if (customer.profilePhoto?.endsWith(suffix) || customer.aadhaarPhoto?.endsWith(suffix)) {
    return true;
  }

  const [kycDoc, paymentApproval, chitDoc, voiceRoomMsg, chitCoMemberPhoto] = await Promise.all([
    prisma.kycDocument.findFirst({
      where: { customerId, filePath: { endsWith: suffix } },
      select: { id: true },
    }),
    prisma.paymentApproval.findFirst({
      where: { customerId, tenantId, photoPath: { endsWith: suffix } },
      select: { id: true },
    }),
    // Chit documents (payment-proof uploads, security docs) belong to the
    // borrower when the referenced entity resolves to one of their members.
    prisma.chitDocument.findFirst({
      where: { tenantId, fileUrl: { endsWith: suffix } },
      select: { entityType: true, entityId: true },
    }),
    // Public voice notes posted in a persistent group room or live auction room
    // are accessible to subscribers enrolled in that chit group.
    prisma.chitRoomMessage.findFirst({
      where: {
        tenantId,
        visibility: 'public',
        audioUrl: { endsWith: suffix },
        OR: [
          {
            chitGroup: {
              members: { some: { customerId } },
            },
          },
          {
            auction: {
              chitGroup: {
                members: { some: { customerId } },
              },
            },
          },
        ],
      },
      select: { id: true },
    }),
    // Co-members' public profile avatars around the same chit group's table circle
    // (strictly Customer.profilePhoto — never Aadhaar, KYC docs, or payment proofs).
    prisma.chitMember?.findFirst
      ? prisma.chitMember.findFirst({
          where: {
            customer: { tenantId, profilePhoto: { endsWith: suffix } },
            chitGroup: { members: { some: { customerId } } },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (kycDoc || paymentApproval || voiceRoomMsg || chitCoMemberPhoto) return true;

  if (chitDoc) {
    if (chitDoc.entityType === 'payment_intent') {
      const intent = await prisma.chitPaymentIntent.findFirst({
        where: { id: chitDoc.entityId, tenantId },
        select: { memberId: true },
      });
      if (intent) {
        const member = await prisma.chitMember.findFirst({
          where: { id: intent.memberId, customerId },
          select: { id: true },
        });
        if (member) return true;
      }
    }
    if (chitDoc.entityType === 'chit_security') {
      const security = await prisma.chitSecurity.findFirst({
        where: { id: chitDoc.entityId, tenantId },
        select: { winnerMemberId: true },
      });
      if (security) {
        const member = await prisma.chitMember.findFirst({
          where: { id: security.winnerMemberId, customerId },
          select: { id: true },
        });
        if (member) return true;
      }
    }
  }

  return false;
}
