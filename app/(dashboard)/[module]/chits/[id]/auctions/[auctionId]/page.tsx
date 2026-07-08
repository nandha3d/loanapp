import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { notFound } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import AuctionDetailClient from './AuctionDetailClient';
import { getDictionary } from '@/lib/i18n';

export default async function ChitAuctionDetailPage({ params }: { params: Promise<{ id: string; auctionId: string; module: string }> }) {
  const { id, auctionId } = await params;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'chitfunds');
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);

  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: { OR: [{ id }, { groupCode: id }], tenantId, appType, deletedAt: null } },
    include: {
      chitGroup: {
        include: {
          members: {
            orderBy: { memberNumber: 'asc' },
            include: { customer: { select: { id: true, name: true } } },
          },
        },
      },
      bids: {
        orderBy: { bidTime: 'desc' },
        include: { member: { include: { customer: { select: { name: true } } } } },
      },
      attendance: true,
      winnerMember: { include: { customer: { select: { name: true } } } },
    },
  });
  if (!auction) notFound();

  const security = auction.winnerMemberId
    ? await prisma.chitSecurity.findFirst({
        where: { auctionId: auction.id },
        orderBy: { updatedAt: 'desc' },
      })
    : null;

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href={`/chits/${auction.chitGroup.groupCode ?? id}`} className="btn btn-ghost btn-sm">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          {auction.chitGroup.name}
        </Link>
        <h2 style={{ margin: 0 }}>Auction — Period {auction.periodNumber}</h2>
      </div>
      <AuctionDetailClient
        auction={JSON.parse(JSON.stringify(auction))}
        security={security ? JSON.parse(JSON.stringify(security)) : null}
        currencySymbol={currencySymbol}
        dict={dict}
      />
    </div>
  );
}
