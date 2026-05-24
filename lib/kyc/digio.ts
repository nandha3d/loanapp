const BASE_URL      = process.env.DIGIO_BASE_URL      || 'https://ext.digio.in:444';
const CLIENT_ID     = process.env.DIGIO_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.DIGIO_CLIENT_SECRET || '';

function authHeader() {
  const token = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' };
}

// ── Aadhaar OTP ──────────────────────────────────────────────────────────────

/**
 * Step 1: Initiate an Aadhaar OTP request for the given masked Aadhaar number.
 * Digio sends OTP to the Aadhaar-linked mobile number.
 */
export async function initiateAadhaarOtp(aadhaarNumber: string, customerName: string): Promise<{
  success: boolean;
  requestId?: string;
  message?: string;
  error?: string;
}> {
  if (!CLIENT_ID) return { success: false, error: 'Digio credentials not configured' };

  try {
    const res = await fetch(`${BASE_URL}/v2/client/kyc/aadhaar/initiate`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({
        aadhaar_number: aadhaarNumber.replace(/\s/g, ''),
        name:           customerName,
        channel:        'otp',
      }),
    });
    const data = await res.json();
    if (data.code === 200 && data.request_id) {
      return { success: true, requestId: data.request_id, message: data.message };
    }
    return { success: false, error: data.message || 'OTP initiation failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Step 2: Verify the OTP entered by the customer/agent.
 * Returns the UIDAI KYC data on success.
 */
export async function verifyAadhaarOtp(requestId: string, otp: string): Promise<{
  success: boolean;
  kycData?: {
    name: string;
    dob: string;
    gender: string;
    address: string;
    photo: string;    // base64 photo from UIDAI
    careOf: string;
  };
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/v2/client/kyc/aadhaar/verify`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ request_id: requestId, otp }),
    });
    const data = await res.json();
    if (data.code === 200 && data.entity) {
      const e = data.entity;
      return {
        success: true,
        kycData: {
          name:    e.name || '',
          dob:     e.dob  || '',
          gender:  e.gender || '',
          address: [e.house, e.street, e.loc, e.dist, e.state, e.pc].filter(Boolean).join(', '),
          photo:   e.photo_link || e.photo || '',
          careOf:  e.care_of || '',
        },
      };
    }
    return { success: false, error: data.message || 'OTP verification failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Video KYC ─────────────────────────────────────────────────────────────────

/**
 * Create a Video KYC session on Digio.
 * Returns a session URL that can be embedded or sent to the agent's device.
 */
export async function createVideoKycSession(params: {
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  referenceId: string;      // your internal customer ID
}): Promise<{
  success: boolean;
  sessionId?: string;
  sessionUrl?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/v2/client/kyc/video/create`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({
        customer_name:  params.customerName,
        customer_email: params.customerEmail || `${params.referenceId}@loantrack.in`,
        customer_phone: params.customerPhone,
        reference_id:   params.referenceId,
        notify:         false,
        expire_in_days: 3,
      }),
    });
    const data = await res.json();
    if (data.code === 200 && data.id) {
      return {
        success:    true,
        sessionId:  data.id,
        sessionUrl: data.signing_url || data.access_token_url,
      };
    }
    return { success: false, error: data.message || 'Video KYC session creation failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch the status of a Video KYC session.
 */
export async function getVideoKycStatus(sessionId: string): Promise<{
  status: 'pending' | 'completed' | 'expired' | 'failed';
  videoUrl?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/v2/client/kyc/video/${sessionId}`, {
      headers: authHeader(),
    });
    const data = await res.json();
    return {
      status:   data.status === 'completed' ? 'completed' : data.status || 'pending',
      videoUrl: data.video_url,
    };
  } catch (err: any) {
    return { status: 'failed', error: err.message };
  }
}

// ── Webhook signature verification ───────────────────────────────────────────

import crypto from 'node:crypto';

export function verifyDigioWebhook(payload: string, signature: string): boolean {
  const secret = process.env.DIGIO_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
