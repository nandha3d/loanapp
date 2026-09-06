import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { decryptAadharNumber, maskAadharNumber } from '@/lib/pii';

/**
 * Step 4 of the HP origination wizard: warn the operator the moment a
 * guarantor's Aadhaar is already tied to existing business — especially an
 * overdue or NPA-classified loan.
 *
 * Aadhaar is stored AES-GCM encrypted with a random IV, so it cannot be looked
 * up with a WHERE clause. We therefore decrypt the tenant's guarantor and
 * customer Aadhaar columns in memory and compare digits. Scoped to one tenant
 * and selecting only the three columns needed, this is a few milliseconds at
 * realistic book sizes. If a tenant ever outgrows it, the fix is a
 * deterministic blind-index column (HMAC of the digits) rather than a wider
 * scan here.
 */

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const { tenantId, appType } = auth.context;

  const body = (await req.json().catch(() => null)) as { aadhaar?: string } | null;
  const aadhaar = digitsOnly(String(body?.aadhaar ?? ''));
  if (aadhaar.length !== 12) {
    return fail('A 12-digit Aadhaar number is required', 400);
  }

  const [guarantors, customers] = await Promise.all([
    prisma.guarantor.findMany({
      where: { aadharNumber: { not: null }, customer: { tenantId, appType } },
      select: {
        id: true,
        name: true,
        phone: true,
        aadharNumber: true,
        customer: { select: { id: true, name: true, customerCode: true } },
      },
    }),
    prisma.customer.findMany({
      where: { tenantId, appType, aadharNumber: { not: null }, deletedAt: null },
      select: { id: true, name: true, customerCode: true, aadharNumber: true },
    }),
  ]);

  const matchesAadhaar = (stored: string | null) => {
    try {
      return decryptAadharNumber(stored) === aadhaar;
    } catch {
      // A row encrypted under a rotated key must not break the whole check.
      return false;
    }
  };

  const matchedGuarantors = guarantors.filter((g) => matchesAadhaar(g.aadharNumber));
  const matchedCustomers = customers.filter((c) => matchesAadhaar(c.aadharNumber));

  const customerIds = [
    ...matchedGuarantors.map((g) => g.customer.id),
    ...matchedCustomers.map((c) => c.id),
  ];
  const guarantorIds = matchedGuarantors.map((g) => g.id);

  const linkedLoans = customerIds.length === 0 && guarantorIds.length === 0
    ? []
    : await prisma.loan.findMany({
      where: {
        tenantId,
        appType,
        deletedAt: null,
        OR: [
          ...(customerIds.length ? [{ customerId: { in: customerIds } }] : []),
          ...(guarantorIds.length ? [{ guarantorId: { in: guarantorIds } }] : []),
        ],
      },
      select: {
        id: true,
        loanCode: true,
        status: true,
        npaStatus: true,
        npaDaysOverdue: true,
        totalPayable: true,
        totalCollected: true,
        customer: { select: { name: true, customerCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

  const defaults = linkedLoans.filter(
    (l) => l.npaStatus != null || l.status === 'overdue' || l.npaDaysOverdue > 0,
  );

  return ok({
    aadhaarMasked: maskAadharNumber(aadhaar),
    found: matchedGuarantors.length > 0 || matchedCustomers.length > 0,
    asGuarantorCount: matchedGuarantors.length,
    asCustomerCount: matchedCustomers.length,
    // The wizard shows a red banner when this is true.
    hasDefaults: defaults.length > 0,
    activeLoanCount: linkedLoans.filter((l) => l.status === 'active').length,
    linkedLoans: linkedLoans.map((l) => ({
      id: l.id,
      loanCode: l.loanCode,
      status: l.status,
      npaStatus: l.npaStatus,
      daysOverdue: l.npaDaysOverdue,
      outstanding: Number(l.totalPayable) - Number(l.totalCollected),
      customerName: l.customer.name,
      customerCode: l.customer.customerCode,
    })),
    knownAs: [
      ...matchedCustomers.map((c) => ({ role: 'customer' as const, name: c.name, code: c.customerCode })),
      ...matchedGuarantors.map((g) => ({
        role: 'guarantor' as const,
        name: g.name,
        code: g.customer.customerCode,
      })),
    ],
  });
}
