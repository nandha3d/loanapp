import prisma from '../../db';
import { getSetting } from '../../tenant';

interface SmsResult { success: boolean; providerMsgId?: string; error?: string; }

export async function sendSms(
  tenantId: string,
  phone: string,
  message: string,
  meta?: { entityType?: string; entityId?: string; event?: string }
): Promise<SmsResult> {
  // 1. Load tenant SMS settings
  const [authKey, senderId, enabled] = await Promise.all([
    getSetting(tenantId, 'msg91_auth_key', ''),
    getSetting(tenantId, 'msg91_sender_id', 'LNTRCK'),
    getSetting(tenantId, 'notify_channel_sms', 'false'),
  ]);

  if (enabled !== 'true' || !authKey) {
    return { success: false, error: 'SMS channel not configured' };
  }

  const normalised = normalisePhone(phone);
  if (!normalised) return { success: false, error: 'Invalid phone number' };

  let result: SmsResult = { success: false };

  try {
    const res = await fetch('https://api.msg91.com/api/v5/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: authKey },
      body: JSON.stringify({
        sender: senderId,
        route: '4',
        country: '91',
        sms: [{ message, to: [normalised] }],
      }),
    });
    const data = await res.json();
    result = data.type === 'success'
      ? { success: true, providerMsgId: data.request_id }
      : { success: false, error: data.message || JSON.stringify(data) };
  } catch (err: any) {
    result = { success: false, error: err.message };
  }

  // Log every attempt
  await prisma.notificationLog.create({
    data: {
      tenantId, channel: 'sms', recipient: normalised,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error ?? null,
      providerMsgId: result.providerMsgId ?? null,
      provider: 'msg91',
      messageBody: message,
      entityType: meta?.entityType ?? null,
      entityId:   meta?.entityId   ?? null,
      event:      meta?.event      ?? null,
    },
  }).catch((e) => {
    console.error('Failed to log SMS notification:', e);
  });

  return result;
}

function normalisePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10)               return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}
