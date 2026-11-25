import prisma from '@/lib/db';
import { getSetting } from '@/lib/tenant';
import { notFound } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import AuctionDetailClient from './AuctionDetailClient';
import { getCurrentLanguage, getDictionary } from '@/lib/i18n';
import { getWebChitScope, scopedChitGroupWhere } from '@/lib/chits/access';
import { calculateReserveFloor } from '@/lib/chits/engineCalculator';
import { parseChitEngineConfig, resolveEngineTypeFromGroup } from '@/lib/chits/engineTypes';
import { computeAutomatedBidBounds } from '@/lib/chits/validation';

export default async function ChitAuctionDetailPage({ params }: { params: Promise<{ id: string; auctionId: string; module: string }> }) {
  const { id, auctionId } = await params;
  const scope = await getWebChitScope();
  const tenantId = scope.tenantId;
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const [dict, lang] = await Promise.all([getDictionary(tenantId), getCurrentLanguage(tenantId)]);

  const auction = await prisma.chitAuction.findFirst({
    where: { id: auctionId, chitGroup: scopedChitGroupWhere(scope, { OR: [{ id }, { groupCode: id }] }) },
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
        where: { auctionId: auction.id, chitGroupId: auction.chitGroupId, tenantId },
        orderBy: { updatedAt: 'desc' },
      })
    : null;
  const securityDocuments = security
    ? await prisma.chitDocument.findMany({
        where: {
          tenantId,
          appType: scope.appType,
          entityType: 'chit_security',
          entityId: security.id,
        },
        orderBy: [{ documentType: 'asc' }, { uploadedAt: 'desc' }],
      })
    : [];

  const roomMessages = await prisma.chitRoomMessage.findMany({
    where: { auctionId: auction.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      senderName: true,
      visibility: true,
      messageType: true,
      body: true,
      audioUrl: true,
      audioDurationSec: true,
      createdAt: true,
    },
  });

  const payoutReceipt = await prisma.chitReceipt.findFirst({
    where: {
      tenantId,
      entityType: 'auction',
      entityId: auction.id,
      receiptType: 'payout',
      status: 'active',
    },
    orderBy: { issuedAt: 'desc' },
  });

  const engineType = resolveEngineTypeFromGroup(auction.chitGroup);
  const engineCfg = parseChitEngineConfig(auction.chitGroup.engineConfig, engineType);
  const chitValueNum = Number(auction.chitGroup.chitValue);
  const validBids = auction.bids.filter((b) => ['valid', 'winning'].includes(b.status));
  const highestDiscount = validBids.reduce(
    (max, b) => Math.max(max, Number(b.bidDiscount)),
    0,
  );
  const reserveFloorPct =
    engineType === 'AUCTION_RESERVE_PRICE' && engineCfg.discountRules.reservePriceStepPct > 0
      ? calculateReserveFloor({
          chitValue: chitValueNum,
          totalPeriods: auction.chitGroup.totalMembers,
          periodNumber: auction.periodNumber,
          reservePriceStepPct: engineCfg.discountRules.reservePriceStepPct,
          maxDiscountPct: engineCfg.discountRules.uncapped
            ? null
            : auction.chitGroup.maxDiscountPct != null
              ? Number(auction.chitGroup.maxDiscountPct)
              : null,
        }).reserveFloorPct
      : null;
  const groupIncrement = auction.chitGroup.bidIncrement ? Number(auction.chitGroup.bidIncrement) : 0;
  const engineIncrement =
    engineCfg.discountRules.bidIncrementMultiple > 0 ? engineCfg.discountRules.bidIncrementMultiple : 0;
  const initialBidBounds = computeAutomatedBidBounds({
    chitValue: chitValueNum,
    maxDiscountPct: auction.chitGroup.maxDiscountPct != null ? Number(auction.chitGroup.maxDiscountPct) : null,
    minDiscountPct: auction.chitGroup.minDiscountPct != null ? Number(auction.chitGroup.minDiscountPct) : null,
    commissionPct: auction.chitGroup.commissionPct != null ? Number(auction.chitGroup.commissionPct) : null,
    bidStartAtCommission: auction.chitGroup.bidStartAtCommission,
    reserveFloorPct,
    uncapped: engineType === 'AUCTION_UNCAPPED_ENTERPRISE' || engineCfg.discountRules.uncapped,
    bidIncrement: groupIncrement > 0 ? groupIncrement : engineIncrement,
    currentHighestDiscount: highestDiscount,
    auctionType: auction.chitGroup.auctionType,
  });

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href={`/chits/${auction.chitGroup.id}`} className="btn btn-ghost btn-sm">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          {auction.chitGroup.name}
        </Link>
        <h2 style={{ margin: 0 }}>Auction — Period {auction.periodNumber}</h2>
      </div>
      <AuctionDetailClient
        auction={JSON.parse(JSON.stringify(auction))}
        security={security ? JSON.parse(JSON.stringify(security)) : null}
        securityDocuments={JSON.parse(JSON.stringify(securityDocuments))}
        payoutReceipt={payoutReceipt ? JSON.parse(JSON.stringify(payoutReceipt)) : null}
        initialMessages={JSON.parse(JSON.stringify(roomMessages.reverse()))}
        initialBidBounds={initialBidBounds}
        currencySymbol={currencySymbol}
        lang={lang}
        dict={dict}
      />
    </div>
  );
}
