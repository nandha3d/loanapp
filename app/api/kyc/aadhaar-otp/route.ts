import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/apiAuth';
import { startAadhaarOtpKyc, confirmAadhaarOtp, KycNotFoundError } from '@/lib/kyc';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  const authResult = await requireApiContext();
  if (authResult.response) return authResult.response;
  const { context } = authResult;
  const { tenantId } = context;

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
  const { customerId, aadhaarNumber, action, sessionId, otp } = body;

  try {
    if (action === 'initiate') {
      if (!customerId || !aadhaarNumber) {
        return NextResponse.json({ error: 'customerId and aadhaarNumber required' }, { status: 400 });
      }
      const result = await startAadhaarOtpKyc(customerId, context, aadhaarNumber);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'verify') {
      if (!sessionId || !otp) {
        return NextResponse.json({ error: 'sessionId and otp required' }, { status: 400 });
      }
      const result = await confirmAadhaarOtp(sessionId, context, otp);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ error: 'Invalid action. Use initiate or verify.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err instanceof KycNotFoundError ? 404 : 400 });
  }
}
