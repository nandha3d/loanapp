import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/api/dualAuth';
import { cancelMandate } from '@/lib/nach';
import prisma from '@/lib/db';

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'developer']);

/** GET /api/v1/nach/mandate/[id] — mandate detail + presentations */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveActor(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ADMIN_ROLES.has(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const mandate = await prisma.nachMandate.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      loan: { select: { loanCode: true, status: true, perInstalment: true, frequency: true } },
      customer: { select: { name: true, phone: true, email: true } },
      createdBy: { select: { name: true } },
      cancelledBy: { select: { name: true } },
      presentations: {
        orderBy: { presentedAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!mandate) return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
  return NextResponse.json({ ok: true, data: mandate });
}

/** DELETE /api/v1/nach/mandate/[id] — cancel mandate */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveActor(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ADMIN_ROLES.has(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  // Verify mandate belongs to tenant
  const mandate = await prisma.nachMandate.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!mandate) return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });

  let reason: string | undefined;
  try {
    const body = await req.json();
    reason = body?.reason;
  } catch { /* body optional */ }

  try {
    const updated = await cancelMandate({ mandateId: id, cancelledById: user.userId, reason });
    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Cancel failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
