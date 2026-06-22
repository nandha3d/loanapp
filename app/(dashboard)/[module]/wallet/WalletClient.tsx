'use client';

import { useState } from 'react';
import { releaseFundsAction, injectBranchAction } from './actions';

type Pool = { branchId: string; branchName: string; balance: number };
type Agent = { agentId: string; name: string; phone: string | null; balance: number };
type CashSummary = {
  accountingCapital: number;
  releasedToAgents: number;
  branchCashAvailable: number;
  agentFloat: number;
};

function fmt(symbol: string, n: number) {
  return `${symbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function WalletClient({
  pools,
  agents,
  currencySymbol,
  summary,
}: {
  pools: Pool[];
  agents: Agent[];
  currencySymbol: string;
  summary: CashSummary;
}) {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Cash Float</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-2xl font-bold text-blue-600">{fmt(currencySymbol, summary.accountingCapital)}</div>
          <div className="text-sm text-slate-500">Accounting cash capital</div>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-2xl font-bold text-amber-600">{fmt(currencySymbol, summary.releasedToAgents)}</div>
          <div className="text-sm text-slate-500">Released to agents</div>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-2xl font-bold text-emerald-600">{fmt(currencySymbol, summary.branchCashAvailable)}</div>
          <div className="text-sm text-slate-500">Available branch cash</div>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-2xl font-bold text-teal-600">{fmt(currencySymbol, summary.agentFloat)}</div>
          <div className="text-sm text-slate-500">Agent float (cash in field)</div>
        </div>
      </div>

      {/* Branch pools */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Branch cash pools</h2>
        {pools.length === 0 ? (
          <p className="text-sm text-slate-400">No branches.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {pools.map((p) => (
              <BranchRow key={p.branchId} pool={p} currencySymbol={currencySymbol} />
            ))}
          </div>
        )}
      </section>

      {/* Agents */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Agent float</h2>
        {agents.length === 0 ? (
          <p className="text-sm text-slate-400">No agents.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {agents.map((a) => (
              <AgentRow key={a.agentId} agent={a} currencySymbol={currencySymbol} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BranchRow({ pool, currencySymbol }: { pool: Pool; currencySymbol: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      action={async (fd) => {
        const amt = Number(fd.get('amount'));
        if (!amt || amt <= 0) return;
        if (!confirm(`Top up ${pool.branchName} by ${fmt(currencySymbol, amt)}?`)) return;
        setBusy(true);
        try {
          await injectBranchAction(fd);
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-center gap-3 py-3"
    >
      <input type="hidden" name="branchId" value={pool.branchId} />
      <div className="flex-1">
        <div className="font-medium text-slate-800">{pool.branchName}</div>
        <div className={`text-sm font-semibold ${pool.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {fmt(currencySymbol, pool.balance)}
        </div>
      </div>
      <input
        name="note"
        type="text"
        placeholder="Note"
        className="w-28 border border-slate-300 rounded px-2 py-1 text-sm"
      />
      <input
        name="amount"
        type="number"
        min="1"
        step="any"
        placeholder="Amount"
        required
        className="w-28 border border-slate-300 rounded px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-1.5 rounded"
      >
        {busy ? '…' : 'Top up'}
      </button>
    </form>
  );
}

function AgentRow({ agent, currencySymbol }: { agent: Agent; currencySymbol: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      action={async (fd) => {
        const amt = Number(fd.get('amount'));
        if (!amt || amt <= 0) return;
        if (!confirm(`Release ${fmt(currencySymbol, amt)} to ${agent.name}?`)) return;
        setBusy(true);
        try {
          await releaseFundsAction(fd);
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-center gap-3 py-3"
    >
      <input type="hidden" name="agentId" value={agent.agentId} />
      <div className="flex-1">
        <div className="font-medium text-slate-800">{agent.name}</div>
        <div className={`text-sm font-semibold ${agent.balance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
          {fmt(currencySymbol, agent.balance)}
        </div>
      </div>
      <input
        name="note"
        type="text"
        placeholder="Note"
        className="w-28 border border-slate-300 rounded px-2 py-1 text-sm"
      />
      <input
        name="amount"
        type="number"
        min="1"
        step="any"
        placeholder="Amount"
        required
        className="w-28 border border-slate-300 rounded px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold px-3 py-1.5 rounded"
      >
        {busy ? '…' : 'Release'}
      </button>
    </form>
  );
}
