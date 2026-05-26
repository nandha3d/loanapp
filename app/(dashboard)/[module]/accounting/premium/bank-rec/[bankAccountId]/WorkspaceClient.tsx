'use client';
import React, { useState, useTransition } from 'react';
import { formatIndianCurrency } from '@/lib/accounting/utils';
import { acceptProposal, rejectProposal, ignoreLine, unmatchLine, markReconciled } from '../actions';

const fmt = formatIndianCurrency;

interface StatementLine {
  id: string;
  postingDate: Date;
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  status: string;
  matchedJournalLine?: {
    id: string;
    debit: number;
    credit: number;
    entry: { entryNo: string | null; narration: string | null; entryDate: Date };
  } | null;
  proposals: Array<{
    id: string;
    score: number;
    reason: string;
    journalLine: {
      id: string;
      debit: number;
      credit: number;
      entry: { entryNo: string | null; narration: string | null; entryDate: Date };
    };
  }>;
}

interface Props {
  statement: any;
  bankAccount: any;
}

export default function WorkspaceClient({ statement, bankAccount }: Props) {
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  const [lines, setLines] = useState<StatementLine[]>(statement?.lines ?? []);
  const [isPending, startTransition] = useTransition();

  const displayLines = showUnmatchedOnly ? lines.filter(l => l.status === 'unmatched') : lines;

  const refresh = (lineId: string, updates: Partial<StatementLine>) => {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, ...updates } : l));
  };

  const handleAccept = (proposalId: string, lineId: string, journalLineId: string) => {
    startTransition(async () => {
      const res = await acceptProposal(proposalId);
      if (res.ok) refresh(lineId, { status: 'matched', proposals: [] });
    });
  };

  const handleReject = (proposalId: string, lineId: string) => {
    startTransition(async () => {
      await rejectProposal(proposalId);
      setLines(prev => prev.map(l => l.id === lineId ? { ...l, proposals: l.proposals.filter(p => p.id !== proposalId) } : l));
    });
  };

  const handleIgnore = (lineId: string) => {
    startTransition(async () => {
      await ignoreLine(lineId);
      refresh(lineId, { status: 'ignored' });
    });
  };

  const handleUnmatch = (lineId: string) => {
    startTransition(async () => {
      await unmatchLine(lineId);
      refresh(lineId, { status: 'unmatched', matchedJournalLine: null });
    });
  };

  const handleMarkReconciled = () => {
    if (!statement) return;
    startTransition(async () => {
      const res = await markReconciled(statement.id);
      if (res.ok) window.location.reload();
      else alert(res.error);
    });
  };

  const unmatchedCount = lines.filter(l => l.status === 'unmatched').length;
  const unmatchedAmt = lines.filter(l => l.status === 'unmatched').reduce((s, l) => s + Number(l.debit) + Number(l.credit), 0);

  if (!statement) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p>No statement imported yet.</p>
        <button className="btn btn-primary" style={{ marginTop: 12 }}>Import statement</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{bankAccount?.name} ({bankAccount?.ledgerAccount?.code})</h1>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={showUnmatchedOnly} onChange={e => setShowUnmatchedOnly(e.target.checked)} />
          Show only unmatched
        </label>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={handleMarkReconciled} disabled={unmatchedCount > 0 || isPending}>
          Mark reconciled
        </button>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, background: '#f9fafb', padding: '10px 16px', borderRadius: 8, flexWrap: 'wrap' }}>
        <span>Period: {new Date(statement.statementFrom).toLocaleDateString('en-IN')} – {new Date(statement.statementTo).toLocaleDateString('en-IN')}</span>
        <span>Bank closing: {fmt(Number(statement.closingBalance))}</span>
        {unmatchedCount > 0 && <span style={{ color: 'orange' }}>⚠ Unmatched: {unmatchedCount} lines ({fmt(unmatchedAmt)} net)</span>}
        {unmatchedCount === 0 && <span style={{ color: 'green' }}>✔ All matched</span>}
      </div>

      {/* Lines */}
      <div>
        {displayLines.map(line => (
          <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
            {/* Bank side */}
            <div style={{ padding: 12, borderRight: '1px solid var(--border)', background: line.status === 'matched' ? '#f0fdf4' : line.status === 'ignored' ? '#f9fafb' : 'white' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(line.postingDate).toLocaleDateString('en-IN')}</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{line.description}</div>
              {line.reference && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ref: {line.reference}</div>}
              <div style={{ marginTop: 4, fontWeight: 700, color: line.credit > 0 ? '#22c55e' : '#ef4444' }}>
                {line.credit > 0 ? `Cr ${fmt(Number(line.credit))}` : `Dr ${fmt(Number(line.debit))}`}
              </div>
            </div>

            {/* Ledger side */}
            <div style={{ padding: 12, background: line.status === 'matched' ? '#f0fdf4' : line.status === 'ignored' ? '#f9fafb' : 'white' }}>
              {line.status === 'matched' && line.matchedJournalLine && (
                <div>
                  <div style={{ color: 'green', fontSize: 12 }}>→ matched</div>
                  <div style={{ fontWeight: 600 }}>{line.matchedJournalLine.entry.entryNo ?? 'JE'}</div>
                  <div style={{ fontSize: 13 }}>{line.matchedJournalLine.entry.narration}</div>
                  <button className="btn" style={{ fontSize: 11, padding: '2px 8px', marginTop: 6 }} onClick={() => handleUnmatch(line.id)} disabled={isPending}>Unmatch</button>
                </div>
              )}
              {line.status === 'ignored' && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Ignored</div>}
              {line.status === 'unmatched' && (
                <div>
                  {line.proposals.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 12, color: 'orange' }}>⚠ {line.proposals.length} proposal · {Math.round(Number(line.proposals[0].score) * 100)}%</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>{line.proposals[0].journalLine.entry.entryNo} — {line.proposals[0].journalLine.entry.narration}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button className="btn btn-primary" style={{ fontSize: 11, padding: '2px 10px' }} onClick={() => handleAccept(line.proposals[0].id, line.id, line.proposals[0].journalLine.id)} disabled={isPending}>Accept</button>
                        <button className="btn" style={{ fontSize: 11, padding: '2px 10px' }} onClick={() => handleReject(line.proposals[0].id, line.id)} disabled={isPending}>Reject</button>
                        <button className="btn" style={{ fontSize: 11, padding: '2px 10px' }} onClick={() => handleIgnore(line.id)} disabled={isPending}>Ignore</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Manual entry needed</div>
                      <a href={`../../journal/new?bankLineId=${line.id}&amt=${Number(line.credit) > 0 ? line.credit : -Number(line.debit)}`} className="btn" style={{ fontSize: 11, padding: '2px 10px', marginTop: 6, display: 'inline-block' }}>Create new JE</a>
                      <button className="btn" style={{ fontSize: 11, padding: '2px 10px', marginTop: 6, marginLeft: 6 }} onClick={() => handleIgnore(line.id)} disabled={isPending}>Ignore</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
