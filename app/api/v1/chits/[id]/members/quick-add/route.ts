import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { quickAddChitMembers, type QuickAddMemberEntry } from '@/lib/chits/quickAddMembers';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer', 'agent'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { id: groupId } = await params;
  const body = (await req.json().catch(() => null)) as any;
  if (!body || typeof body !== 'object') {
    return fail('Invalid JSON body', 400);
  }

  const entries: QuickAddMemberEntry[] = Array.isArray(body.members)
    ? body.members
    : body.fullName || body.phone
      ? [
          {
            fullName: String(body.fullName ?? ''),
            phone: String(body.phone ?? ''),
            alias: body.alias ?? null,
            address: body.address ?? null,
            ticketCount: body.ticketCount != null ? Number(body.ticketCount) : 1,
          },
        ]
      : [];

  if (entries.length === 0) {
    return fail('Provide fullName + phone or a non-empty members array', 400);
  }

  try {
    const res = await prisma.$transaction((tx) =>
      quickAddChitMembers(
        tx,
        {
          tenantId: ctx.tenantId,
          appType: 'chitfunds',
          branchId: ctx.branchId ?? null,
          userId: ctx.userId,
        },
        groupId,
        entries,
        { expandGroupCapacity: Boolean(body.expandGroupCapacity) },
      ),
    );
    return ok(res);
  } catch (e: any) {
    const msg = e?.message ?? 'Quick-add failed';
    const status = msg === 'Chit group not found' ? 404 : 400;
    return fail(msg, status);
  }
}
