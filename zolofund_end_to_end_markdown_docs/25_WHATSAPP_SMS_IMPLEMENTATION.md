# Feature 1 — WhatsApp & SMS Notifications (MSG91)

> Replaces the empty `lib/sms.ts` stub. Uses MSG91 (India's leading SMS/WhatsApp gateway) for automated borrower and agent notifications. All messages are tenant-branded and language-aware (EN/TA/HI).

---

## Environment Variables

Add to `.env` and Hostinger panel:

```bash
MSG91_AUTH_KEY=your_msg91_auth_key_here
MSG91_SENDER_ID=LNTRCK          # 6-char approved sender ID
MSG91_WHATSAPP_NUMBER=917xxxxxxxxx  # WhatsApp Business number (with country code, no +)
MSG91_TEMPLATE_IDs={}           # JSON object of template IDs (see Task 3)
ENABLE_WHATSAPP=true            # Feature flag — set false to fall back to SMS only
```

---

## TASK 1 — Replace `lib/sms.ts` with full MSG91 client

**File:** `lib/sms.ts` — replace entirely

```ts
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

// ─── Low-level MSG91 helpers ──────────────────────

async function sendSms({ phone, message, tenantId, entityType, entityId }: SendSmsParams): Promise<boolean> {
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
      en: `Hi ${data.name}, payment of ₹${data.amount} received for loan ${data.loanCode} on ${data.date}. Balance: ₹${data.balance}. -ZoloFund`,
      ta: `வணக்கம் ${data.name}, கடன் ${data.loanCode} க்கு ₹${data.amount} பெறப்பட்டது ${data.date}. மீதி: ₹${data.balance}. -ZoloFund`,
      hi: `नमस्ते ${data.name}, ऋण ${data.loanCode} के लिए ₹${data.amount} प्राप्त हुआ ${data.date}। शेष: ₹${data.balance}। -ZoloFund`,
    },
    payment_due_reminder: {
      en: `Hi ${data.name}, ₹${data.amount} is due for loan ${data.loanCode} on ${data.date}. Pay on time to avoid penalty. -ZoloFund`,
      ta: `வணக்கம் ${data.name}, ${data.date} அன்று கடன் ${data.loanCode} க்கு ₹${data.amount} செலுத்த வேண்டும். -ZoloFund`,
      hi: `नमस्ते ${data.name}, ${data.date} को ऋण ${data.loanCode} के लिए ₹${data.amount} देय है। -ZoloFund`,
    },
    loan_disbursed: {
      en: `Hi ${data.name}, loan ${data.loanCode} of ₹${data.amount} has been disbursed. First instalment due: ${data.firstDue}. -ZoloFund`,
      ta: `வணக்கம் ${data.name}, ₹${data.amount} கடன் ${data.loanCode} வழங்கப்பட்டது. முதல் தவணை: ${data.firstDue}. -ZoloFund`,
      hi: `नमस्ते ${data.name}, ₹${data.amount} का ऋण ${data.loanCode} स्वीकृत हुआ। पहली किस्त: ${data.firstDue}। -ZoloFund`,
    },
    loan_overdue: {
      en: `Hi ${data.name}, loan ${data.loanCode} is overdue by ${data.days} days. Penalty: ₹${data.penalty}. Contact your agent immediately. -ZoloFund`,
      ta: `வணக்கம் ${data.name}, கடன் ${data.loanCode} ${data.days} நாட்கள் தாமதமாகியுள்ளது. அபராதம்: ₹${data.penalty}. -ZoloFund`,
      hi: `नमस्ते ${data.name}, ऋण ${data.loanCode} ${data.days} दिन अतिदेय है। जुर्माना: ₹${data.penalty}। -ZoloFund`,
    },
    loan_closed: {
      en: `Hi ${data.name}, loan ${data.loanCode} is now fully closed. Thank you for your timely payments! -ZoloFund`,
      ta: `வணக்கம் ${data.name}, கடன் ${data.loanCode} முழுமையாக மூடப்பட்டது. நன்றி! -ZoloFund`,
      hi: `नमस्ते ${data.name}, ऋण ${data.loanCode} पूरी तरह बंद हो गया। धन्यवाद! -ZoloFund`,
    },
    penalty_accrued: {
      en: `Hi ${data.name}, a penalty of ₹${data.penalty} has been added to loan ${data.loanCode} for ${data.days} missed days. -ZoloFund`,
      ta: `வணக்கம் ${data.name}, கடன் ${data.loanCode} க்கு ₹${data.penalty} அபராதம் சேர்க்கப்பட்டது. -ZoloFund`,
      hi: `नमस्ते ${data.name}, ऋण ${data.loanCode} पर ₹${data.penalty} जुर्माना जोड़ा गया। -ZoloFund`,
    },
    collection_summary: {
      en: `${data.name}, today's collection: ₹${data.collected} / ₹${data.expected} (${data.pct}%). Pending: ${data.pending} customers. -ZoloFund`,
      ta: `${data.name}, இன்றைய வசூல்: ₹${data.collected} / ₹${data.expected} (${data.pct}%). -ZoloFund`,
      hi: `${data.name}, आज का संग्रह: ₹${data.collected} / ₹${data.expected} (${data.pct}%)। -ZoloFund`,
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
```

---

## TASK 2 — Add `NotificationLog` model to schema

**File:** `prisma/schema.prisma` — add after `NotificationTemplate` model:

```prisma
model NotificationLog {
  id           String   @id @default(cuid())
  tenantId     String   @map("tenant_id")
  channel      String                         // sms | whatsapp | email
  recipient    String                         // phone or email
  status       String   @default("sent")      // sent | failed | delivered
  errorMessage String?  @map("error_message") @db.Text
  entityType   String?  @map("entity_type")   // loan | customer | instalment
  entityId     String?  @map("entity_id")
  createdAt    DateTime @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, channel, createdAt])
  @@map("notification_logs")
}
```

Add `notificationLogs NotificationLog[]` to the `Tenant` model relations.

Run: `npx prisma migrate dev --name add_notification_log`

---

## TASK 3 — Wire notifications into existing actions

### 3a — After payment collected in `collection/actions.ts`

```ts
// Add import at top:
import { notifyPaymentReceived } from '@/lib/sms';

// Add after the instalment update block, inside submitCollectionEntry:
const customer = instalment.loan.customer;
const balance = Number(instalment.loan.totalPayable || 0) - Number(instalment.loan.totalCollected || 0) - receivedAmount;
notifyPaymentReceived({
  tenantId,
  phone:    customer.phone,
  name:     customer.name,
  amount:   receivedAmount.toLocaleString('en-IN'),
  loanCode: instalment.loan.loanCode,
  date:     new Date().toLocaleDateString('en-IN'),
  balance:  Math.max(0, balance).toLocaleString('en-IN'),
  loanId:   instalment.loanId,
}).catch(() => {}); // fire-and-forget, never block the collection entry
```

### 3b — After loan created in `loans/actions.ts`

```ts
import { notifyLoanDisbursed } from '@/lib/sms';

// After loan create and instalment generation, add:
const firstInstalment = instalmentDates[0];
notifyLoanDisbursed({
  tenantId,
  phone:    customer.phone,
  name:     customer.name,
  amount:   disbursed.toLocaleString('en-IN'),
  loanCode,
  firstDue: firstInstalment ? new Date(firstInstalment).toLocaleDateString('en-IN') : '-',
  loanId:   newLoan.id,
}).catch(() => {});
```

### 3c — After loan closed in `loans/[id]/actions.ts`

```ts
import { notifyLoanClosed } from '@/lib/sms';

// After the closeLoan prisma.loan.update call:
notifyLoanClosed({
  tenantId,
  phone:    loan.customer.phone,
  name:     loan.customer.name,
  loanCode: loan.loanCode,
  loanId:   loanId,
}).catch(() => {});
```

### 3d — In the penalty accrual cron `app/api/cron/accrue-penalties/route.ts`

```ts
import { notifyLoanOverdue } from '@/lib/sms';

// After creating/updating each penalty, add (inside the per-loan loop):
if (loan.customer?.phone) {
  notifyLoanOverdue({
    tenantId: loan.tenantId,
    phone:    loan.customer.phone,
    name:     loan.customer.name,
    loanCode: loan.loanCode,
    days:     String(totalMissedDays),
    penalty:  String(grossPenalty),
    loanId:   loan.id,
  }).catch(() => {});
}
```

---

## TASK 4 — Due date reminder cron

**Create:** `app/api/cron/send-reminders/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { notifyPaymentDueReminder } from '@/lib/sms';
import dayjs from 'dayjs';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find instalments due tomorrow
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

  const instalments = await prisma.instalment.findMany({
    where: {
      dueDate: new Date(tomorrow),
      status: 'upcoming',
      loan: { status: 'active' },
    },
    include: {
      loan: {
        include: {
          tenant: true,
          customer: true,
        },
      },
    },
    take: 500, // process in batches
  });

  let sent = 0;
  for (const inst of instalments) {
    const { loan } = inst;
    if (!loan.customer?.phone) continue;

    await notifyPaymentDueReminder({
      tenantId: loan.tenantId,
      phone:    loan.customer.phone,
      name:     loan.customer.name,
      amount:   Number(inst.dueAmount).toLocaleString('en-IN'),
      loanCode: loan.loanCode,
      date:     dayjs(inst.dueDate).format('DD MMM YYYY'),
      loanId:   loan.id,
    }).catch(() => {});

    sent++;
    await new Promise(r => setTimeout(r, 100)); // 100ms delay per message to respect rate limits
  }

  return NextResponse.json({ ok: true, remindersSent: sent });
}
```

Add to `vercel.json` crons:

```json
{ "path": "/api/cron/send-reminders", "schedule": "0 8 * * *" }
```

This runs at 8:00 AM IST (02:30 UTC) every morning.

---

## TASK 5 — MSG91 WhatsApp template registration

Register these templates in MSG91 dashboard before going live:

| Template name | Variables | Message |
|---|---|---|
| `loantrack_payment_received` | name, amount, loanCode, date, balance | Hi {{1}}, payment of ₹{{2}} received for loan {{3}} on {{4}}. Balance: ₹{{5}}. |
| `loantrack_due_reminder` | name, amount, loanCode, date | Hi {{1}}, ₹{{2}} is due for loan {{3}} on {{4}}. Pay on time to avoid penalty. |
| `loantrack_loan_disbursed` | name, amount, loanCode, firstDue | Hi {{1}}, loan {{3}} of ₹{{2}} has been disbursed. First instalment due: {{4}}. |
| `loantrack_loan_closed` | name, loanCode | Hi {{1}}, loan {{2}} is now fully closed. Thank you for your timely payments! |

Templates take 24–48 hours for WhatsApp approval. SMS works immediately.

---

## TASK 6 — Notification log page in admin

**Create:** `app/(dashboard)/notifications/log/page.tsx`

```ts
import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function NotificationLogPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role === 'agent') redirect('/collection');

  const tenantId = await getDefaultTenantId();

  const logs = await prisma.notificationLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Notification Log</h1>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Time</th><th>Channel</th><th>Recipient</th><th>Status</th><th>Entity</th></tr></thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                <td><span className="badge badge-info">{log.channel.toUpperCase()}</span></td>
                <td>{log.recipient}</td>
                <td>
                  <span className={`badge ${log.status === 'sent' ? 'badge-active' : 'badge-overdue'}`}>
                    {log.status}
                  </span>
                </td>
                <td>{log.entityType ?? '-'} {log.entityId ? `#${log.entityId.slice(-6)}` : ''}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-light)' }}>No notifications sent yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```
