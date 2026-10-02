import 'server-only';
import prisma from './db';
import { getSetting } from './tenant';
import { getDictionary } from './i18n';
import { notifyUser } from './notify/userNotify';
import { notifyApprovers } from './notify/approvers';
import { modulePath } from '@/types/modules';
import { resolveWriteBranchId, scopedBranchWhere, type MobileApiContext } from './api/v1-auth';
import {
  LOAN_FUNDING_ALERTS_FLAG,
  computeLoanFunding,
  fillTemplate,
  fundingAlertsApply,
  fundingWalletLink,
  newlyFundableLoans,
  type LoanFunding,
} from './loanFundingPolicy';

/**
 * Loan funding gate — the reads and staff alerts around MONEY-16 (FUND-1..FUND-6).
 * The maths is in loanFundingPolicy.ts; this file only loads the balances it
 * needs and sends the alerts after the money transaction has committed.
 */

type Scope = { tenantId: string; appType: string };

async function branchPoolBalance(scope: Scope, branchId: string | null | undefined): Promise<number | null> {
  if (!branchId) return null;
  const pool = await prisma.branchCashAccount.findUnique({
    where: { tenantId_appType_branchId: { tenantId: scope.tenantId, appType: scope.appType, branchId } },
    select: { balance: true },
  });
  return Number(pool?.balance ?? 0);
}

/**
 * Funding for a payout from an agent's float. `committed` is every OTHER
 * pending loan this agent raised: the same (tenant, appType, agent) axis as the
 * AgentAccount it draws on, never a branch (FUND-3).
 */
export async function getAgentFunding(scope: Scope, input: { agentId: string; required: number; excludeLoanId?: string | null }): Promise<LoanFunding> {
  const [account, agent, pending] = await Promise.all([
    prisma.agentAccount.findFirst({
      where: { tenantId: scope.tenantId, appType: scope.appType, agentId: input.agentId },
      select: { balance: true },
    }),
    prisma.user.findFirst({ where: { id: input.agentId, tenantId: scope.tenantId }, select: { branchId: true } }),
    prisma.loan.aggregate({
      where: {
        tenantId: scope.tenantId,
        appType: scope.appType,
        status: 'pending_review',
        createdById: input.agentId,
        ...(input.excludeLoanId ? { id: { not: input.excludeLoanId } } : {}),
      },
      _sum: { disbursed: true },
    }),
  ]);
  const branchId = agent?.branchId ?? null;
  return computeLoanFunding({
    source: 'agent',
    required: input.required,
    available: Number(account?.balance ?? 0),
    committed: Number(pending._sum.disbursed ?? 0),
    branchId,
    branchPool: await branchPoolBalance(scope, branchId),
    agentId: input.agentId,
  });
}

/** Funding for a payout from a branch cash pool (admin/superadmin loans). */
export async function getBranchFunding(scope: Scope, input: { branchId: string | null; required: number }): Promise<LoanFunding> {
  if (!input.branchId) return computeLoanFunding({ source: 'none', required: input.required });
  const pool = (await branchPoolBalance(scope, input.branchId)) ?? 0;
  return computeLoanFunding({
    source: 'branch',
    required: input.required,
    available: pool,
    branchId: input.branchId,
    branchPool: pool,
  });
}

/**
 * Funding for a loan about to be originated by the caller: an agent pays from
 * their own float, anyone else from the pool of the branch the loan will sit
 * on — the customer's, resolved exactly as POST /api/v1/loans does.
 */
export async function getOriginationFunding(ctx: MobileApiContext, input: { amount: number; customerId?: string | null }): Promise<LoanFunding> {
  const scope = { tenantId: ctx.tenantId, appType: ctx.appType };
  if (ctx.role === 'agent') return getAgentFunding(scope, { agentId: ctx.userId, required: input.amount });
  const customer = input.customerId
    ? await prisma.customer.findFirst({
        where: { id: input.customerId, tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx) },
        select: { branchId: true },
      })
    : null;
  const branchId = await resolveWriteBranchId(ctx, customer?.branchId ?? null);
  return getBranchFunding(scope, { branchId, required: input.amount });
}

/**
 * Funding for every loan in an approvals queue, batched. Agent loans are
 * measured against the agent's float with their other pending loans committed;
 * other loans against the pool of their own branch.
 */
export async function buildPendingLoanFunding(
  scope: Scope,
  loans: Array<{ id: string; createdById: string | null; branchId: string | null; disbursed: unknown; creatorRole: string | null | undefined }>,
): Promise<Map<string, LoanFunding>> {
  const agentIds = Array.from(new Set(loans.filter((l) => l.creatorRole === 'agent' && l.createdById).map((l) => l.createdById as string)));
  const [accounts, agents, pending] = agentIds.length
    ? await Promise.all([
        prisma.agentAccount.findMany({
          where: { tenantId: scope.tenantId, appType: scope.appType, agentId: { in: agentIds } },
          select: { agentId: true, balance: true },
        }),
        prisma.user.findMany({ where: { id: { in: agentIds }, tenantId: scope.tenantId }, select: { id: true, branchId: true } }),
        prisma.loan.groupBy({
          by: ['createdById'],
          where: { tenantId: scope.tenantId, appType: scope.appType, status: 'pending_review', createdById: { in: agentIds } },
          _sum: { disbursed: true },
        }),
      ])
    : [[], [], []];
  const floatOf = new Map(accounts.map((a) => [a.agentId, Number(a.balance ?? 0)]));
  const agentBranch = new Map(agents.map((a) => [a.id, a.branchId ?? null]));
  const queueOf = new Map(pending.map((p) => [p.createdById as string, Number(p._sum.disbursed ?? 0)]));

  const branchIds = Array.from(new Set([
    ...agents.map((a) => a.branchId),
    ...loans.filter((l) => l.creatorRole !== 'agent').map((l) => l.branchId),
  ].filter((id): id is string => !!id)));
  const pools = branchIds.length
    ? await prisma.branchCashAccount.findMany({
        where: { tenantId: scope.tenantId, appType: scope.appType, branchId: { in: branchIds } },
        select: { branchId: true, balance: true },
      })
    : [];
  const poolOf = new Map(pools.map((p) => [p.branchId, Number(p.balance ?? 0)]));

  const out = new Map<string, LoanFunding>();
  for (const loan of loans) {
    const required = Number(loan.disbursed ?? 0);
    if (loan.creatorRole === 'agent' && loan.createdById) {
      const branchId = agentBranch.get(loan.createdById) ?? null;
      out.set(loan.id, computeLoanFunding({
        source: 'agent',
        required,
        available: floatOf.get(loan.createdById) ?? 0,
        committed: (queueOf.get(loan.createdById) ?? 0) - required,
        branchId,
        branchPool: branchId ? poolOf.get(branchId) ?? 0 : null,
        agentId: loan.createdById,
      }));
    } else {
      const pool = loan.branchId ? poolOf.get(loan.branchId) ?? 0 : 0;
      out.set(loan.id, loan.branchId
        ? computeLoanFunding({ source: 'branch', required, available: pool, branchId: loan.branchId, branchPool: pool })
        : computeLoanFunding({ source: 'none', required }));
    }
  }
  return out;
}

export async function isFundingAlertsEnabled(scope: Scope): Promise<boolean> {
  return fundingAlertsApply(scope.appType, (await getSetting(scope.tenantId, LOAN_FUNDING_ALERTS_FLAG, '0')) === '1');
}

async function money(tenantId: string) {
  const symbol = await getSetting(tenantId, 'currency_symbol', '₹');
  return (n: number) => `${symbol}${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fundingData(funding: LoanFunding, loan: { id: string; loanCode: string } | null): Record<string, string> {
  return {
    source: funding.source,
    required: String(funding.required),
    available: String(funding.available),
    shortfall: String(funding.shortfall),
    committed: String(funding.committed),
    queueShortfall: String(funding.queueShortfall),
    capitalNeeded: String(funding.capitalNeeded),
    ...(funding.agentId ? { agentId: funding.agentId } : {}),
    ...(funding.branchId ? { branchId: funding.branchId } : {}),
    ...(loan ? { loanId: loan.id, loanCode: loan.loanCode } : {}),
  };
}

/**
 * A payout is short (FUND-2). Approvers are told what to release (and what
 * capital the pool needs first); the filing agent is told what is missing.
 * `stage: 'blocked'` is the existing MONEY-16 alert and always goes to
 * approvers; everything else needs the tenant's opt-in. After commit; never throws.
 */
export async function notifyFundingShort(input: {
  tenantId: string;
  appType: string;
  funding: LoanFunding;
  loan: { id: string; loanCode: string; branchId: string | null } | null;
  agent: { id: string; name: string | null; branchId: string | null } | null;
  stage: 'submitted' | 'blocked';
  actorBranchId: string | null;
  actorRole: string;
}): Promise<void> {
  try {
    const scope = { tenantId: input.tenantId, appType: input.appType };
    const alerts = await isFundingAlertsEnabled(scope);
    if (input.stage === 'submitted' && !alerts) return;
    const d = (await getDictionary(input.tenantId)).loanFunding;
    const fmt = await money(input.tenantId);
    const f = input.funding;
    const vars = {
      loanCode: input.loan?.loanCode ?? '—',
      agent: input.agent?.name ?? '—',
      required: fmt(f.required),
      available: fmt(f.available),
      shortfall: fmt(f.shortfall),
      committed: fmt(f.committed),
      queueShortfall: fmt(f.queueShortfall),
      pool: fmt(f.branchPool ?? 0),
      capital: fmt(f.capitalNeeded),
    };
    const isAgent = f.source === 'agent';
    let message = fillTemplate(isAgent ? d.approverFloatShort : d.approverCapitalShort, vars);
    if (isAgent && f.committed > 0) message += ` ${fillTemplate(d.queueNote, vars)}`;
    if (isAgent && f.capitalNeeded > 0) message += ` ${fillTemplate(d.capitalFirst, vars)}`;
    const data = fundingData(f, input.loan);

    await notifyApprovers({
      tenantId: input.tenantId,
      appType: input.appType,
      branchId: input.loan?.branchId ?? f.branchId,
      requesterBranchId: input.agent?.branchId ?? input.actorBranchId,
      requesterRole: input.agent ? 'agent' : input.actorRole,
      type: 'float_insufficient',
      icon: 'account_balance_wallet',
      title: fillTemplate(isAgent ? d.floatShortTitle : d.capitalShortTitle, vars),
      message,
      link: fundingWalletLink(input.appType, f),
      data,
    });

    if (isAgent && input.agent && alerts) {
      await notifyUser({
        tenantId: input.tenantId,
        appType: input.appType,
        targetUserId: input.agent.id,
        branchId: input.loan?.branchId ?? null,
        type: 'float_insufficient',
        icon: 'account_balance_wallet',
        title: fillTemplate(d.floatShortTitle, vars),
        message: fillTemplate(d.agentFloatShort, vars),
        link: modulePath(input.appType, '/wallet'),
        data,
      });
    }
  } catch (e) {
    console.error('[loanFunding] notifyFundingShort failed', e);
  }
}

/**
 * Approval of a pending loan hit MONEY-16. Works out the figures for the 409
 * and sends the 'blocked' alert (agent copy when opted in). Never throws.
 */
export async function reportBlockedPendingLoan(input: {
  tenantId: string;
  appType: string;
  loan: { id: string; loanCode: string; branchId: string | null; createdById: string | null };
  available: number;
  required: number;
  actorBranchId: string | null;
  actorRole: string;
}): Promise<LoanFunding> {
  const scope = { tenantId: input.tenantId, appType: input.appType };
  let funding = computeLoanFunding({ source: 'branch', required: input.required, available: input.available,
    branchId: input.loan.branchId, branchPool: input.available });
  try {
    const creator = input.loan.createdById
      ? await prisma.user.findFirst({ where: { id: input.loan.createdById, tenantId: input.tenantId }, select: { id: true, role: true, name: true, branchId: true } })
      : null;
    const agent = creator?.role === 'agent' ? creator : null;
    if (agent) funding = await getAgentFunding(scope, { agentId: agent.id, required: input.required, excludeLoanId: input.loan.id });
    await notifyFundingShort({
      ...scope,
      funding,
      loan: input.loan,
      agent: agent ? { id: agent.id, name: agent.name, branchId: agent.branchId } : null,
      stage: 'blocked',
      actorBranchId: input.actorBranchId,
      actorRole: input.actorRole,
    });
  } catch (e) {
    console.error('[loanFunding] reportBlockedPendingLoan failed', e);
  }
  return funding;
}

/**
 * After a release to an agent (FUND-5): tell the agent and the approvers about
 * each pending loan the release made payable. After commit; never throws.
 */
export async function notifyNewlyFundableLoans(input: {
  tenantId: string;
  appType: string;
  agentId: string;
  before: number;
  after: number;
}): Promise<void> {
  try {
    const scope = { tenantId: input.tenantId, appType: input.appType };
    if (!(await isFundingAlertsEnabled(scope))) return;
    const pending = await prisma.loan.findMany({
      where: { tenantId: input.tenantId, appType: input.appType, status: 'pending_review', createdById: input.agentId },
      select: { id: true, loanCode: true, branchId: true, disbursed: true, createdBy: { select: { name: true, branchId: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const ready = newlyFundableLoans(pending.map((l) => ({ ...l, disbursed: Number(l.disbursed) })), input.before, input.after);
    if (!ready.length) return;
    const d = (await getDictionary(input.tenantId)).loanFunding;
    const fmt = await money(input.tenantId);
    for (const loan of ready) {
      const vars = { loanCode: loan.loanCode, agent: loan.createdBy?.name ?? '—', required: fmt(loan.disbursed), available: fmt(input.after) };
      const common = {
        tenantId: input.tenantId,
        appType: input.appType,
        type: 'float_ready',
        icon: 'task_alt',
        title: fillTemplate(d.readyTitle, vars),
        data: { loanId: loan.id, loanCode: loan.loanCode, agentId: input.agentId, required: String(loan.disbursed), available: String(input.after) },
      };
      await notifyUser({ ...common, targetUserId: input.agentId, branchId: loan.branchId, message: fillTemplate(d.agentReady, vars), link: modulePath(input.appType, '/loans') });
      await notifyApprovers({
        ...common,
        // A pending loan's approval id is the loan id (approvals queue rows).
        data: { ...common.data, approvalId: loan.id },
        branchId: loan.branchId,
        requesterBranchId: loan.createdBy?.branchId ?? null,
        requesterRole: 'agent',
        message: fillTemplate(d.approverReady, vars),
        link: modulePath(input.appType, '/approvals'),
      });
    }
  } catch (e) {
    console.error('[loanFunding] notifyNewlyFundableLoans failed', e);
  }
}
