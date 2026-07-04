import crypto from 'node:crypto';
import prisma from '@/lib/db';
import { decryptField } from '@/lib/pii';
import { getSetting } from '@/lib/tenant';

type DigioConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
};

async function resolveDigioConfig(tenantId: string): Promise<DigioConfig> {
  const [clientId, encryptedSecret] = await Promise.all([
    getSetting(tenantId, 'kyc_digio_client_id', ''),
    getSetting(tenantId, 'kyc_digio_client_secret', ''),
  ]);

  return {
    baseUrl: process.env.DIGIO_BASE_URL || 'https://ext.digio.in:444',
    clientId: clientId || process.env.DIGIO_CLIENT_ID || '',
    clientSecret:
      decryptField(encryptedSecret) ||
      encryptedSecret ||
      process.env.DIGIO_CLIENT_SECRET ||
      '',
  };
}

function authHeader(config: DigioConfig) {
  const token = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' };
}

export async function initiateAadhaarOtp(
  tenantId: string,
  aadhaarNumber: string,
  customerName: string,
): Promise<{
  success: boolean;
  requestId?: string;
  message?: string;
  error?: string;
}> {
  const config = await resolveDigioConfig(tenantId);
  if (!config.clientId || !config.clientSecret) {
    return { success: false, error: 'Digio credentials not configured' };
  }

  try {
    const res = await fetch(`${config.baseUrl}/v2/client/kyc/aadhaar/initiate`, {
      method: 'POST',
      headers: authHeader(config),
      body: JSON.stringify({
        aadhaar_number: aadhaarNumber.replace(/\s/g, ''),
        name: customerName,
        channel: 'otp',
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

export async function verifyAadhaarOtp(
  tenantId: string,
  requestId: string,
  otp: string,
): Promise<{
  success: boolean;
  kycData?: {
    name: string;
    dob: string;
    gender: string;
    address: string;
    photo: string;
    careOf: string;
  };
  error?: string;
}> {
  const config = await resolveDigioConfig(tenantId);
  if (!config.clientId || !config.clientSecret) {
    return { success: false, error: 'Digio credentials not configured' };
  }

  try {
    const res = await fetch(`${config.baseUrl}/v2/client/kyc/aadhaar/verify`, {
      method: 'POST',
      headers: authHeader(config),
      body: JSON.stringify({ request_id: requestId, otp }),
    });
    const data = await res.json();
    if (data.code === 200 && data.entity) {
      const e = data.entity;
      return {
        success: true,
        kycData: {
          name: e.name || '',
          dob: e.dob || '',
          gender: e.gender || '',
          address: [e.house, e.street, e.loc, e.dist, e.state, e.pc]
            .filter(Boolean)
            .join(', '),
          photo: e.photo_link || e.photo || '',
          careOf: e.care_of || '',
        },
      };
    }
    return { success: false, error: data.message || 'OTP verification failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createVideoKycSession(params: {
  tenantId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  referenceId: string;
}): Promise<{
  success: boolean;
  sessionId?: string;
  sessionUrl?: string;
  error?: string;
}> {
  const config = await resolveDigioConfig(params.tenantId);
  if (!config.clientId || !config.clientSecret) {
    return { success: false, error: 'Digio credentials not configured' };
  }

  try {
    const res = await fetch(`${config.baseUrl}/v2/client/kyc/video/create`, {
      method: 'POST',
      headers: authHeader(config),
      body: JSON.stringify({
        customer_name: params.customerName,
        customer_email: params.customerEmail || `${params.referenceId}@loantrack.in`,
        customer_phone: params.customerPhone,
        reference_id: params.referenceId,
        notify: false,
        expire_in_days: 3,
      }),
    });
    const data = await res.json();
    if (data.code === 200 && data.id) {
      return {
        success: true,
        sessionId: data.id,
        sessionUrl: data.signing_url || data.access_token_url,
      };
    }
    return { success: false, error: data.message || 'Video KYC session creation failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getVideoKycStatus(
  tenantId: string,
  sessionId: string,
): Promise<{
  status: 'pending' | 'completed' | 'expired' | 'failed';
  videoUrl?: string;
  error?: string;
}> {
  const config = await resolveDigioConfig(tenantId);
  if (!config.clientId || !config.clientSecret) {
    return { status: 'failed', error: 'Digio credentials not configured' };
  }

  try {
    const res = await fetch(`${config.baseUrl}/v2/client/kyc/video/${sessionId}`, {
      headers: authHeader(config),
    });
    const data = await res.json();
    return {
      status: data.status === 'completed' ? 'completed' : data.status || 'pending',
      videoUrl: data.video_url,
    };
  } catch (err: any) {
    return { status: 'failed', error: err.message };
  }
}

function verifyDigioSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signature.trim().toLowerCase(), 'utf8');

  if (expectedBuf.byteLength !== providedBuf.byteLength) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export async function verifyDigioWebhook(payload: string, signature: string): Promise<boolean> {
  if (verifyDigioSignature(payload, signature, process.env.DIGIO_WEBHOOK_SECRET || '')) {
    return true;
  }

  const rows = await prisma.appSetting.findMany({
    where: { key: 'kyc_digio_webhook_secret' },
    select: { value: true },
  });

  return rows.some((row) => {
    const secret = decryptField(row.value) || row.value;
    return verifyDigioSignature(payload, signature, secret);
  });
}
