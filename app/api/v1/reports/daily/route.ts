import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date');
  const date = dateParam ? new Date(dateParam) : new Date();
  date.setHours(0, 0, 0, 0);
  const nextDay = new Date(date);
  nextDay.setDate(date.getDate() + 1);

  try {
    const collections = await prisma.dailyCollection.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopedBranchWhere(ctx),
        date,
      },
      include: {
        agent: { select: { id: true, name: true } },
        route: { select: { id: true, name: true } },
        entries: {
          include: {
            customer: { select: { customerCode: true, name: true } },
          },
        },
      },
    });

    const totalCollected = collections.reduce(
      (s, c) => s + Number(c.totalCollected),
      0,
    );
    const totalExpected = collections.reduce(
      (s, c) => s + Number(c.totalExpected),
      0,
    );
    const entries = collections.flatMap((c) => c.entries);

    return ok({
      date: date.toISOString().split('T')[0],
      totalCollected,
      totalExpected,
      entryCount: entries.length,
      collections,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Report failed', 500);
  }
}
