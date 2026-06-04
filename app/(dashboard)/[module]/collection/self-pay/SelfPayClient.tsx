'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmSelfPayAction, rejectSelfPayAction } from './actions';

type Pending = {
  token: string;
  amount: number;
  status: string;
  channel: string;
  createdAt: string;
  expiresAt: string;
  loanCode: string;
  customerName: string;
  customerCode: string;
  phone: string;
};

const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

export default function SelfPayClient({
  pending,
  gatewayLive,
}: {
  pending: Pending[];
  gatewayLive: boolean;
}) {
  const router = useRouter();
  const [busyTok, setBusyTok] = useState<string | null>(null);
  const [, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const claimed = pending.filter((p) => p.status === 'claimed');
  const awaiting = pending.filter((p) => p.status === 'active');

  function act(
    token: string,
    fn: (t: string) => Promise<{ success: boolean; error?: string }>,
    verb: string,
  ) {
    setBusyTok(token);
    setMsg(null);
    start(async () => {
      const res = await fn(token);
      setMsg(res.success ? `${verb} done.` : res.error ?? 'Failed');
      setBusyTok(null);
      router.refresh();
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 4px' }}>Self-Pay Verification</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          {gatewayLive
            ? 'Live gateway connected — most UPI payments auto-confirm. Anything here needs a manual check.'
            : 'Confirm borrower UPI payments after the money reaches your bank. One tap posts the collection.'}
        </p>
        {msg && <p style={{ fontSize: 13, marginTop: 10 }}>{msg}</p>}
      </div>

      <Section title={`Reported by borrower — needs confirmation (${claimed.length})`}>
        {claimed.length === 0 ? (
          <Empty>No payments awaiting confirmation.</Empty>
        ) : (
          <Table
            rows={claimed}
            busyTok={busyTok}
            onConfirm={(t) => act(t, confirmSelfPayAction, 'Confirm')}
            onReject={(t) => act(t, rejectSelfPayAction, 'Reject')}
            highlight
          />
        )}
      </Section>

      <Section title={`Open links — not yet reported (${awaiting.length})`}>
        {awaiting.length === 0 ? (
          <Empty>No open self-pay links.</Empty>
        ) : (
          <Table
            rows={awaiting}
            busyTok={busyTok}
            onConfirm={(t) => act(t, confirmSelfPayAction, 'Confirm')}
            onReject={(t) => act(t, rejectSelfPayAction, 'Reject')}
          />
        )}
      </Section>
    </div>
  );
}

function Table({
  rows,
  busyTok,
  onConfirm,
  onReject,
  highlight,
}: {
  rows: Pending[];
  busyTok: string | null;
  onConfirm: (t: string) => void;
  onReject: (t: string) => void;
  highlight?: boolean;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
            <th style={th}>Customer</th>
            <th style={th}>Loan</th>
            <th style={th}>Amount</th>
            <th style={th}>Channel</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.token} style={{ borderTop: '1px solid var(--border)', background: highlight ? 'rgba(217,119,6,.05)' : undefined }}>
              <td style={td}>
                {r.customerName}
                {r.phone && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.phone}</div>}
              </td>
              <td style={td}>{r.loanCode}</td>
              <td style={td}><strong>{inr(r.amount)}</strong></td>
              <td style={td}>{r.channel}</td>
              <td style={td}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={busyTok === r.token}
                    onClick={() => onConfirm(r.token)}
                  >
                    {busyTok === r.token ? '…' : 'Confirm received'}
                  </button>
                  <button className="btn btn-sm" disabled={busyTok === r.token} onClick={() => onReject(r.token)}>
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ padding: '0 0 8px' }}>{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ padding: '4px 14px 14px', color: 'var(--text-secondary)', fontSize: 14 }}>{children}</p>;
}

const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '10px 14px' };
