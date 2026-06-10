import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/api/dualAuth';
import { presentPayment } from '@/lib/nach';
import prisma from '@/lib/db';
import { z } from 'zod';

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'developer']);

const PresentSchema = z.object({
  mandateId: z.string().min(1),
  instalmentId: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().optional(),
});

/**
 * POST /api/v1/nach/present — manual trigger a NACH debit presentation.
 * Normally the cron runs this automatically D-2; use this for manual override.
 */
export async function POST(req: NextRequest) {
  const user = await resolveActor(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ADMIN_ROLES.has(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PresentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 422 });
  }

  // Verify mandate belongs to tenant
  const mandate = await prisma.nachMandate.findFirst({
    where: { id: parsed.data.mandateId, tenantId: user.tenantId },
    select: { id: true, status: true },
  });
  if (!mandate) return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });

  // Check instalment belongs to tenant
  const instalment = await prisma.instalment.findFirst({
    where: { id: parsed.data.instalmentId, loan: { tenantId: user.tenantId } },
    select: { id: true, dueAmount: true, receivedAmount: true, status: true },
  });
  if (!instalment) return NextResponse.json({ error: 'Instalment not found' }, { status: 404 });
  if (instalment.status === 'paid') {
    return NextResponse.json({ error: 'Instalment already paid' }, { status: 409 });
  }

  // Check no duplicate pending/submitted presentation
  const dup = await prisma.nachPresentation.findFirst({
    where: {
      mandateId: parsed.data.mandateId,
      instalmentId: parsed.data.instalmentId,
      status: { in: ['pending', 'submitted', 'success'] },
    },
  });
  if (dup) {
    return NextResponse.json({ error: `Presentation already ${dup.status} for this instalment` }, { status: 409 });
  }

  try {
    const result = await presentPayment(parsed.data);
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Presentation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
