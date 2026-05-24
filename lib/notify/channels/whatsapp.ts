import prisma from '../../db';
import { getSetting } from '../../tenant';

interface WaResult { success: boolean; error?: string; }

export async function sendWhatsApp(
  tenantId: string,
  phone: string,
  templateName: string,
  variables: string[],
  meta?: { entityType?: string; entityId?: string; event?: string }
): Promise<WaResult> {
  const [authKey, waNumber, enabled] = await Promise.all([
    getSetting(tenantId, 'msg91_auth_key', ''),
    getSetting(tenantId, 'msg91_whatsapp_number', ''),
    getSetting(tenantId, 'notify_channel_whatsapp', 'false'),
  ]);

  if (enabled !== 'true' || !authKey || !waNumber) {
    return { success: false, error: 'WhatsApp channel not configured' };
  }

  const normalised = normalisePhone(phone);
  if (!normalised) return { success: false, error: 'Invalid phone number' };

  let result: WaResult = { success: false };

  try {
    const res = await fetch(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authkey: authKey },
        body: JSON.stringify({
          integrated_number: waNumber,
          content_type: 'template',
          payload: {
            to: normalised,
            type: 'template',
            template: {
              name: templateName,
              language: { code: 'en' },
              components: variables.length > 0 ? [{
                type: 'body',
                parameters: variables.map(v => ({ type: 'text', text: v })),
              }] : [],
            },
          },
        }),
      }
    );
    const data = await res.json();
    result = !data.error ? { success: true } : { success: false, error: JSON.stringify(data) };
  } catch (err: any) {
    result = { success: false, error: err.message };
  }

  await prisma.notificationLog.create({
    data: {
      tenantId, channel: 'whatsapp', recipient: normalised,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error ?? null,
      provider: 'msg91',
      entityType: meta?.entityType ?? null,
      entityId:   meta?.entityId   ?? null,
      event:      meta?.event      ?? null,
      messageBody: `Template: ${templateName}. Variables: ${variables.join(', ')}`,
    },
  }).catch((e) => {
    console.error('Failed to log WhatsApp notification:', e);
  });

  return result;
}

function normalisePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10)               return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}
