import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import {
  DELETION_ROLES,
  type DeletionRole,
  createDeletionRequest,
  sendDeletionAcknowledgement,
  sendDeletionRequestToSupport,
} from '@/lib/deletionRequests';

// POST /api/deletion-request — public account & data deletion request
// (zolofunds.com/delete-account, linked from the Android app's Settings).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

    const name = str(body?.name);
    const email = str(body?.email).toLowerCase();
    const phone = str(body?.phone);
    const role = str(body?.role) as DeletionRole;
    const organization = str(body?.organization) || null;
    const reason = str(body?.reason) || null;
    // Honeypot: real users never see or fill this field.
    if (str(body?.website)) {
      return NextResponse.json({ success: true, reference: null });
    }

    if (!name || !email || !phone) {
      return NextResponse.json({ success: false, error: 'Name, email and mobile number are required.' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ success: false, error: 'Please enter a valid mobile number.' }, { status: 400 });
    }
    if (!DELETION_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Please choose your account role.' }, { status: 400 });
    }

    // 3 / email / day, 10 / IP / day.
    const windowMs = 24 * 60 * 60 * 1000;
    const ip = getClientIp(req);
    const [emailLimit, ipLimit] = await Promise.all([
      checkRateLimit(routeKey('deletion-request:email', email), { limit: 3, windowMs }),
      checkRateLimit(routeKey('deletion-request:ip', ip), { limit: 10, windowMs }),
    ]);
    if (!emailLimit.allowed || !ipLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please email support@zolofunds.com instead.' },
        { status: 429 },
      );
    }

    const input = { name, email, phone, role, organization, reason, ip };
    const { reference } = await createDeletionRequest(input);

    // The request is stored even if mail fails; support sees it in the console.
    const [supportMailed, ackMailed] = await Promise.all([
      sendDeletionRequestToSupport(input, reference).catch(() => false),
      sendDeletionAcknowledgement(input, reference).catch(() => false),
    ]);
    if (!supportMailed) console.error(`[deletion-request] support alert not sent for ${reference}`);

    return NextResponse.json({ success: true, reference, acknowledgementSent: ackMailed });
  } catch (err: any) {
    console.error('[deletion-request] failed', err?.message || err);
    return NextResponse.json(
      { success: false, error: 'Could not submit your request. Please email support@zolofunds.com.' },
      { status: 500 },
    );
  }
}
