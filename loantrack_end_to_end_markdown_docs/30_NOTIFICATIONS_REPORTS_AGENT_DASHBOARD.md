# Missing Features — Complete Implementation Guide
## Notifications · Reports · Agent Dashboard

> **Current state summary**
> - Notifications: `SystemNotification` model + in-app bell + page exist. `NotificationTemplate` model exists. Zero channel delivery (no SMS, no WhatsApp, no email). No trigger wiring from any business event.
> - Reports: CSV export for collections/loans/defaulters exists. No PDF reports, no scheduled email reports, no MFI/RBI-format exports.
> - Agent dashboard: Agents redirect to `/collection`. No personal performance page. No earnings/commission view. No daily target. No 7-day trend.

---

# PART 1 — Notifications: Channel Delivery

---

## 1.1 — Schema additions

**File:** `prisma/schema.prisma`

### Add `NotificationLog` model (after `NotificationTemplate`)

```prisma
model NotificationLog {
  id           String    @id @default(cuid())
  tenantId     String    @map("tenant_id")
  channel      String                          // sms | whatsapp | email | inapp
  recipient    String                          // phone number or email address
  status       String    @default("pending")   // pending | sent | delivered | failed
  errorMessage String?   @map("error_message") @db.Text
  entityType   String?   @map("entity_type")   // loan | customer | instalment | agent
  entityId     String?   @map("entity_id")
  event        String?                          // e.g. payment_received, loan_disbursed
  messageBody  String?   @map("message_body")  @db.Text
  provider     String?                          // msg91 | smtp | digio
  providerMsgId String?  @map("provider_msg_id")
  createdAt    DateTime  @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, channel, createdAt])
  @@index([entityType, entityId])
  @@map("notification_logs")
}
```

Add to `Tenant` model: `notificationLogs NotificationLog[]`

### Add notification settings keys to `AppSetting`

These are stored as key-value pairs in the existing `AppSetting` model via `setSetting()`. No schema change needed — just new keys:

| Key | Default | Purpose |
|---|---|---|
| `notify_channel_sms` | `false` | Enable SMS delivery |
| `notify_channel_whatsapp` | `false` | Enable WhatsApp delivery |
| `notify_channel_email` | `false` | Enable email delivery |
| `notify_event_payment_received` | `true` | Fire on collection entry |
| `notify_event_due_reminder` | `true` | Fire on due date reminder cron |
| `notify_event_loan_disbursed` | `true` | Fire on loan creation |
| `notify_event_loan_overdue` | `true` | Fire on penalty accrual cron |
| `notify_event_loan_closed` | `true` | Fire on loan close |
| `smtp_host` | `` | e.g. smtp.gmail.com |
| `smtp_port` | `587` | |
| `smtp_user` | `` | Sender email address |
| `smtp_pass` | `` | App password (encrypted) |
| `smtp_from_name` | `` | e.g. "Erode Finance Co." |
| `msg91_auth_key` | `` | MSG91 API key |
| `msg91_sender_id` | `LNTRCK` | 6-char DLT sender ID |
| `msg91_whatsapp_number` | `` | Registered WA business number |

Run migration:
```bash
npx prisma migrate dev --name add_notification_log
npx prisma generate
```

---

## 1.2 — Create `lib/notify/channels/sms.ts`

**Create directory:** `lib/notify/`
**Create file:** `lib/notify/channels/sms.ts`

```ts
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
    const res = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: authKey },
      body: JSON.stringify({
        sender: senderId,
        short_url: '0',
        recipients: [{ mobiles: normalised, message }],
      }),
    });
    const data = await res.json();
    result = data.type === 'success'
      ? { success: true, providerMsgId: data.request_id }
      : { success: false, error: data.message };
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
  }).catch(() => {});

  return result;
}

function normalisePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10)               return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}
```

---

## 1.3 — Create `lib/notify/channels/whatsapp.ts`

```ts
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
    },
  }).catch(() => {});

  return result;
}

function normalisePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10)               return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}
```

---

## 1.4 — Create `lib/notify/channels/email.ts`

> Uses Node's built-in `net` module via `nodemailer`. Install first:
> ```bash
> npm install nodemailer @types/nodemailer
> ```

```ts
import nodemailer from 'nodemailer';
import prisma from '../../db';
import { getSetting } from '../../tenant';

interface EmailResult { success: boolean; error?: string; }

export async function sendEmail(
  tenantId: string,
  to: string,
  subject: string,
  html: string,
  meta?: { entityType?: string; entityId?: string; event?: string }
): Promise<EmailResult> {
  const [host, port, user, pass, fromName, enabled] = await Promise.all([
    getSetting(tenantId, 'smtp_host',      ''),
    getSetting(tenantId, 'smtp_port',      '587'),
    getSetting(tenantId, 'smtp_user',      ''),
    getSetting(tenantId, 'smtp_pass',      ''),
    getSetting(tenantId, 'smtp_from_name', 'LoanTrack'),
    getSetting(tenantId, 'notify_channel_email', 'false'),
  ]);

  if (enabled !== 'true' || !host || !user || !pass) {
    return { success: false, error: 'Email channel not configured' };
  }

  let result: EmailResult = { success: false };

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to,
      subject,
      html,
    });

    result = { success: true };
  } catch (err: any) {
    result = { success: false, error: err.message };
  }

  await prisma.notificationLog.create({
    data: {
      tenantId, channel: 'email', recipient: to,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error ?? null,
      provider: 'smtp',
      entityType: meta?.entityType ?? null,
      entityId:   meta?.entityId   ?? null,
      event:      meta?.event      ?? null,
    },
  }).catch(() => {});

  return result;
}
```

---

## 1.5 — Create `lib/notify/events.ts` (the single entry point)

**All code that triggers notifications imports from here only.**

```ts
import { getSetting } from '../tenant';
import { sendSms } from './channels/sms';
import { sendWhatsApp } from './channels/whatsapp';
import { sendEmail } from './channels/email';

// ── Message templates (EN / TA / HI) ─────────────────────────────────────────

type EventKey =
  | 'payment_received'
  | 'payment_due_reminder'
  | 'loan_disbursed'
  | 'loan_overdue'
  | 'loan_closed'
  | 'penalty_accrued';

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
};

// WhatsApp template names (pre-register these in MSG91 dashboard)
const WA_TEMPLATES: Record<EventKey, string> = {
  payment_received:     'lt_payment_received',
  payment_due_reminder: 'lt_due_reminder',
  loan_disbursed:       'lt_loan_disbursed',
  loan_overdue:         'lt_loan_overdue',
  loan_closed:          'lt_loan_closed',
  penalty_accrued:      'lt_penalty_accrued',
};

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

  // Check if this event type is enabled for the tenant
  const eventEnabled = await getSetting(tenantId, `notify_event_${event}`, 'true');
  if (eventEnabled === 'false') return;

  const l = ['en', 'ta', 'hi'].includes(lang) ? lang : 'en';
  const message = MESSAGES[event]?.[l]?.(data) ?? MESSAGES[event]?.en?.(data) ?? '';

  const notifyMeta = { ...meta, event };

  // Try WhatsApp first (richer experience), fall back to SMS
  const waVarsToSend = waVars ?? Object.values(data);
  const waSent = await sendWhatsApp(
    tenantId, phone, WA_TEMPLATES[event], waVarsToSend, notifyMeta
  );

  if (!waSent.success) {
    // WhatsApp failed or not configured — try SMS
    await sendSms(tenantId, phone, message, notifyMeta);
  }

  // Email (independent of SMS/WA — send if configured and email provided)
  if (email) {
    const subject = emailSubject(event, data);
    const html    = emailHtml(event, message, data);
    await sendEmail(tenantId, email, subject, html, notifyMeta);
  }
}

function emailSubject(event: EventKey, d: Record<string, string>): string {
  const subjects: Record<EventKey, string> = {
    payment_received:     `Payment Received — Loan ${d.loanCode}`,
    payment_due_reminder: `Reminder: Payment Due — Loan ${d.loanCode}`,
    loan_disbursed:       `Loan Disbursed — ${d.loanCode}`,
    loan_overdue:         `Overdue Notice — Loan ${d.loanCode}`,
    loan_closed:          `Loan Closed — ${d.loanCode}`,
    penalty_accrued:      `Penalty Notice — Loan ${d.loanCode}`,
  };
  return subjects[event];
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
```

---

## 1.6 — Wire `notify()` into existing actions

### `app/(dashboard)/collection/actions.ts`

Add after `CollectionEntry` is created:

```ts
// Add import at top:
import { notify } from '@/lib/notify/events';

// Add inside submitCollectionEntry, after the DB writes, fire-and-forget:
const balance = Math.max(0, Number(loan.principal) - Number(loan.totalCollected) - receivedAmount);
notify({
  tenantId,
  event:   'payment_received',
  phone:   customer.phone,
  email:   customer.email ?? undefined,
  data: {
    name:     customer.name,
    amount:   receivedAmount.toLocaleString('en-IN'),
    loanCode: loan.loanCode,
    date:     new Date().toLocaleDateString('en-IN'),
    balance:  balance.toLocaleString('en-IN'),
    orgName:  tenantId, // replace with getSetting(tenantId, 'app_name') if available
  },
  meta: { entityType: 'loan', entityId: loan.id },
}).catch(() => {});
```

### `app/(dashboard)/loans/actions.ts`

Add after loan + instalments are created:

```ts
import { notify } from '@/lib/notify/events';

const firstDueDate = instalmentDates[0]
  ? new Date(instalmentDates[0]).toLocaleDateString('en-IN') : '-';

notify({
  tenantId,
  event: 'loan_disbursed',
  phone: customer.phone,
  email: customer.email ?? undefined,
  data: {
    name:     customer.name,
    amount:   disbursed.toLocaleString('en-IN'),
    loanCode,
    firstDue: firstDueDate,
    orgName:  tenantId,
  },
  meta: { entityType: 'loan', entityId: newLoan.id },
}).catch(() => {});
```

### `app/(dashboard)/loans/[id]/actions.ts`

Add after `closeLoan` updates status:

```ts
import { notify } from '@/lib/notify/events';

notify({
  tenantId,
  event: 'loan_closed',
  phone: loan.customer.phone,
  email: loan.customer.email ?? undefined,
  data: { name: loan.customer.name, loanCode: loan.loanCode, orgName: tenantId },
  meta: { entityType: 'loan', entityId: loanId },
}).catch(() => {});
```

### `app/api/cron/accrue-penalties/route.ts`

Add inside the per-loan loop after penalty upsert:

```ts
import { notify } from '@/lib/notify/events';

if (loan.customer?.phone) {
  notify({
    tenantId: loan.tenantId,
    event:    'loan_overdue',
    phone:    loan.customer.phone,
    data: {
      name:     loan.customer.name,
      loanCode: loan.loanCode,
      days:     String(totalMissedDays),
      penalty:  String(grossPenalty),
      orgName:  loan.tenantId,
    },
    meta: { entityType: 'loan', entityId: loan.id },
  }).catch(() => {});
}
```

---

## 1.7 — Create due-date reminder cron

**Create:** `app/api/cron/send-reminders/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { notify } from '@/lib/notify/events';
import dayjs from 'dayjs';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tomorrow = dayjs().add(1, 'day').startOf('day').toDate();
  const tomorrowEnd = dayjs().add(1, 'day').endOf('day').toDate();

  // Fetch all upcoming instalments due tomorrow
  const instalments = await prisma.instalment.findMany({
    where: {
      dueDate: { gte: tomorrow, lte: tomorrowEnd },
      status:  'upcoming',
      loan: { status: 'active' },
    },
    include: {
      loan: {
        include: {
          customer: { select: { name: true, phone: true, email: true } },
        },
      },
    },
    take: 1000, // process max 1000 per run; add pagination for larger tenants
  });

  let sent = 0;
  for (const inst of instalments) {
    const { loan } = inst;
    if (!loan.customer?.phone) continue;

    await notify({
      tenantId: loan.tenantId,
      event:    'payment_due_reminder',
      phone:    loan.customer.phone,
      email:    loan.customer.email ?? undefined,
      data: {
        name:     loan.customer.name,
        amount:   Number(inst.dueAmount).toLocaleString('en-IN'),
        loanCode: loan.loanCode,
        date:     dayjs(inst.dueDate).format('DD MMM YYYY'),
        orgName:  loan.tenantId,
      },
      meta: { entityType: 'instalment', entityId: inst.id },
    });

    sent++;
    // Throttle: 100ms between messages to respect provider rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  return NextResponse.json({ ok: true, remindersSent: sent, processedAt: new Date().toISOString() });
}
```

**Add to `vercel.json`:**

```json
{ "path": "/api/cron/send-reminders", "schedule": "30 2 * * *" }
```
`"30 2 * * *"` = 08:00 AM IST (02:30 UTC) daily.

---

## 1.8 — Add Notification Settings UI to `SettingsClient.tsx`

Inside the system settings form, add a new Notifications section:

```tsx
{/* ── Notification Settings ── */}
<div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
  <div className="form-section-title">Notification Channels</div>

  {/* Channel toggles */}
  <div className="grid-3" style={{ marginBottom: '16px' }}>
    {[
      { key: 'notify_channel_sms',       label: 'SMS (MSG91)' },
      { key: 'notify_channel_whatsapp',  label: 'WhatsApp (MSG91)' },
      { key: 'notify_channel_email',     label: 'Email (SMTP)' },
    ].map(({ key, label }) => (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="checkbox" name={key} id={key}
          defaultChecked={settings[key] === 'true'} value="true" />
        <label htmlFor={key} style={{ fontSize: '13px' }}>{label}</label>
      </div>
    ))}
  </div>

  {/* MSG91 credentials */}
  <div className="form-row">
    <div className="form-group">
      <label className="form-label">MSG91 Auth Key</label>
      <input type="password" name="msg91_auth_key" className="form-control"
        defaultValue={settings.msg91_auth_key || ''} placeholder="Paste MSG91 auth key" />
    </div>
    <div className="form-group">
      <label className="form-label">SMS Sender ID</label>
      <input type="text" name="msg91_sender_id" className="form-control"
        defaultValue={settings.msg91_sender_id || 'LNTRCK'} maxLength={6} />
    </div>
    <div className="form-group">
      <label className="form-label">WhatsApp Business Number</label>
      <input type="text" name="msg91_whatsapp_number" className="form-control"
        defaultValue={settings.msg91_whatsapp_number || ''} placeholder="917xxxxxxxxxx" />
    </div>
  </div>

  {/* SMTP credentials */}
  <div style={{ marginTop: '16px' }}>
    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SMTP (Email)</div>
    <div className="form-row">
      <div className="form-group">
        <label className="form-label">SMTP Host</label>
        <input type="text" name="smtp_host" className="form-control"
          defaultValue={settings.smtp_host || ''} placeholder="smtp.gmail.com" />
      </div>
      <div className="form-group">
        <label className="form-label">SMTP Port</label>
        <input type="number" name="smtp_port" className="form-control"
          defaultValue={settings.smtp_port || '587'} />
      </div>
    </div>
    <div className="form-row">
      <div className="form-group">
        <label className="form-label">SMTP User (Email)</label>
        <input type="email" name="smtp_user" className="form-control"
          defaultValue={settings.smtp_user || ''} />
      </div>
      <div className="form-group">
        <label className="form-label">SMTP Password / App Password</label>
        <input type="password" name="smtp_pass" className="form-control"
          defaultValue={settings.smtp_pass || ''} />
      </div>
      <div className="form-group">
        <label className="form-label">From Name</label>
        <input type="text" name="smtp_from_name" className="form-control"
          defaultValue={settings.smtp_from_name || ''} placeholder="Your Company Name" />
      </div>
    </div>
  </div>

  {/* Event toggles */}
  <div style={{ marginTop: '16px' }}>
    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Events to Notify</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
      {[
        { key: 'notify_event_payment_received',     label: 'Payment received' },
        { key: 'notify_event_due_reminder',         label: 'Due date reminder' },
        { key: 'notify_event_loan_disbursed',       label: 'Loan disbursed' },
        { key: 'notify_event_loan_overdue',         label: 'Loan overdue' },
        { key: 'notify_event_loan_closed',          label: 'Loan closed' },
        { key: 'notify_event_penalty_accrued',      label: 'Penalty accrued' },
      ].map(({ key, label }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" name={key} id={key}
            defaultChecked={settings[key] !== 'false'} value="true" />
          <label htmlFor={key} style={{ fontSize: '12px' }}>{label}</label>
        </div>
      ))}
    </div>
  </div>
</div>
```

**Update `saveSystemSettings` in `settings/actions.ts`** to include all the new keys in the fields object. Add them to the existing key list that gets passed to `setSetting`.

---

## 1.9 — Notification Log Admin Page

**Create:** `app/(dashboard)/notifications/log/page.tsx`

```ts
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';

export default async function NotificationLogPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role === 'agent') redirect('/collection');

  const tenantId = await getDefaultTenantId();

  const logs = await prisma.notificationLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Notification Log</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Last 200 outbound messages</p>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th><th>Channel</th><th>Recipient</th>
              <th>Event</th><th>Status</th><th>Error</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                  {new Date(log.createdAt).toLocaleString('en-IN')}
                </td>
                <td>
                  <span className={`badge ${log.channel === 'whatsapp' ? 'badge-active' : log.channel === 'sms' ? 'badge-pending' : 'badge-info'}`}>
                    {log.channel.toUpperCase()}
                  </span>
                </td>
                <td style={{ fontSize: '12px' }}>{log.recipient}</td>
                <td style={{ fontSize: '12px' }}>{log.event?.replace(/_/g, ' ') ?? '-'}</td>
                <td>
                  <span className={`badge ${log.status === 'sent' ? 'badge-active' : 'badge-overdue'}`}>
                    {log.status}
                  </span>
                </td>
                <td style={{ fontSize: '11px', color: 'var(--danger)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.errorMessage || '-'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px' }}>
                  No notifications sent yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Add link in Sidebar for admin+ role: `{ href: '/notifications/log', icon: 'send', label: 'Notification Log', adminOnly: true }`.

---

---

# PART 2 — Reports: PDF + Scheduled Email

---

## 2.1 — Install dependencies

```bash
npm install nodemailer @types/nodemailer
# @react-pdf/renderer is already installed
```

---

## 2.2 — Create `lib/reports/pdf.tsx` (report PDF component)

```tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const S = StyleSheet.create({
  page:      { fontFamily: 'Helvetica', fontSize: 9, padding: 36 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1.5 solid #F5A623', paddingBottom: 8 },
  brandName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#F5A623' },
  brandSub:  { fontSize: 7, color: '#6B7280', marginTop: 2 },
  reportTitle:{ fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  period:    { fontSize: 7, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  section:   { marginBottom: 14 },
  sHead:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1A1A1A', marginBottom: 6, backgroundColor: '#F8F9FA', padding: 4 },
  row:       { flexDirection: 'row', borderBottom: '0.5 solid #E5E7EB', paddingVertical: 3, paddingHorizontal: 2 },
  th:        { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6B7280' },
  td:        { fontSize: 8, color: '#1A1A1A' },
  kpiGrid:   { flexDirection: 'row', gap: 8, marginBottom: 14 },
  kpiBox:    { flex: 1, border: '0.5 solid #E5E7EB', borderRadius: 4, padding: 8 },
  kpiVal:    { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#F5A623' },
  kpiLbl:    { fontSize: 7, color: '#6B7280', marginTop: 2 },
});

function fmt(n: number, sym = '₹') {
  return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

interface ReportData {
  from: string;
  to: string;
  appName: string;
  branchName: string;
  collectionEfficiency: { expected: number; collected: number; efficiency: number };
  agentPerformance: { name: string; route: string; customers: number; expected: number; collected: number; hitRate: number }[];
  penaltyReport: { accrued: number; settled: number; waived: number };
  disbursement: { count: number; totalPrincipal: number };
  agingBuckets: {
    short:  { count: number; penalty: number };
    medium: { count: number; penalty: number };
    long:   { count: number; penalty: number };
  };
  currencySymbol: string;
}

export function CollectionReportPDF({ data }: { data: ReportData }) {
  const sym = data.currencySymbol;

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.brandName}>{data.appName}</Text>
            <Text style={S.brandSub}>{data.branchName}</Text>
          </View>
          <View>
            <Text style={S.reportTitle}>COLLECTION REPORT</Text>
            <Text style={S.period}>{data.from} to {data.to}</Text>
          </View>
        </View>

        {/* KPI summary */}
        <View style={S.kpiGrid}>
          <View style={S.kpiBox}>
            <Text style={S.kpiVal}>{fmt(data.collectionEfficiency.collected, sym)}</Text>
            <Text style={S.kpiLbl}>Total Collected</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiVal}>{fmt(data.collectionEfficiency.expected, sym)}</Text>
            <Text style={S.kpiLbl}>Total Expected</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiVal}>{data.collectionEfficiency.efficiency}%</Text>
            <Text style={S.kpiLbl}>Efficiency</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiVal}>{data.disbursement.count}</Text>
            <Text style={S.kpiLbl}>Loans Disbursed</Text>
          </View>
        </View>

        {/* Agent performance table */}
        <View style={S.section}>
          <Text style={S.sHead}>Agent Performance</Text>
          <View style={[S.row, { backgroundColor: '#F3F4F6' }]}>
            <Text style={[S.th, { width: '22%' }]}>Agent</Text>
            <Text style={[S.th, { width: '20%' }]}>Route</Text>
            <Text style={[S.th, { width: '10%', textAlign: 'right' }]}>Customers</Text>
            <Text style={[S.th, { width: '16%', textAlign: 'right' }]}>Expected</Text>
            <Text style={[S.th, { width: '16%', textAlign: 'right' }]}>Collected</Text>
            <Text style={[S.th, { width: '16%', textAlign: 'right' }]}>Hit Rate</Text>
          </View>
          {data.agentPerformance.map((a, i) => (
            <View key={i} style={[S.row, { backgroundColor: i % 2 === 1 ? '#F9FAFB' : '#fff' }]}>
              <Text style={[S.td, { width: '22%' }]}>{a.name}</Text>
              <Text style={[S.td, { width: '20%' }]}>{a.route}</Text>
              <Text style={[S.td, { width: '10%', textAlign: 'right' }]}>{a.customers}</Text>
              <Text style={[S.td, { width: '16%', textAlign: 'right' }]}>{fmt(a.expected, sym)}</Text>
              <Text style={[S.td, { width: '16%', textAlign: 'right' }]}>{fmt(a.collected, sym)}</Text>
              <Text style={[S.td, { width: '16%', textAlign: 'right', color: a.hitRate >= 80 ? '#27AE60' : a.hitRate >= 50 ? '#F59E0B' : '#E74C3C', fontFamily: 'Helvetica-Bold' }]}>
                {a.hitRate}%
              </Text>
            </View>
          ))}
        </View>

        {/* Penalty summary */}
        <View style={S.section}>
          <Text style={S.sHead}>Penalty Summary</Text>
          <View style={S.kpiGrid}>
            <View style={S.kpiBox}>
              <Text style={[S.kpiVal, { color: '#E74C3C' }]}>{fmt(data.penaltyReport.accrued, sym)}</Text>
              <Text style={S.kpiLbl}>Total Accrued</Text>
            </View>
            <View style={S.kpiBox}>
              <Text style={[S.kpiVal, { color: '#27AE60' }]}>{fmt(data.penaltyReport.settled, sym)}</Text>
              <Text style={S.kpiLbl}>Settled</Text>
            </View>
            <View style={S.kpiBox}>
              <Text style={[S.kpiVal, { color: '#6B7280' }]}>{fmt(data.penaltyReport.waived, sym)}</Text>
              <Text style={S.kpiLbl}>Waived</Text>
            </View>
          </View>
        </View>

        {/* Aging */}
        <View style={S.section}>
          <Text style={S.sHead}>Overdue Aging</Text>
          <View style={[S.row, { backgroundColor: '#F3F4F6' }]}>
            <Text style={[S.th, { width: '40%' }]}>Bucket</Text>
            <Text style={[S.th, { width: '30%', textAlign: 'right' }]}>Customers</Text>
            <Text style={[S.th, { width: '30%', textAlign: 'right' }]}>Penalty</Text>
          </View>
          {[
            { label: '1–30 days overdue',   bucket: data.agingBuckets.short },
            { label: '31–90 days overdue',  bucket: data.agingBuckets.medium },
            { label: '90+ days overdue',    bucket: data.agingBuckets.long },
          ].map(({ label, bucket }, i) => (
            <View key={i} style={S.row}>
              <Text style={[S.td, { width: '40%' }]}>{label}</Text>
              <Text style={[S.td, { width: '30%', textAlign: 'right' }]}>{bucket.count}</Text>
              <Text style={[S.td, { width: '30%', textAlign: 'right' }]}>{fmt(bucket.penalty, sym)}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={{ marginTop: 20, borderTop: '0.5 solid #E5E7EB', paddingTop: 8 }}>
          <Text style={{ fontSize: 7, color: '#9CA3AF', textAlign: 'center' }}>
            Generated by {data.appName} · {new Date().toLocaleString('en-IN')} · Confidential
          </Text>
        </View>

      </Page>
    </Document>
  );
}
```

---

## 2.3 — Create PDF report download API route

**Create:** `app/api/reports/pdf/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { requireApiContext } from '@/lib/apiAuth';
import { CollectionReportPDF } from '@/lib/reports/pdf';
import { getBranding, getSetting } from '@/lib/tenant';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  const ctx = await requireApiContext(req);
  if (!ctx.success) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.role === 'agent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to   = searchParams.get('to')   || new Date().toISOString().slice(0, 10);

  // Re-use the same aggregation logic from reports/page.tsx
  // (extract it to lib/reports/data.ts for DRY — see Task 2.4)
  const reportData = await buildReportData(ctx.tenantId, ctx.appType, from, to);
  const branding   = await getBranding(ctx.tenantId);
  const currencySymbol = await getSetting(ctx.tenantId, 'currency_symbol', '₹');

  const buffer = await renderToBuffer(createElement(CollectionReportPDF, {
    data: {
      ...reportData,
      from, to,
      appName:    branding.appName,
      branchName: branding.appTagline,
      currencySymbol,
    },
  }));

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="report-${from}-to-${to}.pdf"`,
    },
  });
}

// Extracted from reports/page.tsx
async function buildReportData(tenantId: string, appType: string, from: string, to: string) {
  const dateFrom = new Date(from); dateFrom.setHours(0,0,0,0);
  const dateTo   = new Date(to);   dateTo.setHours(23,59,59,999);
  const loanBase = { tenantId, appType };

  const instalments = await prisma.instalment.findMany({
    where: { loan: loanBase, dueDate: { gte: dateFrom, lte: dateTo } },
    select: { dueAmount: true, receivedAmount: true, status: true },
  });
  const totalExpected  = instalments.reduce((s, i) => s + Number(i.dueAmount), 0);
  const totalCollected = instalments.filter(i => i.status === 'paid' || i.status === 'partial')
    .reduce((s, i) => s + Number(i.receivedAmount), 0);

  const penalties = await prisma.penalty.findMany({
    where: { loan: loanBase },
    select: { grossPenalty: true, settledAmount: true, waivedAmount: true, status: true },
  });
  const accrued = penalties.reduce((s, p) => s + Number(p.grossPenalty), 0);
  const settled = penalties.reduce((s, p) => s + Number(p.settledAmount), 0);
  const waived  = penalties.reduce((s, p) => s + Number(p.waivedAmount), 0);

  const loans = await prisma.loan.count({ where: { ...loanBase, createdAt: { gte: dateFrom, lte: dateTo } } });
  const totalPrincipal = (await prisma.loan.aggregate({ where: { ...loanBase, createdAt: { gte: dateFrom, lte: dateTo } }, _sum: { principal: true } }))._sum.principal;

  return {
    collectionEfficiency: {
      expected:   totalExpected,
      collected:  totalCollected,
      efficiency: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0,
    },
    penaltyReport: { accrued, settled, waived },
    disbursement:  { count: loans, totalPrincipal: Number(totalPrincipal) },
    agentPerformance: [],   // simplified for async build
    agingBuckets: {
      short:  { count: 0, penalty: 0 },
      medium: { count: 0, penalty: 0 },
      long:   { count: 0, penalty: 0 },
    },
  };
}
```

> **Note:** Extract the full aging and agentPerformance logic from `reports/page.tsx` into `lib/reports/data.ts` so both the page and the API route share the same data functions without duplication.

---

## 2.4 — Add PDF download button to `ReportsClient.tsx`

In the existing export buttons section, add after the last CSV button:

```tsx
<a
  href={`/api/reports/pdf?from=${filters.from}&to=${filters.to}`}
  className="btn btn-primary btn-sm"
  target="_blank"
  rel="noopener noreferrer"
>
  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>picture_as_pdf</span>
  Export PDF Report
</a>
```

---

## 2.5 — Scheduled email report cron

**Create:** `app/api/cron/send-reports/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendEmail } from '@/lib/notify/channels/email';
import { getBranding, getSetting } from '@/lib/tenant';
import dayjs from 'dayjs';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Run every Monday at 8AM — email weekly report to all admin users
  const tenants = await prisma.tenant.findMany({
    where: { status: 'active' },
    include: {
      users: { where: { role: { in: ['admin', 'superadmin'] }, status: 'active' }, select: { email: true, name: true } },
    },
  });

  let emailsSent = 0;

  for (const tenant of tenants) {
    const enabled = await getSetting(tenant.id, 'notify_channel_email', 'false');
    if (enabled !== 'true') continue;

    const branding = await getBranding(tenant.id);
    const from = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    const to   = dayjs().format('YYYY-MM-DD');

    // Build simple HTML summary
    const [totalCollected, overdueCount] = await Promise.all([
      prisma.collectionEntry.aggregate({
        where: {
          submittedAt: { gte: new Date(from), lte: new Date(to) },
          collection:  { tenantId: tenant.id },
        },
        _sum: { receivedAmount: true },
      }),
      prisma.loan.count({ where: { tenantId: tenant.id, status: 'overdue' } }),
    ]);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <div style="border-bottom:2px solid #F5A623;padding-bottom:12px;margin-bottom:20px">
          <span style="font-size:20px;font-weight:800;color:#F5A623">${branding.appName}</span>
          <span style="display:block;font-size:12px;color:#6B7280;margin-top:4px">Weekly Collection Report · ${from} to ${to}</span>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:12px;background:#F0FDF4;border-radius:6px;text-align:center">
              <div style="font-size:24px;font-weight:800;color:#27AE60">
                ₹${Number(totalCollected._sum.receivedAmount || 0).toLocaleString('en-IN')}
              </div>
              <div style="font-size:12px;color:#6B7280;margin-top:4px">Total Collected This Week</div>
            </td>
            <td style="width:16px"></td>
            <td style="padding:12px;background:#FEF2F2;border-radius:6px;text-align:center">
              <div style="font-size:24px;font-weight:800;color:#E74C3C">${overdueCount}</div>
              <div style="font-size:12px;color:#6B7280;margin-top:4px">Overdue Loans</div>
            </td>
          </tr>
        </table>
        <div style="margin-top:20px;padding:14px;background:#F8F9FA;border-radius:6px;font-size:13px;color:#374151">
          <a href="${process.env.AUTH_URL}/reports?from=${from}&to=${to}" style="color:#F5A623;font-weight:600">
            View full report →
          </a>
        </div>
        <div style="margin-top:24px;font-size:11px;color:#9CA3AF">
          This automated report is sent every Monday. To unsubscribe, disable email notifications in Settings.
        </div>
      </div>
    `;

    for (const user of tenant.users) {
      if (!user.email) continue;
      await sendEmail(
        tenant.id,
        user.email,
        `Weekly Collection Report — ${branding.appName} (${from} to ${to})`,
        html,
        { event: 'weekly_report' }
      );
      emailsSent++;
    }
  }

  return NextResponse.json({ ok: true, emailsSent });
}
```

**Add to `vercel.json`:**

```json
{ "path": "/api/cron/send-reports", "schedule": "30 2 * * 1" }
```
`"30 2 * * 1"` = Monday 8:00 AM IST (02:30 UTC).

---

---

# PART 3 — Agent Personal Dashboard

---

## 3.1 — Create `app/(dashboard)/agent-dashboard/page.tsx`

```ts
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getUserAppType, getSetting, getBranding } from '@/lib/tenant';
import prisma from '@/lib/db';
import AgentDashboardClient from './AgentDashboardClient';
import { getDictionary } from '@/lib/i18n';
import dayjs from 'dayjs';

export default async function AgentDashboardPage() {
  const session = await auth();
  const role    = (session?.user as any)?.role;
  const userId  = session?.user?.id;

  if (role !== 'agent' || !userId) redirect('/dashboard');

  const tenantId    = await getDefaultTenantId();
  const appType     = await getUserAppType();
  const branding    = await getBranding(tenantId);
  const dict        = await getDictionary(tenantId);
  const currencySymbol = branding.currencySymbol;

  const today    = dayjs().format('YYYY-MM-DD');
  const weekAgo  = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');

  // Today's collection record
  const todayRecord = await prisma.dailyCollection.findFirst({
    where: { tenantId, appType, agentId: userId, date: new Date(today) },
  });

  // Last 7 days bar chart data
  const weekRecords = await prisma.dailyCollection.findMany({
    where: {
      tenantId, appType, agentId: userId,
      date: { gte: new Date(weekAgo), lte: new Date(today) },
    },
    orderBy: { date: 'asc' },
  });

  // Fill in missing days (days with no collections show as zero)
  const weekData = Array.from({ length: 7 }).map((_, i) => {
    const d = dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD');
    const found = weekRecords.find(r => dayjs(r.date).format('YYYY-MM-DD') === d);
    return {
      date:      dayjs(d).format('DD MMM'),
      collected: Number(found?.totalCollected || 0),
      expected:  Number(found?.totalExpected  || 0),
    };
  });

  // Month-to-date aggregates
  const monthAgg = await prisma.dailyCollection.aggregate({
    where: { tenantId, appType, agentId: userId, date: { gte: new Date(monthStart) } },
    _sum: { totalCollected: true, totalExpected: true },
  });

  // My active loans count (customers on my routes)
  const myRouteIds = await prisma.route.findMany({
    where: { tenantId, appType, assignedAgentId: userId, status: 'active' },
    select: { id: true },
  }).then(r => r.map(x => x.id));

  const [activeLoanCount, overdueCount, myCustomerCount, pendingTodayCount] = await Promise.all([
    prisma.loan.count({ where: { tenantId, appType, status: 'active', customer: { routeId: { in: myRouteIds } } } }),
    prisma.loan.count({ where: { tenantId, appType, status: 'overdue', customer: { routeId: { in: myRouteIds } } } }),
    prisma.customer.count({ where: { tenantId, appType, routeId: { in: myRouteIds }, status: 'active' } }),
    prisma.instalment.count({
      where: {
        status: 'upcoming',
        dueDate: new Date(today),
        loan: { tenantId, appType, customer: { routeId: { in: myRouteIds } } },
      },
    }),
  ]);

  // Last 5 collections I submitted
  const recentCollections = await prisma.collectionEntry.findMany({
    where: { agentId: userId },
    orderBy: { submittedAt: 'desc' },
    take: 5,
    include: {
      customer: { select: { name: true, customerCode: true } },
      loan:     { select: { loanCode: true } },
    },
  });

  return (
    <AgentDashboardClient
      agentName={(session?.user as any)?.name || 'Agent'}
      todayExpected={Number(todayRecord?.totalExpected || 0)}
      todayCollected={Number(todayRecord?.totalCollected || 0)}
      weekData={weekData}
      monthCollected={Number(monthAgg._sum.totalCollected || 0)}
      monthExpected={Number(monthAgg._sum.totalExpected || 0)}
      activeLoanCount={activeLoanCount}
      overdueCount={overdueCount}
      myCustomerCount={myCustomerCount}
      pendingTodayCount={pendingTodayCount}
      recentCollections={recentCollections.map(c => ({
        customerName: c.customer.name,
        customerCode: c.customer.customerCode,
        loanCode:     c.loan?.loanCode ?? '',
        amount:       Number(c.receivedAmount),
        time:         c.submittedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }))}
      currencySymbol={currencySymbol}
    />
  );
}
```

---

## 3.2 — Create `app/(dashboard)/agent-dashboard/AgentDashboardClient.tsx`

```tsx
'use client';
import Link from 'next/link';

interface Props {
  agentName:        string;
  todayExpected:    number;
  todayCollected:   number;
  weekData:         { date: string; collected: number; expected: number }[];
  monthCollected:   number;
  monthExpected:    number;
  activeLoanCount:  number;
  overdueCount:     number;
  myCustomerCount:  number;
  pendingTodayCount:number;
  recentCollections:{ customerName: string; customerCode: string; loanCode: string; amount: number; time: string }[];
  currencySymbol:   string;
}

export default function AgentDashboardClient(p: Props) {
  const fmt   = (n: number) => `${p.currencySymbol}${n.toLocaleString('en-IN')}`;
  const pct   = (a: number, b: number) => b === 0 ? 0 : Math.min(100, Math.round((a / b) * 100));
  const todayPct  = pct(p.todayCollected, p.todayExpected);
  const monthPct  = pct(p.monthCollected, p.monthExpected);
  const maxExpected = Math.max(...p.weekData.map(d => d.expected), 1);

  const hitColor = (h: number) => h >= 80 ? 'var(--success)' : h >= 50 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="page-content">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'},{' '}
            {p.agentName.split(' ')[0]} 👋
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link href="/collection" className="btn btn-primary">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>payments</span>
          Go to Collection
        </Link>
      </div>

      {/* ── Today's progress card ──────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Today's Collection
            </div>
            <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--primary)' }}>
              {fmt(p.todayCollected)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              of {fmt(p.todayExpected)} expected
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', fontWeight: 800, color: hitColor(todayPct), lineHeight: 1 }}>
              {todayPct}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>hit rate</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--border)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
          <div style={{
            width: `${todayPct}%`, height: '100%',
            background: hitColor(todayPct),
            borderRadius: '4px',
            transition: 'width 0.6s ease',
          }} />
        </div>

        {/* Pending alert */}
        {p.pendingTodayCount > 0 && (
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--warning)', fontWeight: 500 }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>schedule</span>
            {p.pendingTodayCount} customer{p.pendingTodayCount > 1 ? 's' : ''} still pending today
          </div>
        )}
      </div>

      {/* ── KPI grid ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: 'My Customers', value: p.myCustomerCount, color: 'var(--primary)' },
          { label: 'Active Loans', value: p.activeLoanCount, color: 'var(--success)' },
          { label: 'Overdue',      value: p.overdueCount,    color: 'var(--danger)' },
          { label: 'Month Rate',   value: `${monthPct}%`,    color: hitColor(monthPct) },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── 7-day bar chart ───────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '14px' }}>Last 7 Days</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '88px' }}>
          {p.weekData.map((day, i) => {
            const expH  = Math.round((day.expected  / maxExpected) * 80);
            const colH  = Math.round((day.collected / maxExpected) * 80);
            const rate  = day.expected > 0 ? Math.round((day.collected / day.expected) * 100) : 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }} title={`${day.date}: ${rate}% (${fmt(day.collected)} of ${fmt(day.expected)})`}>
                <div style={{ position: 'relative', width: '100%', height: `${Math.max(expH, 4)}px`, background: 'var(--border)', borderRadius: '3px 3px 0 0', minHeight: '4px' }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${colH}px`, background: hitColor(rate), borderRadius: '3px 3px 0 0', minHeight: colH > 0 ? '3px' : '0', transition: 'height 0.5s ease' }} />
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{day.date}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: '8px', display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <span>■ <span style={{ color: 'var(--success)' }}>Collected</span></span>
          <span>■ <span style={{ color: 'var(--border)' }}>Expected</span></span>
          <span style={{ marginLeft: 'auto' }}>Month: {fmt(p.monthCollected)} of {fmt(p.monthExpected)} ({monthPct}%)</span>
        </div>
      </div>

      {/* ── Recent collections ───────────────────────────────────── */}
      {p.recentCollections.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px' }}>Recent Collections</div>
          {p.recentCollections.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < p.recentCollections.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{c.customerName}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.loanCode} · {c.time}</div>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--success)' }}>{fmt(c.amount)}</div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
```

---

## 3.3 — Update root redirect and middleware

### `app/page.tsx` — change agent redirect

```ts
// Change:
if (role === 'agent') redirect('/collection');
// To:
if (role === 'agent') redirect('/agent-dashboard');
```

### `middleware.ts` — remove `/agent-dashboard` from blocked list

The `AGENT_BLOCKED` array blocks certain paths for agents. Make sure `/agent-dashboard` is **not** in that list. It should only block the admin-specific routes:

```ts
const AGENT_BLOCKED = [
  '/dashboard',    // admin dashboard — still blocked
  '/loans',
  '/penalties',
  '/reports',
  '/settings',
  '/vehicles',
  '/chits',
  // '/agent-dashboard' — agents can access this
];
```

### `components/layout/Sidebar.tsx` — add agent nav items

```tsx
// For agent role, show:
{ href: '/agent-dashboard', icon: 'dashboard',  label: dict.sidebar.dashboard,   agentOnly: true },
{ href: '/collection',      icon: 'payments',   label: dict.sidebar.collection,  agentOnly: true },
{ href: '/customers',       icon: 'people',     label: dict.sidebar.customers,   agentOnly: true },
{ href: '/approvals',       icon: 'check_circle', label: dict.sidebar.approvals, agentOnly: true },
```

---

## 3.4 — i18n additions

**File:** `i18n/en.ts`

Add inside `dashboard` section:

```ts
goodMorning:        'Good morning',
goodAfternoon:      'Good afternoon',
todayCollection:    "Today's Collection",
hitRate:            'Hit rate',
myCustomers:        'My Customers',
activeLoans:        'Active Loans',
last7Days:          'Last 7 Days',
recentCollections:  'Recent Collections',
pendingToday:       'customers pending today',
monthRate:          'Month Rate',
```

Add to `i18n/ta.ts`:

```ts
goodMorning:        'காலை வணக்கம்',
goodAfternoon:      'மதிய வணக்கம்',
todayCollection:    'இன்றைய வசூல்',
hitRate:            'வசூல் விகிதம்',
myCustomers:        'என் வாடிக்கையாளர்கள்',
activeLoans:        'செயலில் உள்ள கடன்கள்',
last7Days:          'கடந்த 7 நாட்கள்',
recentCollections:  'சமீபத்திய வசூல்கள்',
pendingToday:       'வாடிக்கையாளர்கள் நிலுவை',
monthRate:          'மாத விகிதம்',
```

Add equivalent translations to `i18n/hi.ts`.

---

## Migration & Build Checklist

```bash
# 1. Install nodemailer
npm install nodemailer @types/nodemailer

# 2. Apply schema migration
npx prisma migrate dev --name add_notification_log
npx prisma generate

# 3. Build check
npm run build

# 4. Add cron jobs to vercel.json
#    /api/cron/send-reminders  → "30 2 * * *"   (daily 8AM IST)
#    /api/cron/send-reports    → "30 2 * * 1"   (Monday 8AM IST)

# 5. Register MSG91 WhatsApp templates (takes 24-48 hours for approval):
#    lt_payment_received, lt_due_reminder, lt_loan_disbursed,
#    lt_loan_overdue, lt_loan_closed, lt_penalty_accrued

# 6. Configure notification settings in Settings page for each tenant
```
