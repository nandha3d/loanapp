import 'server-only';
import prisma from '../db';
import { getSetting } from '../tenant';
import { modulePath } from '../../types/modules';
import { notifyUser } from './userNotify';
import { notifyApprovers } from './approvers';

/**
 * Staff-facing operational alerts: EMIs due, EMIs overdue, new penalties,
 * payments received. Distinct from `notify()` (events.ts), which messages the
 * CUSTOMER by SMS/WhatsApp.
 *
 * Scheduled alerts are DIGESTS — one row per recipient per run — not one per
 * instalment: an agent with 50 dues must not get 50 pushes. Digests go to:
 *   - the customer's agent       (their own customers only),
 *   - the admins of the loan's branch (+ unbranched admins, as notifyApprovers does),
 *   - the tenant's superadmins   (one tenant-wide summary).
 * Reach follows NOTIF-6/SCOPE-10: it never widens who can SEE a record.
 *
 * Every figure is computed and formatted HERE and shipped in `params` (STABLE-8);
 * clients only render the i18n key with those params. Each event is switchable
 * per tenant via AppSetting `staff_notify_<event>` (default on, as `notify()` does).
 * Nothing in here throws (NOTIF-1/8).
 */

export type StaffAlertEvent =
  | 'emi_due_tomorrow'
  | 'emi_due_today'
  | 'emi_overdue_new'
  | 'emi_overdue_weekly'
  | 'penalty_new'
  | 'payment_received';

export const staffAlertSettingKey = (event: StaffAlertEvent) => `staff_notify_${event}`;

/** Days between full overdue digests (STABLE-4: tenant-tunable, not hardcoded). */
export const OVERDUE_DIGEST_DAYS_SETTING = 'staff_overdue_digest_days';

const DAY_MS = 24 * 60 * 60 * 1000;

type Copy = {
  titleKey: string;
  messageKey: string;
  icon: string;
  type: string;
  /** English fallback (also what the stored row / legacy clients show). */
  title: string;
  message: (p: Record<string, string>) => string;
  /** Module page the alert opens. */
  page: string;
};

const COPY: Record<StaffAlertEvent, Copy> = {
  emi_due_tomorrow: {
    titleKey: 'notif.staff.emi_due_tomorrow.title',
    messageKey: 'notif.staff.emi_due_tomorrow.msg',
    icon: 'event',
    type: 'emi_due',
    title: 'EMIs due tomorrow',
    message: (p) => `${p.count} EMI(s) due tomorrow, total ${p.amount}.`,
    page: '/collection',
  },
  emi_due_today: {
    titleKey: 'notif.staff.emi_due_today.title',
    messageKey: 'notif.staff.emi_due_today.msg',
    icon: 'event_available',
    type: 'emi_due',
    title: 'EMIs due today',
    message: (p) => `${p.count} EMI(s) due today, total ${p.amount}.`,
    page: '/collection',
  },
  emi_overdue_new: {
    titleKey: 'notif.staff.emi_overdue_new.title',
    messageKey: 'notif.staff.emi_overdue_new.msg',
    icon: 'warning_amber',
    type: 'emi_overdue',
    title: 'EMIs newly overdue',
    message: (p) => `${p.count} EMI(s) became overdue, total ${p.amount}.`,
    page: '/collection',
  },
  emi_overdue_weekly: {
    titleKey: 'notif.staff.emi_overdue_weekly.title',
    messageKey: 'notif.staff.emi_overdue_weekly.msg',
    icon: 'report_problem',
    type: 'emi_overdue',
    title: 'Overdue EMIs summary',
    message: (p) => `${p.count} EMI(s) are overdue, total ${p.amount}.`,
    page: '/collection',
  },
  penalty_new: {
    titleKey: 'notif.staff.penalty_new.title',
    messageKey: 'notif.staff.penalty_new.msg',
    icon: 'gavel',
    type: 'penalty',
    title: 'New penalties',
    message: (p) => `${p.count} loan(s) started accruing penalty, total ${p.amount}.`,
    page: '/penalties',
  },
  payment_received: {
    titleKey: 'notif.staff.payment_received.title',
    messageKey: 'notif.staff.payment_received.msg',
    icon: 'payments',
    // Not 'payment': the mobile tile maps that type to "Show on Map".
    type: 'payment_alert',
    title: 'Payment received',
    message: (p) => `${p.amount} received from ${p.name} for loan ${p.loanCode}.`,
    page: '/loans',
  },
};

/** ₹ with Indian grouping, 2dp trimmed — same shape the rest of the server uses. */
export function formatRupees(n: number): string {
  return `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN')}`;
}

/** Calendar-day bucket (UTC days since epoch) for dedupe keys. */
function dayNumber(d: Date): number {
  return Math.floor(d.getTime() / DAY_MS);
}

async function eventEnabled(tenantId: string, event: StaffAlertEvent): Promise<boolean> {
  try {
    return (await getSetting(tenantId, staffAlertSettingKey(event), 'true')) !== 'false';
  } catch {
    return true;
  }
}

export type DigestInstalment = {
  /** Outstanding on the instalment: dueAmount − receivedAmount, floored at 0. */
  amount: number;
  loan: {
    tenantId: string;
    appType: string;
    branchId: string | null;
    customer: { agentId: string | null } | null;
  };
};

type Bucket = { count: number; amount: number; appType: string; branchId: string | null };

function add(map: Map<string, Bucket>, key: string, seed: Omit<Bucket, 'count' | 'amount'>, amount: number) {
  const b = map.get(key) ?? { ...seed, count: 0, amount: 0 };
  b.count += 1;
  b.amount += amount;
  map.set(key, b);
}

/**
 * Sends one digest per agent, per branch (admins) and per tenant (superadmins)
 * for a set of instalments. `bucketKey` makes the run idempotent: re-running the
 * cron inside the same bucket skips recipients who already hold the alert.
 */
export async function sendInstalmentDigests(
  event: Exclude<StaffAlertEvent, 'payment_received'>,
  rows: DigestInstalment[],
  bucketKey: string,
): Promise<void> {
  if (rows.length === 0) return;
  const copy = COPY[event];

  const byAgent = new Map<string, Bucket>();
  const byBranch = new Map<string, Bucket>();
  const byTenant = new Map<string, Bucket>();
  for (const r of rows) {
    const { tenantId, appType, branchId } = r.loan;
    const agentId = r.loan.customer?.agentId;
    if (agentId) add(byAgent, `${tenantId}|${agentId}`, { appType, branchId: null }, r.amount);
    add(byBranch, `${tenantId}|${appType}|${branchId ?? ''}`, { appType, branchId }, r.amount);
    add(byTenant, `${tenantId}|${appType}`, { appType, branchId: null }, r.amount);
  }

  const enabled = new Map<string, boolean>();
  const isOn = async (tenantId: string) => {
    if (!enabled.has(tenantId)) enabled.set(tenantId, await eventEnabled(tenantId, event));
    return enabled.get(tenantId)!;
  };

  const send = async (
    tenantId: string,
    b: Bucket,
    target: { targetUserId: string } | { targetRole: 'admin' | 'superadmin' },
    scope: string,
  ) => {
    const params = { count: String(b.count), amount: formatRupees(b.amount) };
    await notifyUser({
      tenantId,
      appType: b.appType,
      branchId: b.branchId,
      ...target,
      ...('targetRole' in target && target.targetRole === 'admin'
        ? { recipientBranchIds: [b.branchId], includeUnassignedBranch: true }
        : {}),
      ...('targetRole' in target && target.targetRole === 'superadmin' ? { recipientBranchIds: [] } : {}),
      type: copy.type,
      icon: copy.icon,
      title: copy.title,
      message: copy.message(params),
      titleKey: copy.titleKey,
      messageKey: copy.messageKey,
      params,
      link: modulePath(b.appType, copy.page),
      dedupeKey: `${event}:${bucketKey}:${scope}`,
    });
  };

  try {
    for (const [key, b] of byAgent) {
      const [tenantId, agentId] = key.split('|');
      if (await isOn(tenantId)) await send(tenantId, b, { targetUserId: agentId }, `agent:${agentId}`);
    }
    for (const [key, b] of byBranch) {
      const [tenantId, , branchId] = key.split('|');
      if (await isOn(tenantId)) await send(tenantId, b, { targetRole: 'admin' }, `branch:${branchId || 'none'}`);
    }
    for (const [key, b] of byTenant) {
      const [tenantId] = key.split('|');
      if (await isOn(tenantId)) await send(tenantId, b, { targetRole: 'superadmin' }, 'tenant');
    }
  } catch (e) {
    console.error(`[staffAlerts] ${event} digest failed`, e);
  }
}

/** Outstanding on one instalment, clamped — display figure only. */
export function outstandingOf(dueAmount: unknown, receivedAmount: unknown): number {
  return Math.max(0, Number(dueAmount ?? 0) - Number(receivedAmount ?? 0));
}

/** Bucket id for the weekly overdue digest: stable for N days, then rolls over. */
export async function overdueBucket(tenantIdForSetting: string | null, now: Date): Promise<string> {
  let n = 7;
  try {
    if (tenantIdForSetting) {
      const raw = Number(await getSetting(tenantIdForSetting, OVERDUE_DIGEST_DAYS_SETTING, '7'));
      if (Number.isFinite(raw) && raw >= 1) n = Math.floor(raw);
    }
  } catch {
    /* keep default */
  }
  return `d${n}:${Math.floor(dayNumber(now) / n)}`;
}

export const dayKey = (d: Date) => String(dayNumber(d));

/**
 * One "payment received" alert for ONE payment, to the customer's agent and the
 * branch admins — but never to the person who took the money (they know), and
 * never twice for a replayed payment (`dedupeId`).
 */
export async function notifyPaymentReceived(input: {
  tenantId: string;
  appType: string;
  loanId: string;
  amount: number;
  /** User who recorded the payment; excluded from the alert. */
  collectedByUserId?: string | null;
  /** Stable id of the payment (collection entry id) for idempotency. */
  dedupeId: string;
  /** Also alert branch admins + superadmins (for paths that notify nobody today). */
  alertAdmins?: boolean;
}): Promise<void> {
  try {
    if (!(await eventEnabled(input.tenantId, 'payment_received'))) return;
    const loan = await prisma.loan.findFirst({
      where: { id: input.loanId, tenantId: input.tenantId },
      select: {
        id: true,
        loanCode: true,
        branchId: true,
        customer: { select: { name: true, agentId: true } },
      },
    });
    if (!loan) return;

    const copy = COPY.payment_received;
    const params = {
      amount: formatRupees(input.amount),
      name: loan.customer?.name ?? '',
      loanCode: loan.loanCode,
    };
    const common = {
      tenantId: input.tenantId,
      appType: input.appType,
      branchId: loan.branchId,
      type: copy.type,
      icon: copy.icon,
      title: copy.title,
      message: copy.message(params),
      titleKey: copy.titleKey,
      messageKey: copy.messageKey,
      params,
      link: modulePath(input.appType, `/loans/${loan.id}`),
      data: { loanId: loan.id, amount: String(input.amount) },
    };

    const agentId = loan.customer?.agentId;
    if (agentId && agentId !== input.collectedByUserId) {
      await notifyUser({ ...common, targetUserId: agentId, dedupeKey: `payment:${input.dedupeId}:agent` });
    }
    // Staff-recorded payments already reach admins as `collection_received`
    // (submitCollectionEntry), so callers there leave this off. Paths that never
    // told anyone (borrower self-pay) pass it to reach branch admins + superadmins.
    if (input.alertAdmins) {
      await notifyApprovers({ ...common, dedupeKey: `payment:${input.dedupeId}:admin` });
    }
  } catch (e) {
    console.error('[staffAlerts] payment_received failed', e);
  }
}
