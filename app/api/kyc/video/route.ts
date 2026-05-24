import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/apiAuth';
import { startVideoKyc, reviewVideoKyc } from '@/lib/kyc';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  const authResult = await requireApiContext();
  if (authResult.response) return authResult.response;
  const { context } = authResult;
  const { tenantId, userId, role } = context;

  // Gating check
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { kycEnabled: true }
  });
  if (!sub || !sub.kycEnabled) {
    return NextResponse.json(
      { error: 'KYC Verification module is not enabled for your subscription.' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { action, customerId, sessionId, decision, notes } = body;

  try {
    if (action === 'start') {
      if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });
      const result = await startVideoKyc(customerId, tenantId, userId);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'review') {
      // Admin only
      if (role === 'agent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (!sessionId || !decision) return NextResponse.json({ error: 'sessionId and decision required' }, { status: 400 });
      await reviewVideoKyc(sessionId, tenantId, userId, decision, notes);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
