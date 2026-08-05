import prisma from '@/lib/db';
import { buildUpiQrDataUrl } from '@/lib/upiIntent';
import PayClient from './PayClient';

export const dynamic = 'force-dynamic';

/**
 * Internal hosted self-pay page (mCollect-B fallback when no external PSP link).
 * Reached via the token in the payable link. Token-scoped — no login needed.
 */
export default async function BorrowerPayPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) return <Shell><p>Missing payment token.</p></Shell>;

  const tok = await prisma.clientPaymentToken.findUnique({ where: { token } });
  if (!tok) return <Shell><p>Invalid payment link.</p></Shell>;

  const expired = tok.expiresAt.getTime() < Date.now();
  const paid = tok.status === 'paid' || tok.status === 'used';

  const [loan, tenant, upi] = await Promise.all([
    prisma.loan.findUnique({ where: { id: tok.loanId }, select: { loanCode: true } }),
    prisma.tenant.findUnique({ where: { id: tok.tenantId }, select: { name: true } }),
    prisma.appSetting.findMany({
      where: { tenantId: tok.tenantId, key: { in: ['upi_id', 'upi_qr_url'] } },
      select: { key: true, value: true },
    }),
  ]);
  const upiMap = Object.fromEntries(upi.map((u) => [u.key, u.value]));
  const amount = Number(tok.amount);

  // Tier-0: if the tenant has a UPI VPA, build a dynamic intent QR with the exact
  // amount so the borrower pays the right amount in one scan. A PSP link (payUrl)
  // takes precedence when configured.
  const hasPsp = Boolean(tok.payUrl && tok.providerRef);
  let upiQrDataUrl: string | null = null;
  let upiUri: string | null = null;
  if (!hasPsp && upiMap['upi_id'] && !paid && !expired) {
    const built = await buildUpiQrDataUrl({
      vpa: upiMap['upi_id'],
      payeeName: tenant?.name ?? 'ZoloFund',
      amount,
      note: `Loan ${loan?.loanCode ?? ''}`,
      ref: token,
    });
    upiQrDataUrl = built.qrDataUrl;
    upiUri = built.uri;
  }

  return (
    <Shell>
      <PayClient
        token={token}
        amount={amount}
        loanCode={loan?.loanCode ?? ''}
        status={paid ? 'paid' : expired ? 'expired' : tok.status === 'claimed' ? 'claimed' : 'active'}
        upiId={upiMap['upi_id'] ?? null}
        qrUrl={upiMap['upi_qr_url'] ?? null}
        upiQrDataUrl={upiQrDataUrl}
        upiUri={upiUri}
        payUrl={hasPsp ? tok.payUrl : null}
        mockEnabled={process.env.RAZORPAY_MOCK_CHECKOUT === 'true'}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f172a', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
        {children}
      </div>
    </div>
  );
}
