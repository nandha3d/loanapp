import prisma from '../db';
import { getSetting } from '../tenant';
import { sendSms } from './channels/sms';
import { sendWhatsApp } from './channels/whatsapp';
import { sendEmail } from './channels/email';
import { sendPushToUsers } from './channels/push';

// ── Message templates (EN / TA / HI) ─────────────────────────────────────────

export type EventKey =
  | 'payment_received'
  | 'payment_due_reminder'
  | 'loan_disbursed'
  | 'loan_overdue'
  | 'loan_closed'
  | 'penalty_accrued'
  | 'chit_auction_reminder_day'
  | 'chit_auction_reminder_hour';

const MESSAGES: Record<EventKey, Record<string, (d: Record<string, string>) => string>> = {
  payment_received: {
    en: d => `Hi ${d.name}, ₹${d.amount} received for loan ${d.loanCode} on ${d.date}. Balance: ₹${d.balance}. -${d.orgName}`,
    ta: d => `வணக்கம் ${d.name}, கடன் ${d.loanCode}க்கு ₹${d.amount} பெறப்பட்டது. மீதி: ₹${d.balance}. -${d.orgName}`,
    hi: d => `नमस्ते ${d.name}, ऋण ${d.loanCode} के लिए ₹${d.amount} प्राप्त हुआ। शेष: ₹${d.balance}। -${d.orgName}`,
  },
  payment_due_reminder: {
    en: d => `Hi ${d.name}, ₹${d.amount} due for loan ${d.loanCode} on ${d.date}. Pay on time to avoid penalty. -${d.orgName}`,
    ta: d => `வணக்கம் ${d.name}, ${d.date} அன்று கடன் ${d.loanCode}க்கு ₹${d.amount} செலுத்த வேண்டும். -${d.orgName}`,
    hi: d => `नमस्ते ${d.name}, ${d.date} को ऋण ${d.loanCode} के लिए ₹${d.amount} देय है। -${d.orgName}`,
  },
  loan_disbursed: {
    en: d => `Hi ${d.name}, loan ${d.loanCode} of ₹${d.amount} disbursed. First instalment due: ${d.firstDue}. -${d.orgName}`,
    ta: d => `வணக்கம் ${d.name}, ₹${d.amount} கடன் ${d.loanCode} வழங்கப்பட்டது. முதல் தவணை: ${d.firstDue}. -${d.orgName}`,
    hi: d => `नमस्ते ${d.name}, ₹${d.amount} का ऋण ${d.loanCode} स्वीकृत हुआ। पहली किस्त: ${d.firstDue}। -${d.orgName}`,
  },
  loan_overdue: {
    en: d => `Hi ${d.name}, loan ${d.loanCode} is ${d.days} days overdue. Penalty: ₹${d.penalty}. Contact your agent. -${d.orgName}`,
    ta: d => `வணக்கம் ${d.name}, கடன் ${d.loanCode} ${d.days} நாட்கள் தாமதம். அபராதம்: ₹${d.penalty}. -${d.orgName}`,
    hi: d => `नमस्ते ${d.name}, ऋण ${d.loanCode} ${d.days} दिन अतिदेय। जुर्माना: ₹${d.penalty}। -${d.orgName}`,
  },
  loan_closed: {
    en: d => `Hi ${d.name}, loan ${d.loanCode} is fully closed. Thank you for your timely payments! -${d.orgName}`,
    ta: d => `வணக்கம் ${d.name}, கடன் ${d.loanCode} முழுமையாக மூடப்பட்டது. நன்றி! -${d.orgName}`,
    hi: d => `नमस्ते ${d.name}, ऋण ${d.loanCode} पूरी तरह बंद। धन्यवाद! -${d.orgName}`,
  },
  penalty_accrued: {
    en: d => `Hi ${d.name}, penalty of ₹${d.penalty} added to loan ${d.loanCode} for ${d.days} missed days. -${d.orgName}`,
    ta: d => `வணக்கம் ${d.name}, கடன் ${d.loanCode}க்கு ₹${d.penalty} அபராதம் சேர்க்கப்பட்டது. -${d.orgName}`,
    hi: d => `नमस्ते ${d.name}, ऋण ${d.loanCode} पर ₹${d.penalty} जुर्माना जोड़ा गया। -${d.orgName}`,
  },
  chit_auction_reminder_day: {
    en: d => `Hi ${d.name}, chit auction for ${d.groupName} period ${d.periodNumber} is scheduled at ${d.scheduledAt}. Please join the live room. -${d.orgName}`,
    ta: d => `Hi ${d.name}, chit auction for ${d.groupName} period ${d.periodNumber} is scheduled at ${d.scheduledAt}. Please join the live room. -${d.orgName}`,
    hi: d => `Hi ${d.name}, chit auction for ${d.groupName} period ${d.periodNumber} is scheduled at ${d.scheduledAt}. Please join the live room. -${d.orgName}`,
  },
  chit_auction_reminder_hour: {
    en: d => `Hi ${d.name}, chit auction for ${d.groupName} period ${d.periodNumber} starts at ${d.scheduledAt}. Please join the live room. -${d.orgName}`,
    ta: d => `Hi ${d.name}, chit auction for ${d.groupName} period ${d.periodNumber} starts at ${d.scheduledAt}. Please join the live room. -${d.orgName}`,
    hi: d => `Hi ${d.name}, chit auction for ${d.groupName} period ${d.periodNumber} starts at ${d.scheduledAt}. Please join the live room. -${d.orgName}`,
  },
};

// WhatsApp template names (pre-register these in MSG91 dashboard)
const WA_TEMPLATES: Record<EventKey, string> = {
  payment_received:     'lt_payment_received',
  payment_due_reminder: 'lt_due_reminder',
  loan_disbursed:       'lt_loan_disbursed',
  loan_overdue:         'lt_loan_overdue',
  loan_closed:          'lt_loan_closed',
  penalty_accrued:      'lt_penalty_accrued',
  chit_auction_reminder_day: 'lt_chit_auction_reminder_day',
  chit_auction_reminder_hour: 'lt_chit_auction_reminder_hour',
};

function interpolateTemplate(template: string, d: Record<string, string>): string {
  let result = template;
  const replacements: Record<string, string> = {
    '{customer}': d.name || '',
    '{amount}': d.amount || '',
    '{due_date}': d.date || '',
    '{loan_code}': d.loanCode || '',
    '{firstDue}': d.firstDue || '',
    '{days}': d.days || '',
    '{penalty}': d.penalty || '',
    '{balance}': d.balance || '',
    '{orgName}': d.orgName || '',
    '{start_date}': d.start_date || d.startDate || '',
    '{per_instalment}': d.per_instalment || d.perInstalment || '',
    '{principal}': d.principal || '',
    '{groupName}': d.groupName || '',
    '{periodNumber}': d.periodNumber || '',
    '{scheduledAt}': d.scheduledAt || '',
    '{chitValue}': d.chitValue || '',

    '{{customer_name}}': d.name || '',
    '{{amount}}': d.amount || '',
    '{{due_date}}': d.date || '',
    '{{loan_code}}': d.loanCode || '',
    '{{days}}': d.days || '',
    '{{penalty}}': d.penalty || '',
    '{{balance}}': d.balance || '',
    '{{currency_symbol}}': '₹',
    '{{principal}}': d.principal || '',
    '{{start_date}}': d.start_date || d.startDate || '',
    '{{per_instalment}}': d.per_instalment || d.perInstalment || '',
    '{{groupName}}': d.groupName || '',
    '{{periodNumber}}': d.periodNumber || '',
    '{{scheduledAt}}': d.scheduledAt || '',
    '{{chitValue}}': d.chitValue || '',
  };

  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

function extractPlaceholders(template: string, d: Record<string, string>): string[] {
  const regex = /\{([^}]+)\}|\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  const replacements: Record<string, string> = {
    'customer': d.name || '',
    'customer_name': d.name || '',
    'amount': d.amount || '',
    'due_date': d.date || '',
    'loan_code': d.loanCode || '',
    'firstDue': d.firstDue || '',
    'days': d.days || '',
    'penalty': d.penalty || '',
    'balance': d.balance || '',
    'orgName': d.orgName || '',
    'start_date': d.start_date || d.startDate || '',
    'per_instalment': d.per_instalment || d.perInstalment || '',
    'principal': d.principal || '',
    'currency_symbol': '₹',
  };

  while ((match = regex.exec(template)) !== null) {
    const key = match[1] || match[2];
    variables.push(replacements[key] ?? '');
  }
  return variables;
}

// ── Core dispatcher ───────────────────────────────────────────────────────────

interface NotifyParams {
  tenantId: string;
  event:    EventKey;
  phone:    string;
  email?:   string;
  lang?:    string;
  data:     Record<string, string>;  // vars for message template
  waVars?:  string[];                // ordered vars for WhatsApp template
  meta?: {
    entityType?: string;
    entityId?:   string;
  };
}

/**
 * Fire-and-forget notification dispatcher.
 * Call this from any server action or cron job.
 * It checks tenant settings before dispatching each channel.
 * Never throws — all errors logged to NotificationLog.
 */
export async function notify(params: NotifyParams): Promise<void> {
  const { tenantId, event, phone, email, lang = 'en', data, waVars, meta } = params;

  try {
    // 1. Check subscription gate
    const sub = await prisma.tenantSubscription.findUnique({
      where: { tenantId }
    });

    // Check if this event type is enabled for the tenant
    const eventEnabled = await getSetting(tenantId, `notify_event_${event}`, 'true');
    if (eventEnabled === 'false') return;

    // Check if general notifications are active
    const notificationsActive = await getSetting(tenantId, 'whatsapp_sms_active', 'true');
    if (notificationsActive === 'false') return;

    const languages = ['en', 'ta', 'hi', 'te', 'kn', 'ml'];
    const l = languages.includes(lang) ? lang : 'en';
    const appName = await getSetting(tenantId, 'app_name', 'LoanTrack');
    const enrichedData = { orgName: appName, ...data };

    // Fetch database templates for this event
    const dbTemplates = await prisma.notificationTemplate.findMany({
      where: {
        tenantId,
        name: event,
        lang: { in: [l, 'en'] },
      },
    });

    const getTemplate = (channel: string): string | null => {
      const t = dbTemplates.find((temp) => temp.channel === channel && temp.lang === l)
        || dbTemplates.find((temp) => temp.channel === channel && temp.lang === 'en');
      return t?.isActive ? t.body : null;
    };

    const getTemplateSubject = (channel: string): string | null => {
      const t = dbTemplates.find((temp) => temp.channel === channel && temp.lang === l)
        || dbTemplates.find((temp) => temp.channel === channel && temp.lang === 'en');
      return t?.isActive ? t.subject : null;
    };

    const smsBodyTemplate = getTemplate('sms');
    const waBodyTemplate = getTemplate('whatsapp');
    const pushBodyTemplate = getTemplate('push');

    const defaultSmsMessage = MESSAGES[event]?.[l]?.(enrichedData)
      || MESSAGES[event]?.en?.(enrichedData)
      || '';

    const message = smsBodyTemplate
      ? interpolateTemplate(smsBodyTemplate, enrichedData)
      : defaultSmsMessage;

    const notifyMeta = { ...meta, event };

    // Try WhatsApp & SMS if allowed by subscription
    if (sub?.whatsappSmsEnabled) {
      let waSent = { success: false };

      if (waBodyTemplate) {
        const parsedWaVars = extractPlaceholders(waBodyTemplate, enrichedData);
        waSent = await sendWhatsApp(
          tenantId, phone, WA_TEMPLATES[event], parsedWaVars.length > 0 ? parsedWaVars : (waVars ?? Object.values(data)), notifyMeta
        );
      } else {
        const waVarsToSend = waVars ?? Object.values(data);
        waSent = await sendWhatsApp(
          tenantId, phone, WA_TEMPLATES[event], waVarsToSend, notifyMeta
        );
      }

      if (!waSent.success) {
        // WhatsApp failed or not configured — try SMS
        await sendSms(tenantId, phone, message, notifyMeta);
      }
    } else {
      console.log(`[Notification Shield] WhatsApp/SMS disabled by subscription for tenant: ${tenantId}`);
    }

    // Try push notifications if configured and customer has active device tokens
    let customerUserId: string | null = null;
    if (meta?.entityType === 'customer' && meta?.entityId) {
      const cust = await prisma.customer.findUnique({
        where: { id: meta.entityId },
        select: { userId: true },
      });
      customerUserId = cust?.userId || null;
    } else if (meta?.entityType === 'loan' && meta?.entityId) {
      const ln = await prisma.loan.findUnique({
        where: { id: meta.entityId },
        select: { customer: { select: { userId: true } } },
      });
      customerUserId = ln?.customer?.userId || null;
    } else {
      const cust = await prisma.customer.findFirst({
        where: { tenantId, phone },
        select: { userId: true },
      });
      customerUserId = cust?.userId || null;
    }

    if (customerUserId && pushBodyTemplate) {
      const pushBody = interpolateTemplate(pushBodyTemplate, enrichedData);
      const customSubject = getTemplateSubject('push');
      const pushSubject = customSubject
        ? interpolateTemplate(customSubject, enrichedData)
        : 'LoanTrack Alert';

      await sendPushToUsers([customerUserId], {
        title: pushSubject,
        body: pushBody,
        data: {
          event,
          click_action: `/loans/${meta?.entityId || ''}`,
        },
      }).catch((err) => {
        console.error('Failed to send push notification:', err);
      });
    }

    // Email (independent of SMS/WA — send if configured and email provided)
    if (email) {
      const subject = emailSubject(event, enrichedData);
      const html    = emailHtml(event, message, enrichedData);
      await sendEmail(tenantId, email, subject, html, notifyMeta);
    }
  } catch (err) {
    console.error('Unified notification dispatch error:', err);
  }
}

function emailSubject(event: EventKey, d: Record<string, string>): string {
  const subjects: Partial<Record<EventKey, string>> = {
    payment_received:     `Payment Received — Loan ${d.loanCode}`,
    payment_due_reminder: `Reminder: Payment Due — Loan ${d.loanCode}`,
    loan_disbursed:       `Loan Disbursed — ${d.loanCode}`,
    loan_overdue:         `Overdue Notice — Loan ${d.loanCode}`,
    loan_closed:          `Loan Closed — ${d.loanCode}`,
    penalty_accrued:      `Penalty Notice — Loan ${d.loanCode}`,
  };
  return subjects[event] || `Notification — Loan ${d.loanCode || ''}`;
}

function emailHtml(event: EventKey, smsMessage: string, d: Record<string, string>): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff">
      <div style="border-bottom:2px solid #F5A623;padding-bottom:12px;margin-bottom:20px">
        <span style="font-size:20px;font-weight:800;color:#F5A623">${d.orgName || 'LoanTrack'}</span>
      </div>
      <p style="font-size:15px;color:#1A1A1A;line-height:1.6">${smsMessage.replace(/ -.*$/, '')}</p>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF">
        This is an automated message from ${d.orgName || 'LoanTrack'}. Do not reply to this email.
      </div>
    </div>
  `;
}
