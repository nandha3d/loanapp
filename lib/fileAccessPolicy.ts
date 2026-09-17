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

  const [kycDoc, paymentApproval, chitDoc] = await Promise.all([
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
  ]);
  if (kycDoc || paymentApproval) return true;

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
