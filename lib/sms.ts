import prisma from './db';

const MSG91_BASE = 'https://api.msg91.com/api/v5';
const authKey   = process.env.MSG91_AUTH_KEY;
const senderId  = process.env.MSG91_SENDER_ID || 'LNTRCK';
const waNumber  = process.env.MSG91_WHATSAPP_NUMBER;

// ─── Types ───────────────────────────────────────
export type NotificationEvent =
  | 'payment_received'
  | 'payment_due_reminder'
  | 'loan_disbursed'
  | 'loan_overdue'
  | 'loan_closed'
  | 'penalty_accrued'
  | 'collection_summary'; // for agents

interface SendSmsParams {
  phone: string;
  message: string;
  tenantId: string;
  entityType?: string;
  entityId?: string;
}

interface SendWhatsAppParams {
  phone: string;
  templateName: string;
  variables: string[];  // ordered replacement vars
  tenantId: string;
}

// ─── Guard Check ─────────────────────────────────
async function checkNotificationAllowed(tenantId: string): Promise<boolean> {
  try {
    const sub = await prisma.tenantSubscription.findUnique({
      where: { tenantId }
    });
    if (!sub || !sub.whatsappSmsEnabled) {
      return false;
    }
    const setting = await prisma.appSetting.findUnique({
      where: { tenantId_key: { tenantId, key: 'whatsapp_sms_active' } }
    });
    // Default to true if not explicitly set to 'false'
    if (setting && setting.value === 'false') {
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error checking notification allowed:', err);
    return false;
  }
}

// ─── Low-level MSG91 helpers ──────────────────────

async function sendSms({ phone, message, tenantId, entityType, entityId }: SendSmsParams): Promise<boolean> {
  if (!await checkNotificationAllowed(tenantId)) {
    console.log(`[SMS Shield] Notifications disabled for tenant: ${tenantId}`);
    return false;
  }
  if (!authKey) { console.warn('MSG91_AUTH_KEY not set — SMS skipped'); return false; }

  const normalised = normalisePhone(phone);
  if (!normalised) return false;

  try {
    const res = await fetch(`${MSG91_BASE}/flow/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: authKey },
      body: JSON.stringify({
        template_id: process.env.MSG91_SMS_OTP_TEMPLATE || '',
        short_url: '0',
        recipients: [{ mobiles: normalised, message }],
        sender: senderId,
      }),
    });
    const data = await res.json();
    const success = data.type === 'success';

    // Log to NotificationLog for audit
    await prisma.notificationLog.create({
      data: {
        tenantId, channel: 'sms', recipient: normalised,
        status: success ? 'sent' : 'failed',
        errorMessage: success ? null : JSON.stringify(data),
        entityType: entityType ?? null, entityId: entityId ?? null,
      },
    }).catch(() => {});

    return success;
  } catch (err) {
    console.error('SMS send error:', err);
    return false;
  }
}

async function sendWhatsApp({ phone, templateName, variables, tenantId }: SendWhatsAppParams): Promise<boolean> {
  if (!await checkNotificationAllowed(tenantId)) {
    console.log(`[WhatsApp Shield] Notifications disabled for tenant: ${tenantId}`);
    return false;
  }
  if (!authKey || !waNumber || process.env.ENABLE_WHATSAPP !== 'true') return false;

  const normalised = normalisePhone(phone);
  if (!normalised) return false;

  try {
    const res = await fetch(`${MSG91_BASE}/whatsapp/whatsapp-outbound-message/bulk/`, {
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
    });
    const data = await res.json();
    const success = !data.error;

    await prisma.notificationLog.create({
      data: {
        tenantId, channel: 'whatsapp', recipient: normalised,
        status: success ? 'sent' : 'failed',
        errorMessage: success ? null : JSON.stringify(data),
      },
    }).catch(() => {});

    return success;
  } catch (err) {
    console.error('WhatsApp send error:', err);
    return false;
  }
}

function normalisePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}

// ─── Message builders ─────────────────────────────

function buildMessage(event: NotificationEvent, data: Record<string, string>, lang: string = 'en'): string {
  const messages: Record<NotificationEvent, Record<string, string>> = {
    payment_received: {
      en: `Hi ${data.name}, payment of ₹${data.amount} received for loan ${data.loanCode} on ${data.date}. Balance: ₹${data.balance}. -LoanTrack`,
      ta: `வணக்கம் ${data.name}, கடன் ${data.loanCode} க்கு ₹${data.amount} பெறப்பட்டது ${data.date}. மீதி: ₹${data.balance}. -LoanTrack`,
      hi: `नमस्ते ${data.name}, ऋण ${data.loanCode} के लिए ₹${data.amount} प्राप्त हुआ ${data.date}। शेष: ₹${data.balance}। -LoanTrack`,
    },
    payment_due_reminder: {
      en: `Hi ${data.name}, ₹${data.amount} is due for loan ${data.loanCode} on ${data.date}. Pay on time to avoid penalty. -LoanTrack`,
      ta: `வணக்கம் ${data.name}, ${data.date} அன்று கடன் ${data.loanCode} க்கு ₹${data.amount} செலுத்த வேண்டும். -LoanTrack`,
      hi: `नमस्ते ${data.name}, ${data.date} को ऋण ${data.loanCode} के लिए ₹${data.amount} देय है। -LoanTrack`,
    },
    loan_disbursed: {
      en: `Hi ${data.name}, loan ${data.loanCode} of ₹${data.amount} has been disbursed. First instalment due: ${data.firstDue}. -LoanTrack`,
      ta: `வணக்கம் ${data.name}, ₹${data.amount} கடன் ${data.loanCode} வழங்கப்பட்டது. முதல் தவணை: ${data.firstDue}. -LoanTrack`,
      hi: `नमस्ते ${data.name}, ₹${data.amount} का ऋण ${data.loanCode} स्वीकृत हुआ। पहली किस्त: ${data.firstDue}। -LoanTrack`,
    },
    loan_overdue: {
      en: `Hi ${data.name}, loan ${data.loanCode} is overdue by ${data.days} days. Penalty: ₹${data.penalty}. Contact your agent immediately. -LoanTrack`,
      ta: `வணக்கம் ${data.name}, கடன் ${data.loanCode} ${data.days} நாட்கள் தாமதமாகியுள்ளது. அபராதம்: ₹${data.penalty}. -LoanTrack`,
      hi: `नमस्ते ${data.name}, ऋण ${data.loanCode} ${data.days} दिन अतिदेय है। जुर्माना: ₹${data.penalty}। -LoanTrack`,
    },
    loan_closed: {
      en: `Hi ${data.name}, loan ${data.loanCode} is now fully closed. Thank you for your timely payments! -LoanTrack`,
      ta: `வணக்கம் ${data.name}, கடன் ${data.loanCode} முழுமையாக மூடப்பட்டது. நன்றி! -LoanTrack`,
      hi: `नमस्ते ${data.name}, ऋण ${data.loanCode} पूरी तरह बंद हो गया। धन्यवाद! -LoanTrack`,
    },
    penalty_accrued: {
      en: `Hi ${data.name}, a penalty of ₹${data.penalty} has been added to loan ${data.loanCode} for ${data.days} missed days. -LoanTrack`,
      ta: `வணக்கம் ${data.name}, கடன் ${data.loanCode} க்கு ₹${data.penalty} அபராதம் சேர்க்கப்பட்டது. -LoanTrack`,
      hi: `नमस्ते ${data.name}, ऋण ${data.loanCode} पर ₹${data.penalty} जुर्माना जोड़ा गया। -LoanTrack`,
    },
    collection_summary: {
      en: `${data.name}, today's collection: ₹${data.collected} / ₹${data.expected} (${data.pct}%). Pending: ${data.pending} customers. -LoanTrack`,
      ta: `${data.name}, இன்றைய வசூல்: ₹${data.collected} / ₹${data.expected} (${data.pct}%). -LoanTrack`,
      hi: `${data.name}, आज का संग्रह: ₹${data.collected} / ₹${data.expected} (${data.pct}%)। -LoanTrack`,
    },
  };
  const l = ['en', 'ta', 'hi'].includes(lang) ? lang : 'en';
  return messages[event][l] || messages[event]['en'];
}

// ─── Public notification functions ────────────────

export async function notifyPaymentReceived(params: {
  tenantId: string; phone: string; name: string; amount: string;
  loanCode: string; date: string; balance: string; lang?: string; loanId?: string;
}) {
  const msg = buildMessage('payment_received', params, params.lang);
  // Try WhatsApp first, fall back to SMS
  const sent = await sendWhatsApp({
    phone: params.phone,
    templateName: 'loantrack_payment_received',
    variables: [params.name, params.amount, params.loanCode, params.date, params.balance],
    tenantId: params.tenantId,
  });
  if (!sent) await sendSms({ phone: params.phone, message: msg, tenantId: params.tenantId, entityType: 'loan', entityId: params.loanId });
}

export async function notifyPaymentDueReminder(params: {
  tenantId: string; phone: string; name: string; amount: string;
  loanCode: string; date: string; lang?: string; loanId?: string;
}) {
  const msg = buildMessage('payment_due_reminder', params, params.lang);
  const sent = await sendWhatsApp({
    phone: params.phone,
    templateName: 'loantrack_due_reminder',
    variables: [params.name, params.amount, params.loanCode, params.date],
    tenantId: params.tenantId,
  });
  if (!sent) await sendSms({ phone: params.phone, message: msg, tenantId: params.tenantId, entityType: 'loan', entityId: params.loanId });
}

export async function notifyLoanDisbursed(params: {
  tenantId: string; phone: string; name: string; amount: string;
  loanCode: string; firstDue: string; lang?: string; loanId?: string;
}) {
  const msg = buildMessage('loan_disbursed', params, params.lang);
  const sent = await sendWhatsApp({
    phone: params.phone,
    templateName: 'loantrack_loan_disbursed',
    variables: [params.name, params.amount, params.loanCode, params.firstDue],
    tenantId: params.tenantId,
  });
  if (!sent) await sendSms({ phone: params.phone, message: msg, tenantId: params.tenantId, entityType: 'loan', entityId: params.loanId });
}

export async function notifyLoanOverdue(params: {
  tenantId: string; phone: string; name: string; loanCode: string;
  days: string; penalty: string; lang?: string; loanId?: string;
}) {
  const msg = buildMessage('loan_overdue', params, params.lang);
  await sendSms({ phone: params.phone, message: msg, tenantId: params.tenantId, entityType: 'loan', entityId: params.loanId });
}

export async function notifyLoanClosed(params: {
  tenantId: string; phone: string; name: string; loanCode: string; lang?: string; loanId?: string;
}) {
  const msg = buildMessage('loan_closed', params, params.lang);
  const sent = await sendWhatsApp({
    phone: params.phone,
    templateName: 'loantrack_loan_closed',
    variables: [params.name, params.loanCode],
    tenantId: params.tenantId,
  });
  if (!sent) await sendSms({ phone: params.phone, message: msg, tenantId: params.tenantId, entityType: 'loan', entityId: params.loanId });
}

export async function notifyAgentCollectionSummary(params: {
  tenantId: string; phone: string; name: string;
  collected: string; expected: string; pct: string; pending: string;
}) {
  const msg = buildMessage('collection_summary', params);
  await sendSms({ phone: params.phone, message: msg, tenantId: params.tenantId });
}
