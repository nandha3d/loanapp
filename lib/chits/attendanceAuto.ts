// Doc 18 — auto-mark attendance on any borrower-portal login on the day of a
// member's scheduled auction. Independent of, and in addition to, the
// existing room-join marking (app/api/v1/borrower/chits/[id]/auctions/[auctionId]/join/route.ts).
import prisma from '@/lib/db';
import { startOfBusinessToday, startOfBusinessTomorrow } from '@/lib/businessTime';

export async function markAttendanceOnLogin(customerId: string, tenantId: string): Promise<void> {
  try {
    const memberships = await prisma.chitMember.findMany({
      where: { customerId, subscriberStatus: 'active', chitGroup: { tenantId, appType: 'chitfunds', deletedAt: null } },
      select: { id: true, chitGroupId: true, chitGroup: { select: { branchId: true } } },
    });
    if (!memberships.length) return;

    const startOfDay = startOfBusinessToday();
    const endOfDay = startOfBusinessTomorrow();

    const todaysAuctions = await prisma.chitAuction.findMany({
      where: {
        chitGroupId: { in: memberships.map((m) => m.chitGroupId) },
        status: { in: ['pending', 'notice_sent', 'in_progress'] },
        OR: [
          { auctionDate: { gte: startOfDay, lt: endOfDay } },
          { scheduledAt: { gte: startOfDay, lt: endOfDay } },
        ],
      },
      select: { id: true, chitGroupId: true },
    });
    if (!todaysAuctions.length) return;

    const memberByGroup = new Map(memberships.map((m) => [m.chitGroupId, m]));
    for (const auction of todaysAuctions) {
      const member = memberByGroup.get(auction.chitGroupId);
      if (!member) continue;
      await prisma.chitAuctionAttendance.upsert({
        where: { auctionId_memberId: { auctionId: auction.id, memberId: member.id } },
        create: {
          tenantId,
          branchId: member.chitGroup.branchId,
          auctionId: auction.id,
          memberId: member.id,
          status: 'present',
          admissionStatus: 'none',
          markedVia: 'login',
        },
        // Never overwrite an existing row — staff decisions and room-join
        // state (including a staff 'denied') always win over a login mark.
        update: {},
      });
    }
  } catch (err) {
    console.error('[markAttendanceOnLogin] failed', err);
  }
}
