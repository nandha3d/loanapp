'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { releaseToAgent, injectBranchCash, collectFromAgent, applyAccountingCashToBranch, checkBranchFloat } from '@/lib/wallet';
import { autoPostCapitalAdd } from '@/lib/accounting/autoPost';
import { writeAudit } from '@/lib/audit';
import { modulePath } from '@/types/modules';
import { getActiveBranchId } from '@/lib/branch';
import { collectCashFromAgent, collectCashHandover, rejectCashHandover, requestCashHandover } from '@/lib/cashHandover';
import { notifyNewlyFundableLoans } from '@/lib/loanFunding';

async function requirePrivileged() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    throw new Error('Forbidden');
  }
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const branchId = await getActiveBranchId();
  return { role, userId, tenantId, appType, branchId };
}

async function requireAgent() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId || role !== 'agent') throw new Error('Forbidden');
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  return { userId, tenantId, appType };
}

export async function releaseFundsAction(formData: FormData) {
  const { userId, tenantId, appType, branchId } = await requirePrivileged();
  const agentId = String(formData.get('agentId') || '');
  const amount = Number(formData.get('amount'));
  const note = (String(formData.get('note') || '') || null) as string | null;
  // '1' = the admin confirmed the low-capital prompt: post a capital_add for
  // the shortfall first, then release — capital is topped up in the same flow.
  const autoTopUp = String(formData.get('autoTopUp') || '') === '1';
  if (!agentId || !(amount > 0)) throw new Error('agentId and a positive amount are required');

  const agent = await prisma.user.findFirst({
    where: {
      id: agentId,
      tenantId,
      role: 'agent',
      status: 'active',
      appType,
      ...(branchId ? { branchId } : {}),
    },
    select: { id: true, branchId: true },
  });
  if (!agent) throw new Error('Agent not found');

  // Low-capital guard: releasing debits the branch pool. If the pool can't
  // cover the release, surface it to the client instead of silently driving
  // the pool negative — the client offers a one-tap capital top-up.
  if (agent.branchId) {
    const { balance, shortfall, hasShortfall } = await checkBranchFloat({
      tenantId,
      appType,
      branchId: agent.branchId,
      amount,
    });
    if (hasShortfall) {
      if (!autoTopUp) {
        return { lowCapital: true as const, balance, shortfall };
      }
      // Post the shortfall as capital added to this branch (same writes as the
      // accounting "Capital Add" quick action), then proceed with the release.
      const entry = await prisma.$transaction(async (tx) => {
        const accountEntry = await tx.accountEntry.create({
          data: {
            tenantId,
            appType,
            entryDate: new Date(),
            type: 'capital_add',
            category: 'cash',
            amount: shortfall,
            description: note ? `Capital top-up for agent release — ${note}` : 'Capital top-up for agent release',
            createdBy: userId,
            branchId: agent.branchId,
          },
        });
        await applyAccountingCashToBranch(tx, {
          tenantId,
          appType,
          branchId: agent.branchId!,
          amount: shortfall,
          entryType: 'capital_add',
          accountEntryId: accountEntry.id,
          byUserId: userId,
          note: 'Capital top-up for agent release',
        });
        return accountEntry;
      });
      await autoPostCapitalAdd({
        tenantId,
        appType,
        entryId: entry.id,
        description: 'Capital top-up for agent release',
        amount: shortfall,
        date: new Date(),
        branchId: agent.branchId,
        createdById: userId,
        category: 'cash',
      });
    }
  }

  const { agentBalance } = await releaseToAgent({
    tenantId,
    appType,
    agentId,
    branchId: agent.branchId,
    amount,
    byUserId: userId,
    note,
  });
  await writeAudit({
    tenantId,
    userId,
    action: 'wallet_release',
    entityType: 'agent_account',
    entityId: agentId,
    newValue: { amount },
  });
  // FUND-5: pending loans this release made payable (opt-in alert, after commit).
  await notifyNewlyFundableLoans({ tenantId, appType, agentId, before: agentBalance - amount, after: agentBalance });

  revalidatePath(modulePath(appType, '/wallet'));
  return { success: true as const };
}

export async function injectBranchAction(formData: FormData) {
  const { userId, tenantId, appType, branchId: activeBranchId } = await requirePrivileged();
  const branchId = String(formData.get('branchId') || '');
  const amount = Number(formData.get('amount'));
  const note = (String(formData.get('note') || '') || null) as string | null;
  if (!branchId || !(amount > 0)) throw new Error('branchId and a positive amount are required');

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      tenantId,
      status: 'active',
      ...(activeBranchId ? { id: activeBranchId } : {}),
    },
    select: { id: true },
  });
  if (!branch) throw new Error('Branch not found');

  await injectBranchCash({ tenantId, appType, branchId, amount, byUserId: userId, note });
  await writeAudit({
    tenantId,
    userId,
    action: 'wallet_inject',
    entityType: 'branch_cash_account',
    entityId: branchId,
    newValue: { amount },
  });

  revalidatePath(modulePath(appType, '/wallet'));
}

// ── Two-sided cash handover (agent ⇄ admin) ─────────────────────────────────

/** Agent requests to hand over field cash. Creates a pending CashHandover; no
 *  float movement yet — the admin settles it on collect. */
export async function requestFloatHandoverAction(formData: FormData) {
  const { userId, tenantId, appType } = await requireAgent();
  const amount = Number(formData.get('amount'));
  const note = (String(formData.get('note') || '') || null) as string | null;
  await requestCashHandover({ tenantId, appType, userId }, { amount, note });
  revalidatePath(modulePath(appType, '/wallet'));
}

/** Admin collects/settles a pending handover: debits the agent float, credits
 *  the branch pool, marks the handover confirmed (lib/cashHandover.ts, WAL-01). */
export async function collectHandoverAction(formData: FormData) {
  const { userId, tenantId, appType, branchId } = await requirePrivileged();
  const handoverId = String(formData.get('handoverId') || '');
  if (!handoverId) throw new Error('handoverId is required');
  await collectCashHandover({ tenantId, appType, userId, branchId }, handoverId);
  revalidatePath(modulePath(appType, '/wallet'));
}

/** Admin rejects a pending handover request (no cash movement). */
export async function rejectHandoverAction(formData: FormData) {
  const { userId, tenantId, appType, branchId } = await requirePrivileged();
  const handoverId = String(formData.get('handoverId') || '');
  if (!handoverId) throw new Error('handoverId is required');
  await rejectCashHandover({ tenantId, appType, userId, branchId }, handoverId);
  revalidatePath(modulePath(appType, '/wallet'));
}

/** Admin-initiated direct collection from an agent (no prior request), e.g. the
 *  agent hands cash over in person. Settles immediately and records it. */
export async function collectFromAgentAction(formData: FormData) {
  const { userId, tenantId, appType, branchId } = await requirePrivileged();
  const agentId = String(formData.get('agentId') || '');
  const amount = Number(formData.get('amount'));
  const note = (String(formData.get('note') || '') || null) as string | null;
  await collectCashFromAgent({ tenantId, appType, userId, branchId }, { agentId, amount, note });
  revalidatePath(modulePath(appType, '/wallet'));
}
