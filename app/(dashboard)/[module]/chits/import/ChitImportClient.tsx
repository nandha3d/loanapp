'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import {
  importRunningChitGroupAction,
  parseWhatsAppImportAction,
} from '../actions';
import {
  CHIT_ENGINE_CATALOG,
  DEFAULT_ENABLED_CHIT_ENGINE_TYPES,
  type ChitEngineType,
} from '@/lib/chits/engineTypes';

interface MemberDraft {
  name: string;
  phone: string;
  ticketNo: string;
  hasWon: boolean;
  wonPeriodNumber: string;
  wonPrizeAmount: string;
  pendingOpeningDue: string;
}

export default function ChitImportClient({
  currencySymbol = '₹',
  enabledChitTypes,
}: {
  currencySymbol?: string;
  enabledChitTypes?: ChitEngineType[];
}) {
  const router = useRouter();
  const allowedEngines =
    enabledChitTypes && enabledChitTypes.length > 0
      ? enabledChitTypes
      : [...DEFAULT_ENABLED_CHIT_ENGINE_TYPES];

  const [sourceTab, setSourceTab] = useState<'chat_file' | 'roster'>('chat_file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rosterText, setRosterText] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [periodHints, setPeriodHints] = useState<any[]>([]);

  // Form fields for imported group
  const [name, setName] = useState('');
  const [chitEngineType, setChitEngineType] = useState<ChitEngineType>(allowedEngines[0]);
  const [chitType, setChitType] = useState<'unregistered' | 'registered'>('unregistered');
  const [chitValue, setChitValue] = useState<number>(100000);
  const [monthlyContrib, setMonthlyContrib] = useState<number>(5000);
  const [totalMembers, setTotalMembers] = useState<number>(20);
  const [completedPeriods, setCompletedPeriods] = useState<number>(0);
  const [commissionPct, setCommissionPct] = useState<number>(5);
  const [auctionFrequency, setAuctionFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pinnedAnnouncement, setPinnedAnnouncement] = useState('');
  const [members, setMembers] = useState<MemberDraft[]>([]);

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('parse');
    setError('');
    setWarnings([]);
    try {
      const fd = new FormData();
      fd.set('mode', sourceTab);
      if (sourceTab === 'chat_file') {
        if (!selectedFile) throw new Error('Choose a WhatsApp chat export (.txt or .zip) file first.');
        fd.set('file', selectedFile);
      } else {
        fd.set('rosterText', rosterText);
      }
      const res = await parseWhatsAppImportAction(fd);
      if (!res.ok) throw new Error(res.error);
      const preview = res.preview;
      if (preview.suggestedGroupName && !name) setName(preview.suggestedGroupName);
      if (preview.suggestedChitValue) setChitValue(preview.suggestedChitValue);
      if (preview.suggestedMonthlyContrib) setMonthlyContrib(preview.suggestedMonthlyContrib);
      setWarnings(preview.warnings || []);
      setPeriodHints(preview.periodHints || []);

      const mapped: MemberDraft[] = (preview.members || []).map((m: any, idx: number) => ({
        name: m.name || `Member ${idx + 1}`,
        phone: m.phone || '',
        ticketNo: String(idx + 1),
        hasWon: false,
        wonPeriodNumber: '',
        wonPrizeAmount: '',
        pendingOpeningDue: '',
      }));
      setMembers(mapped);
      if (mapped.length > totalMembers) setTotalMembers(mapped.length);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse WhatsApp export');
    } finally {
      setBusy('');
    }
  };

  const handleImportSubmit = async () => {
    setBusy('import');
    setError('');
    try {
      const res = await importRunningChitGroupAction({
        name,
        chitEngineType,
        chitType,
        chitValue: Number(chitValue),
        monthlyContrib: Number(monthlyContrib),
        totalMembers: Number(totalMembers),
        completedPeriods: Number(completedPeriods),
        commissionPct: Number(commissionPct),
        auctionFrequency,
        startDate,
        pinnedAnnouncement: pinnedAnnouncement || null,
        sourceLabel: sourceTab === 'chat_file' ? 'WhatsApp Export' : 'WhatsApp Roster',
        members: members.map((m) => ({
          name: m.name,
          phone: m.phone,
          ticketNo: m.ticketNo,
          hasWon: m.hasWon,
          wonPeriodNumber: m.wonPeriodNumber ? Number(m.wonPeriodNumber) : null,
          wonPrizeAmount: m.wonPrizeAmount ? Number(m.wonPrizeAmount) : null,
          pendingOpeningDue: m.pendingOpeningDue ? Number(m.pendingOpeningDue) : 0,
        })),
      });
      if (!res.ok) throw new Error(res.error);
      router.push(`/chits/${res.imported.groupCode || res.imported.groupId}/room`);
    } catch (err: any) {
      setError(err?.message || 'Failed to import chit group');
    } finally {
      setBusy('');
    }
  };

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0 }}>📲 Import Chit Group from WhatsApp</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Migrate a running WhatsApp chit group in under 2 minutes — preserves completed cycles, prior winners, and pending dues.
          </p>
        </div>
        <Link href="/chits" className="btn btn-secondary btn-sm">← Back to Chits</Link>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Step 1: Parse WhatsApp Export or Roster */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${sourceTab === 'chat_file' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSourceTab('chat_file')}
          >
            1. Upload WhatsApp Export (.txt / .zip)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${sourceTab === 'roster' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSourceTab('roster')}
          >
            2. Paste WhatsApp List / CSV
          </button>
        </div>

        <form onSubmit={handleParse} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sourceTab === 'chat_file' ? (
            <div style={{ background: 'var(--bg-hover, #f8fafc)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                In WhatsApp → Open Group → ⋮ More / Group Info → Export Chat (Without Media)
              </div>
              <input
                type="file"
                accept=".txt,.zip,text/plain,application/zip"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                Paste names &amp; mobile numbers (one per line, e.g. &quot;1. Ravi 9876543210&quot; or &quot;Priya, +919840012345&quot;)
              </div>
              <textarea
                rows={6}
                className="form-control"
                placeholder={'1. Ravi Kumar 9876543210\n2. Priya Devi +91 98400 12345\n3. Suresh Babu 9443011223'}
                value={rosterText}
                onChange={(e) => setRosterText(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={Boolean(busy)}>
              {busy === 'parse' ? 'Parsing…' : '🔍 Parse & Preview Members'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setMembers((prev) => [...prev, { name: '', phone: '', ticketNo: String(prev.length + 1), hasWon: false, wonPeriodNumber: '', wonPrizeAmount: '', pendingOpeningDue: '' }])}
            >
              + Add Member Row Manually
            </button>
          </div>
        </form>
      </div>

      {warnings.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', color: '#854d0e', fontSize: '0.82rem' }}>
          {warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
        </div>
      )}

      {periodHints.length > 0 && (
        <div className="card" style={{ padding: '14px' }}>
          <h4 style={{ margin: '0 0 8px' }}>Detected Past Auction / Payment Hints from Chat</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto', fontSize: '0.78rem' }}>
            {periodHints.map((h, idx) => (
              <div key={idx} style={{ padding: '4px 8px', background: '#f8fafc', borderRadius: '6px' }}>
                <strong>{h.dateHint || 'Chat'}</strong> · {h.periodNumber ? `Period ${h.periodNumber} · ` : ''}{h.winnerHint ? `Winner: ${h.winnerHint} · ` : ''}{h.amountHint ? `${currencySymbol}${Number(h.amountHint).toLocaleString('en-IN')} · ` : ''}{h.snippet}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Configure Chit & Member Roster */}
      {members.length > 0 && (
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0 }}>Configure Running Chit &amp; Review Roster ({members.length} members)</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label className="form-label">Group Name *</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pollachi 3L WhatsApp Chit" />
            </div>
            <div>
              <label className="form-label">Chit Engine Template</label>
              <select className="form-control" value={chitEngineType} onChange={(e) => setChitEngineType(e.target.value as ChitEngineType)}>
                {allowedEngines.map((code) => (
                  <option key={code} value={code}>{CHIT_ENGINE_CATALOG[code].name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Chit Value ({currencySymbol})</label>
              <input type="number" className="form-control" value={chitValue} onChange={(e) => setChitValue(Number(e.target.value))} />
            </div>
            <div>
              <label className="form-label">Installment ({currencySymbol})</label>
              <input type="number" className="form-control" value={monthlyContrib} onChange={(e) => setMonthlyContrib(Number(e.target.value))} />
            </div>
            <div>
              <label className="form-label">Total Members / Cycles</label>
              <input type="number" className="form-control" value={totalMembers} onChange={(e) => setTotalMembers(Number(e.target.value))} />
            </div>
            <div>
              <label className="form-label">Already Completed Cycles (in WhatsApp)</label>
              <input type="number" min={0} max={totalMembers} className="form-control" value={completedPeriods} onChange={(e) => setCompletedPeriods(Number(e.target.value))} />
            </div>
            <div>
              <label className="form-label">Foreman Commission (%)</label>
              <input type="number" step="0.1" className="form-control" value={commissionPct} onChange={(e) => setCommissionPct(Number(e.target.value))} />
            </div>
            <div>
              <label className="form-label">Original Group Start Date</label>
              <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Frequency</label>
              <select className="form-control" value={auctionFrequency} onChange={(e) => setAuctionFrequency(e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Fortnightly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            <div>
              <label className="form-label">Governance</label>
              <select className="form-control" value={chitType} onChange={(e) => setChitType(e.target.value as any)}>
                <option value="unregistered">Unregistered</option>
                <option value="registered">Registered (Chit Funds Act)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Pinned Welcome Announcement (shown at top of Group Chat)</label>
            <input className="form-control" value={pinnedAnnouncement} onChange={(e) => setPinnedAnnouncement(e.target.value)} placeholder="e.g. Migrated from our WhatsApp group — next auction is Period 4!" />
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Name *</th>
                  <th>Mobile Number *</th>
                  <th>Won Already?</th>
                  <th>Won Period</th>
                  <th>Prize ({currencySymbol})</th>
                  <th>Opening Pending ({currencySymbol})</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => (
                  <tr key={idx}>
                    <td>
                      <input className="form-control" style={{ width: '56px' }} value={m.ticketNo} onChange={(e) => setMembers((prev) => prev.map((r, i) => i === idx ? { ...r, ticketNo: e.target.value } : r))} />
                    </td>
                    <td>
                      <input className="form-control" value={m.name} onChange={(e) => setMembers((prev) => prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))} />
                    </td>
                    <td>
                      <input className="form-control" value={m.phone} placeholder="10-digit mobile" onChange={(e) => setMembers((prev) => prev.map((r, i) => i === idx ? { ...r, phone: e.target.value } : r))} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={m.hasWon} onChange={(e) => setMembers((prev) => prev.map((r, i) => i === idx ? { ...r, hasWon: e.target.checked } : r))} />
                    </td>
                    <td>
                      <input type="number" className="form-control" style={{ width: '70px' }} disabled={!m.hasWon} value={m.wonPeriodNumber} onChange={(e) => setMembers((prev) => prev.map((r, i) => i === idx ? { ...r, wonPeriodNumber: e.target.value } : r))} />
                    </td>
                    <td>
                      <input type="number" className="form-control" style={{ width: '100px' }} disabled={!m.hasWon} value={m.wonPrizeAmount} onChange={(e) => setMembers((prev) => prev.map((r, i) => i === idx ? { ...r, wonPrizeAmount: e.target.value } : r))} />
                    </td>
                    <td>
                      <input type="number" className="form-control" style={{ width: '100px' }} placeholder="0" value={m.pendingOpeningDue} onChange={(e) => setMembers((prev) => prev.map((r, i) => i === idx ? { ...r, pendingOpeningDue: e.target.value } : r))} />
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMembers((prev) => prev.filter((_, i) => i !== idx))}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-primary" disabled={busy === 'import'} onClick={handleImportSubmit}>
              {busy === 'import' ? 'Importing Active Group…' : '✅ Import Chit Group & Open Chat Room'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
