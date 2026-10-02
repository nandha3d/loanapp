/**
 * Loan funding gate (FUND-1..FUND-6) — pure maths, no I/O.
 *
 * A loan's cash payout leaves either an agent's float (agent-originated loans)
 * or a branch cash pool (admin/superadmin loans). MONEY-16 already hard-blocks
 * a payout that would drive either negative; this module only works out the
 * figures both clients show around that block — what is short, how much must
 * be released to the agent, and how much capital the branch pool needs first.
 * Clients render these numbers; they never recompute them (STABLE-8).
 */
import { modulePath } from '@/types/modules';

/** AppSetting key: staff alerts for a short float / newly fundable loan (Micro Lending). */
export const LOAN_FUNDING_ALERTS_FLAG = 'loan_funding_alerts_enabled';

export type FundingSource = 'agent' | 'branch' | 'none';

export type LoanFunding = {
  /** Where the cash comes from: the agent's float, a branch pool, or nowhere (no cash leg). */
  source: FundingSource;
  /** Net cash this loan pays out. */
  required: number;
  /** Agent float (source agent) or branch pool (source branch). */
  available: number;
  /** Cash the agent's OTHER pending loans will draw from the same float. 0 for a branch. */
  committed: number;
  /** max(0, required − available): what blocks this payout today. */
  shortfall: number;
  /** max(0, required + committed − available): release that clears the agent's whole pending queue. */
  queueShortfall: number;
  /** Pool that funds a release to the agent (the agent's branch), or the paying branch. */
  branchId: string | null;
  branchPool: number | null;
  /** Capital the branch pool needs before `shortfall` can be released (source branch: the shortfall itself). */
  capitalNeeded: number;
  /** Same, for `queueShortfall`. */
  queueCapitalNeeded: number;
  agentId: string | null;
  /** shortfall === 0. */
  sufficient: boolean;
};

/** What clients receive: the figures plus whether alerts went out for a submission. */
export type FundingView = LoanFunding & { alertsSent?: boolean };

const paise = (n: number) => Math.round(n * 100) / 100;
const pos = (n: number) => paise(Math.max(0, n));
const num = (n: unknown) => (Number.isFinite(Number(n)) ? Number(n) : 0);

export function computeLoanFunding(input: {
  source: FundingSource;
  required: number;
  available?: number;
  committed?: number;
  branchId?: string | null;
  branchPool?: number | null;
  agentId?: string | null;
}): LoanFunding {
  const required = pos(num(input.required));
  const available = paise(num(input.available));
  const branchPool = input.branchPool == null ? null : paise(num(input.branchPool));
  const base = {
    required,
    branchId: input.branchId ?? null,
    branchPool,
    agentId: input.agentId ?? null,
  };
  if (input.source === 'none' || required === 0) {
    return { ...base, source: input.source, available, committed: 0, shortfall: 0, queueShortfall: 0,
      capitalNeeded: 0, queueCapitalNeeded: 0, sufficient: true };
  }
  const committed = input.source === 'agent' ? pos(num(input.committed)) : 0;
  const shortfall = pos(required - available);
  const queueShortfall = pos(required + committed - available);
  // A release to an agent debits their branch pool, which is itself hard-blocked.
  // With no branch the release cannot happen at all, so no capital figure applies.
  const capitalFor = (release: number) =>
    input.source === 'branch' ? release : branchPool == null ? 0 : pos(release - branchPool);
  return {
    ...base,
    source: input.source,
    available,
    committed,
    shortfall,
    queueShortfall,
    capitalNeeded: capitalFor(shortfall),
    queueCapitalNeeded: capitalFor(queueShortfall),
    sufficient: shortfall === 0,
  };
}

/**
 * Pending loans that a float change from `before` to `after` made payable:
 * each one's own payout fits `after` and did not fit `before` (FUND-5).
 */
export function newlyFundableLoans<T extends { disbursed: number }>(loans: T[], before: number, after: number): T[] {
  return loans.filter((l) => {
    const need = pos(num(l.disbursed));
    return need > 0 && need <= paise(after) && need > paise(before);
  });
}

/**
 * Wallet deep link that opens the right row with the server's figure filled in
 * (FUND-4): the agent's row with the release, or the branch pool with the top-up.
 */
export function fundingWalletLink(appType: string, funding: LoanFunding, amount = funding.shortfall): string {
  const q = funding.source === 'agent' && funding.agentId
    ? `agent=${encodeURIComponent(funding.agentId)}&release=${amount}`
    : funding.branchId ? `branch=${encodeURIComponent(funding.branchId)}&topup=${amount}` : '';
  return modulePath(appType, q ? `/wallet?${q}` : '/wallet');
}

/** Funding alerts are a Micro Lending, per-tenant opt-in (STABLE-2). */
export function fundingAlertsApply(appType: string, enabled: boolean): boolean {
  return appType === 'microlending' && enabled;
}

/** `{name}` placeholder fill for dictionary strings. */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
