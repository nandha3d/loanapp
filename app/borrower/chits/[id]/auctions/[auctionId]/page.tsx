import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { buildCustomerLiveState, findOwnLiveAuction } from '@/lib/chits/customerAuction';
import { getSetting } from '@/lib/tenant';
import BorrowerChitRoomClient from './BorrowerChitRoomClient';

export default async function BorrowerChitAuctionRoomPage({
  params,
}: {
  params: Promise<{ id: string; auctionId: string }>;
}) {
  const session = await getBorrowerSession();
  if (!session) redirect('/borrower/login');

  const { id, auctionId } = await params;
  const found = await findOwnLiveAuction(session.customerId, session.tenantId, id, auctionId);
  if (!found) notFound();

  const [initialState, currencySymbol] = await Promise.all([
    buildCustomerLiveState(id, auctionId, found.member.id),
    getSetting(session.tenantId, 'currency_symbol', '₹'),
  ]);
  if (!initialState) notFound();

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <Link
          href="/borrower/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            color: '#0f172a',
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← Back to My Portal
        </Link>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
            {found.auction.chitGroup.name} · Ticket #{found.member.ticketNo ?? found.member.memberNumber}
          </div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            Live Auction — Period {found.auction.periodNumber}
          </h1>
        </div>
      </div>

      <BorrowerChitRoomClient
        groupId={id}
        auctionId={auctionId}
        initialState={JSON.parse(JSON.stringify(initialState))}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
