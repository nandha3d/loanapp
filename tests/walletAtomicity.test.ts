import assert from 'node:assert/strict';
import {
  InsufficientFloatError,
  applyAccountingCashToBranch,
  collectFromAgentInTx,
  disburseFromAgent,
  disburseFromBranch,
  injectBranchCashInTx,
  releaseToAgentInTx,
} from '../lib/wallet';
import { summarizeDashboardBookTotals } from '../lib/dashboard/bookTotals';
import { computeAccountingMetrics } from '../lib/accounting/summary';

type Row = { id: string; balance: number };
type CapitalEntry = {
  id: string;
  tenantId: string;
  appType: string;
  branchId: string;
  entryDate: Date;
  type: string;
  category: string;
  amount: number;
  description: string;
  createdBy: string;
};

/**
 * In-memory stand-in for the Prisma transaction client. It refuses an absolute
 * `balance` write: every movement must be an atomic increment so two concurrent
 * transactions can never overwrite each other's balance (MONEY-16).
 */
function fakeTx(seed: { agents?: Record<string, number>; branches?: Record<string, number>; agentBranch?: Record<string, string | null> } = {}) {
  const agents = new Map<string, Row>();
  const branches = new Map<string, Row>();
  const ledger: Array<Record<string, unknown>> = [];
  const entries: CapitalEntry[] = [];
  for (const [agentId, balance] of Object.entries(seed.agents ?? {})) agents.set(agentId, { id: `a-${agentId}`, balance });
  for (const [branchId, balance] of Object.entries(seed.branches ?? {})) branches.set(branchId, { id: `b-${branchId}`, balance });

  const byId = (id: string) => [...agents.values(), ...branches.values()].find((row) => row.id === id)!;
  const applyData = (row: Row, data: { balance: unknown }) => {
    const balance = data.balance as { increment?: number } | number;
    if (typeof balance !== 'object' || balance === null || typeof balance.increment !== 'number') {
      throw new Error('absolute balance write — must be an atomic increment');
    }
    row.balance = Math.round((row.balance + balance.increment) * 100) / 100;
  };
  const model = (store: Map<string, Row>, keyOf: (where: any) => string, prefix: string) => ({
    upsert: async ({ where }: any) => {
      const key = keyOf(where);
      if (!store.has(key)) store.set(key, { id: `${prefix}-${key}`, balance: 0 });
      return { ...store.get(key)! };
    },
    update: async ({ where, data }: any) => {
      const row = byId(where.id);
      applyData(row, data);
      return { ...row };
    },
    updateMany: async ({ where, data }: any) => {
      const row = byId(where.id);
      const floor = where.balance?.gte;
      if (typeof floor === 'number' && row.balance < floor) return { count: 0 };
      applyData(row, data);
      return { count: 1 };
    },
    findUnique: async ({ where }: any) => ({ ...byId(where.id) }),
  });

  const tx = {
    agentAccount: model(agents, (w) => w.tenantId_appType_agentId.agentId, 'a'),
    branchCashAccount: model(branches, (w) => w.tenantId_appType_branchId.branchId, 'b'),
    user: { findUnique: async ({ where }: any) => ({ branchId: seed.agentBranch?.[where.id] ?? null }) },
    walletTransaction: { create: async ({ data }: any) => { ledger.push(data); return data; } },
    accountEntry: { create: async ({ data }: { data: Omit<CapitalEntry, 'id'> }) => {
      const entry = { id: `e-${entries.length + 1}`, ...data };
      entries.push(entry);
      return entry;
    } },
  };
  return { tx: tx as any, agents, branches, ledger, entries };
}

const base = { tenantId: 't1', appType: 'microlending' };

async function main() {
  // A wallet top-up funds loans AND appears in dashboard/accounting capital.
  // Previously only float increased: the same funded payout showed -29,750.
  {
    const { tx, branches, ledger, entries } = fakeTx();
    const input = { ...base, branchId: 'br1', amount: 30_000, byUserId: 'u1', note: 'Owner capital' };
    const result = await injectBranchCashInTx(tx, input);
    assert.equal(result.branchBalance, 30_000);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].tenantId, base.tenantId);
    assert.equal(entries[0].appType, base.appType);
    assert.equal(entries[0].branchId, input.branchId);
    assert.equal(entries[0].createdBy, input.byUserId);
    assert.equal(entries[0].type, 'capital_add');
    assert.equal(entries[0].category, 'cash');
    assert.equal(entries[0].amount, 30_000);
    assert.equal(entries[0].description, input.note);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].refType, 'account_entry');
    assert.equal(ledger[0].refId, result.entry.id);
    assert.equal(ledger[0].amount, 30_000);
    assert.equal(ledger[0].branchId, input.branchId);

    await disburseFromBranch(tx, { ...base, branchId: 'br1', amount: 29_750, loanId: 'L1' });
    const payout = { type: 'loan_disburse', amount: 29_750, entryDate: result.entry.entryDate };
    const book = [...entries, payout];
    const dashboard = summarizeDashboardBookTotals(35_000, book.map((entry) => ({
      type: entry.type, _sum: { amount: entry.amount },
    })));
    assert.equal(dashboard.currentCapital, 250);
    assert.equal(dashboard.totalDisbursed, 35_000);
    assert.equal(computeAccountingMetrics({ entries: book, releases: [], loans: [] }).currentCapital, 250);
    assert.equal(branches.get('br1')!.balance, 250);
    await assert.rejects(
      disburseFromBranch(tx, { ...base, branchId: 'br1', amount: 251, loanId: 'L2' }),
      InsufficientFloatError,
    );
  }

  // Invalid capital cannot create a cash-book entry or a wallet movement.
  {
    const { tx, ledger, entries } = fakeTx();
    await assert.rejects(
      injectBranchCashInTx(tx, { ...base, branchId: 'br1', amount: 0, byUserId: 'u1' }),
      /amount must be positive/,
    );
    await assert.rejects(
      injectBranchCashInTx(tx, { ...base, branchId: null as never, amount: 100, byUserId: 'u1' }),
      /branch/i,
    );
    assert.equal(entries.length, 0);
    assert.equal(ledger.length, 0);
  }

  // Disbursement from an agent is a guarded decrement and records balanceAfter.
  {
    const { tx, agents, ledger } = fakeTx({ agents: { ag1: 5_000 }, agentBranch: { ag1: 'br1' } });
    const after = await disburseFromAgent(tx, { ...base, agentId: 'ag1', amount: 1_200, loanId: 'L1' });
    assert.equal(after, 3_800);
    assert.equal(agents.get('ag1')!.balance, 3_800);
    assert.equal(ledger[0].balanceAfter, 3_800);
    assert.equal(ledger[0].branchId, 'br1');
  }

  // Guarded decrement refuses to take an agent below zero.
  {
    const { tx, agents } = fakeTx({ agents: { ag1: 500 } });
    await assert.rejects(
      disburseFromAgent(tx, { ...base, agentId: 'ag1', amount: 800, loanId: 'L1' }),
      (error: unknown) => error instanceof InsufficientFloatError && error.available === 500 && error.required === 800,
    );
    assert.equal(agents.get('ag1')!.balance, 500);
  }

  // Branch disbursement is guarded the same way.
  {
    const { tx } = fakeTx({ branches: { br1: 100 } });
    await assert.rejects(
      disburseFromBranch(tx, { ...base, branchId: 'br1', amount: 101, loanId: 'L1' }),
      InsufficientFloatError,
    );
  }

  // Release moves cash branch -> agent and never drives the branch pool negative.
  {
    const { tx, agents, branches } = fakeTx({ branches: { br1: 1_000 } });
    const result = await releaseToAgentInTx(tx, { ...base, agentId: 'ag1', branchId: 'br1', amount: 600, byUserId: 'u1' });
    assert.equal(result.agentBalance, 600);
    assert.equal(branches.get('br1')!.balance, 400);
    assert.equal(agents.get('ag1')!.balance, 600);
    await assert.rejects(
      releaseToAgentInTx(tx, { ...base, agentId: 'ag1', branchId: 'br1', amount: 401, byUserId: 'u1' }),
      InsufficientFloatError,
    );
  }

  // Release and collection both require the branch whose pool is the other side.
  {
    const { tx } = fakeTx({ agents: { ag1: 1_000 }, branches: { br1: 1_000 } });
    await assert.rejects(
      releaseToAgentInTx(tx, { ...base, agentId: 'ag1', branchId: null as never, amount: 10, byUserId: 'u1' }),
      /branch/i,
    );
    await assert.rejects(
      collectFromAgentInTx(tx, { ...base, agentId: 'ag1', branchId: null as never, amount: 10, byUserId: 'u1' }),
      /branch/i,
    );
  }

  // Collection from an agent is a transfer: agent down, branch up, same amount.
  {
    const { tx, agents, branches } = fakeTx({ agents: { ag1: 900 }, branches: { br1: 0 } });
    const result = await collectFromAgentInTx(tx, { ...base, agentId: 'ag1', branchId: 'br1', amount: 900, byUserId: 'u1' });
    assert.deepEqual(result, { agentBalance: 0, branchBalance: 900 });
    assert.equal(agents.get('ag1')!.balance, 0);
    assert.equal(branches.get('br1')!.balance, 900);
  }

  // Cash-book mirror: withdrawals and expenses cannot overdraw the branch pool;
  // capital additions always succeed.
  {
    const { tx, branches } = fakeTx({ branches: { br1: 300 } });
    await applyAccountingCashToBranch(tx, { ...base, branchId: 'br1', amount: 200, entryType: 'capital_add', accountEntryId: 'e1' });
    assert.equal(branches.get('br1')!.balance, 500);
    await assert.rejects(
      applyAccountingCashToBranch(tx, { ...base, branchId: 'br1', amount: 501, entryType: 'expense', accountEntryId: 'e2' }),
      InsufficientFloatError,
    );
    await assert.rejects(
      applyAccountingCashToBranch(tx, { ...base, branchId: 'br1', amount: 501, entryType: 'capital_withdraw', accountEntryId: 'e3' }),
      InsufficientFloatError,
    );
    assert.equal(branches.get('br1')!.balance, 500);
  }

  console.log('wallet atomicity tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
