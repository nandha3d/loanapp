import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { confirmAadhaarOtp, KycNotFoundError, startAadhaarOtpKyc } from '@/lib/kyc';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const actor = auth.context;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON', 400);
  }

  try {
    if (body.action === 'initiate') {
      if (typeof body.customerId !== 'string' || !/^\d{12}$/.test(String(body.aadhaarNumber ?? ''))) {
        return fail('Customer ID and 12-digit Aadhaar number required', 400);
      }
      return ok(await startAadhaarOtpKyc(body.customerId, actor, String(body.aadhaarNumber)));
    }
    if (body.action === 'verify') {
      if (typeof body.sessionId !== 'string' || !/^\d{4,8}$/.test(String(body.otp ?? ''))) {
        return fail('Session ID and valid OTP required', 400);
      }
      return ok(await confirmAadhaarOtp(body.sessionId, actor, String(body.otp)));
    }
    return fail('Invalid action', 400);
  } catch (error) {
    if (error instanceof KycNotFoundError) return fail(error.message, 404);
    if (error instanceof Error && error.message.includes('not enabled for your subscription')) {
      return fail(error.message, 403);
    }
    if (error instanceof Error && error.message.includes('OTP has expired')) return fail(error.message, 410);
    return fail(error instanceof Error ? error.message : 'KYC failed', 400);
  }
}
