'use client';

import { useState } from 'react';
import {
  releaseFundsAction,
  injectBranchAction,
  collectFromAgentAction,
  collectHandoverAction,
  rejectHandoverAction,
} from './actions';

type Pool = { branchId: string; branchName: string; balance: number };
type Agent = { agentId: string; name: string; phone: string | null; balance: number };
type PendingHandover = {
  id: string;
  agentName: string;
  amount: number;
  requestedAt: string;
  remarks: string | null;
};
type CashSummary = {
  accountingCapital: number;
  releasedToAgents: number;
  branchCashAvailable: number;
  agentFloat: number;
};

const tones = {
  green: { bg: 'var(--success-bg)', color: 'var(--success)' },
  orange: { bg: 'var(--primary-light)', color: 'var(--primary-dark)' },
  blue: { bg: 'var(--info-bg)', color: 'var(--info)' },
  red: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
  slate: { bg: 'var(--bg)', color: 'var(--text-secondary)' },
};

function fmt(symbol: string, n: number) {
  return `${symbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';
}

function MetricCard({
  icon,
  label,
  value,
  tone,
  detail,
}: {
  icon: string;
  label: string;
  value: string;
  tone: keyof typeof tones;
  detail: string;
}) {
  return (
    <div className="kpi-card" style={{ minHeight: '118px', border: '1px solid var(--border)' }}>
      <div className="kpi-icon" style={{ background: tones[tone].bg, color: tones[tone].color }}>
        <span className="material-icons-outlined">{icon}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="kpi-value" style={{ color: tones[tone].color, wordBreak: 'break-word' }}>{value}</div>
        <div className="kpi-label">{label}</div>
        <div style={{ marginTop: 6, color: 'var(--text-light)', fontSize: '.72rem', lineHeight: 1.35 }}>{detail}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="empty-state" style={{ padding: '34px 18px' }}>
      <span className="material-icons-outlined" style={{ fontSize: 42 }}>{icon}</span>
      <h3>{title}</h3>
      <p style={{ marginBottom: 0 }}>{text}</p>
    </div>
  );
}

export default function WalletClient({
  pools,
  agents,
  pendingHandovers,
  currencySymbol,
  summary,
}: {
  pools: Pool[];
  agents: Agent[];
  pendingHandovers: PendingHandover[];
  currencySymbol: string;
  summary: CashSummary;
}) {
  const branchCount = pools.length;
  const agentCount = agents.length;
  const activeAgentCount = agents.filter((agent) => agent.balance > 0).length;
  const floatCoverage =
    summary.releasedToAgents > 0 ? Math.round((summary.agentFloat / summary.releasedToAgents) * 100) : 0;

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section
        className="card"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '26px 28px',
          color: '#fff',
          background: 'linear-gradient(135deg, #1A1D23 0%, #2D1F0E 56%, #E8930C 130%)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 280,
            height: 280,
            borderRadius: '50%',
            right: -88,
            top: -118,
            background: 'radial-gradient(circle, rgba(245,166,35,.38), transparent 68%)',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', maxWidth: 620 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,.14)',
                border: '1px solid rgba(255,255,255,.22)',
                flexShrink: 0,
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: 28 }}>account_balance_wallet</span>
            </div>
            <div>
              <div className="badge" style={{ background: 'rgba(255,243,224,.16)', color: '#FFE2A3', marginBottom: 10 }}>
                Live cash control
              </div>
              <h1 style={{ margin: 0, fontSize: '1.75rem', lineHeight: 1.15, fontWeight: 800 }}>Agent Wallet</h1>
              <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,.72)', maxWidth: 560, fontSize: '.92rem' }}>
                Release funds to agents, top up branch pools, and keep field cash aligned with accounting capital.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div className="badge" style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.16)' }}>
              <span className="material-icons-outlined" style={{ fontSize: 14 }}>storefront</span>
              {branchCount} branches
            </div>
            <div className="badge" style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.16)' }}>
              <span className="material-icons-outlined" style={{ fontSize: 14 }}>groups</span>
              {agentCount} agents
            </div>
          </div>
        </div>
      </section>

      <div className="kpi-grid" style={{ marginBottom: 0 }}>
        <MetricCard
          icon="savings"
          label="Accounting cash capital"
          value={fmt(currencySymbol, summary.accountingCapital)}
          tone={summary.accountingCapital >= 0 ? 'blue' : 'red'}
          detail="Book cash available before field movement."
        />
        <MetricCard
          icon="outbox"
          label="Released to agents"
          value={fmt(currencySymbol, summary.releasedToAgents)}
          tone="orange"
          detail="Total branch cash released into the field."
        />
        <MetricCard
          icon="account_balance"
          label="Available branch cash"
          value={fmt(currencySymbol, summary.branchCashAvailable)}
          tone={summary.branchCashAvailable >= 0 ? 'green' : 'red'}
          detail={`${branchCount} branch pool${branchCount === 1 ? '' : 's'} ready for release.`}
        />
        <MetricCard
          icon="payments"
          label="Agent cash"
          value={fmt(currencySymbol, summary.agentFloat)}
          tone="green"
          detail={`${activeAgentCount} active holder${activeAgentCount === 1 ? '' : 's'} - ${floatCoverage}% of releases still in field.`}
        />
      </div>

      {pendingHandovers.length > 0 && (
        <section className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--primary)' }}>
          <div className="card-header" style={{ padding: '20px 24px 14px', marginBottom: 0, borderBottom: '1px solid var(--border)' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Cash handovers to collect</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '.8rem' }}>Agents raised these. Collect to move the cash from their float into the branch pool.</p>
            </div>
            <span className="badge badge-warning">{pendingHandovers.length} pending</span>
          </div>
          <div>
            {pendingHandovers.map((h) => (
              <HandoverRow key={h.id} handover={h} currencySymbol={currencySymbol} />
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '20px 24px 14px', marginBottom: 0, borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Branch cash pools</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '.8rem' }}>Top up a branch when accounting capital is physically available.</p>
          </div>
          <span className="badge badge-info">{fmt(currencySymbol, summary.branchCashAvailable)} available</span>
        </div>
        {pools.length === 0 ? (
          <EmptyState icon="storefront" title="No branches" text="Create a branch to start tracking branch cash pools." />
        ) : (
          <div>
            {pools.map((pool) => (
              <BranchRow key={pool.branchId} pool={pool} currencySymbol={currencySymbol} />
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '20px 24px 14px', marginBottom: 0, borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Agent cash</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '.8rem' }}>Release cash to field agents and monitor what each person currently holds.</p>
          </div>
          <span className="badge badge-active">{fmt(currencySymbol, summary.agentFloat)} in field</span>
        </div>
        {agents.length === 0 ? (
          <EmptyState icon="group_off" title="No active agents" text="Active agents will appear here once they are assigned to this tenant or branch." />
        ) : (
          <div>
            {agents.map((agent) => (
              <AgentRow key={agent.agentId} agent={agent} currencySymbol={currencySymbol} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BranchRow({ pool, currencySymbol }: { pool: Pool; currencySymbol: string }) {
  const [busy, setBusy] = useState(false);
  const tone = pool.balance < 0 ? tones.red : tones.green;

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
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <input type="hidden" name="branchId" value={pool.branchId} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: tone.bg, color: tone.color, flexShrink: 0 }}>
          <span className="material-icons-outlined" style={{ fontSize: 22 }}>storefront</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pool.branchName}</div>
          <div style={{ color: tone.color, fontSize: '.82rem', fontWeight: 800 }}>
            {fmt(currencySymbol, pool.balance)}
          </div>
        </div>
      </div>
      <input
        name="note"
        type="text"
        placeholder="Note"
        className="form-control"
      />
      <input
        name="amount"
        type="number"
        min="1"
        step="any"
        placeholder="Amount"
        required
        className="form-control"
      />
      <button
        type="submit"
        disabled={busy}
        className="btn btn-primary"
        style={{ justifyContent: 'center', whiteSpace: 'nowrap', width: '100%' }}
      >
        <span className="material-icons-outlined" style={{ fontSize: 16 }}>{busy ? 'autorenew' : 'add_circle'}</span>
        {busy ? 'Posting...' : 'Top up'}
      </button>
    </form>
  );
}

function AgentRow({ agent, currencySymbol }: { agent: Agent; currencySymbol: string }) {
  const [busy, setBusy] = useState(false);
  const hasFloat = agent.balance > 0;
  const tone = hasFloat ? tones.green : tones.slate;

  return (
    <form
      action={async (fd) => {
        const op = String(fd.get('op') || 'release');
        const amt = Number(fd.get('amount'));
        if (!amt || amt <= 0) return;
        const collect = op === 'collect';
        if (collect && amt > agent.balance) {
          alert(`${agent.name} only holds ${fmt(currencySymbol, agent.balance)} — cannot collect more.`);
          return;
        }
        if (!confirm(`${collect ? 'Collect' : 'Release'} ${fmt(currencySymbol, amt)} ${collect ? 'from' : 'to'} ${agent.name}?`)) return;
        setBusy(true);
        try {
          if (collect) {
            await collectFromAgentAction(fd);
          } else {
            const res = await releaseFundsAction(fd);
            // Branch pool can't cover the release — offer a one-tap capital
            // top-up for the shortfall, then release in the same flow.
            if (res && 'lowCapital' in res && res.lowCapital) {
              const ok = confirm(
                `⚠ Low capital: the branch pool holds only ${fmt(currencySymbol, res.balance)}, ` +
                `but this release needs ${fmt(currencySymbol, amt)}.\n\n` +
                `Add ${fmt(currencySymbol, res.shortfall)} as capital now and release?`,
              );
              if (ok) {
                fd.set('autoTopUp', '1');
                await releaseFundsAction(fd);
              }
            }
          }
        } finally {
          setBusy(false);
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <input type="hidden" name="agentId" value={agent.agentId} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', background: tone.bg, color: tone.color, fontWeight: 800, flexShrink: 0 }}>
          {initials(agent.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: tone.color, fontSize: '.82rem', fontWeight: 800 }}>{fmt(currencySymbol, agent.balance)}</span>
            {agent.phone && <span style={{ color: 'var(--text-light)', fontSize: '.74rem' }}>{agent.phone}</span>}
          </div>
        </div>
      </div>
      <input
        name="note"
        type="text"
        placeholder="Note"
        className="form-control"
      />
      <input
        name="amount"
        type="number"
        min="1"
        step="any"
        placeholder="Amount"
        required
        className="form-control"
      />
      <button
        type="submit"
        name="op"
        value="release"
        disabled={busy}
        className="btn btn-primary"
        style={{ justifyContent: 'center', whiteSpace: 'nowrap', width: '100%' }}
      >
        <span className="material-icons-outlined" style={{ fontSize: 16 }}>{busy ? 'autorenew' : 'send'}</span>
        {busy ? '...' : 'Release'}
      </button>
      <button
        type="submit"
        name="op"
        value="collect"
        disabled={busy || agent.balance <= 0}
        className="btn btn-secondary"
        style={{ justifyContent: 'center', whiteSpace: 'nowrap', width: '100%' }}
        title={agent.balance <= 0 ? 'Agent holds no float' : 'Collect cash from this agent'}
      >
        <span className="material-icons-outlined" style={{ fontSize: 16 }}>download</span>
        Collect
      </button>
    </form>
  );
}

function HandoverRow({ handover, currencySymbol }: { handover: PendingHandover; currencySymbol: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <form
      action={async (fd) => {
        const op = String(fd.get('op'));
        if (op === 'collect' && !confirm(`Collect ${fmt(currencySymbol, handover.amount)} from ${handover.agentName}?`)) return;
        if (op === 'reject' && !confirm(`Reject this ${fmt(currencySymbol, handover.amount)} handover from ${handover.agentName}?`)) return;
        setBusy(true);
        try {
          if (op === 'reject') await rejectHandoverAction(fd);
          else await collectHandoverAction(fd);
        } finally {
          setBusy(false);
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <input type="hidden" name="handoverId" value={handover.id} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', background: tones.orange.bg, color: tones.orange.color, fontWeight: 800, flexShrink: 0 }}>
          {initials(handover.agentName)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{handover.agentName}</div>
          <div style={{ color: 'var(--text-light)', fontSize: '.74rem' }}>
            {new Date(handover.requestedAt).toLocaleDateString('en-IN')}{handover.remarks ? ` · ${handover.remarks}` : ''}
          </div>
        </div>
      </div>
      <div style={{ fontWeight: 800, color: 'var(--primary-dark)' }}>{fmt(currencySymbol, handover.amount)}</div>
      <button type="submit" name="op" value="collect" disabled={busy} className="btn btn-primary" style={{ justifyContent: 'center', whiteSpace: 'nowrap', width: '100%' }}>
        <span className="material-icons-outlined" style={{ fontSize: 16 }}>{busy ? 'autorenew' : 'download'}</span>
        {busy ? '...' : 'Collect'}
      </button>
      <button type="submit" name="op" value="reject" disabled={busy} className="btn btn-ghost" style={{ justifyContent: 'center', whiteSpace: 'nowrap', width: '100%', color: 'var(--danger)' }}>
        Reject
      </button>
    </form>
  );
}
