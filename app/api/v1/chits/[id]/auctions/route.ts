import { NextRequest } from 'next/server';
import { ok, fail , failFromError} from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import prisma from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  try {
    const group = await prisma.chitGroup.findFirst({
      where: { id, tenantId: ctx.tenantId, appType: 'chitfunds', ...scopedBranchWhere(ctx), deletedAt: null },
      select: { id: true },
    });
    if (!group) return fail('Chit group not found', 404);
    const auctions = await prisma.chitAuction.findMany({
      where: { chitGroupId: id },
      include: {
        winnerMember: { include: { customer: { select: { id: true, name: true, phone: true } } } },
        bids: { orderBy: { bidTime: 'asc' } },
        attendance: true,
      },
      orderBy: { periodNumber: 'asc' },
    });
    return ok(auctions);
  } catch (e: any) {
    return failFromError(e, 'Failed to load auctions');
  }
}

export async function POST(
  req: NextRequest,
  _ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  return fail(
    'Legacy auction result recording is retired. Submit bids, then use the confirm or draw endpoint so auction finalization and dividend distribution run.',
    410,
  );
}
