'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { quickAddChitMembersAction } from '@/app/(dashboard)/[module]/chits/actions';

interface QuickEntry {
  name: string;
  phone: string;
  ticketNo: string;
  address: string;
}

export default function QuickAddAndBulkImportPanel({
  groupId,
  currentCount,
  totalMembers,
  disabled = false,
}: {
  groupId: string;
  currentCount: number;
  totalMembers: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [quickOpen, setQuickOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [expandCapacity, setExpandCapacity] = useState(false);

  const [quickRows, setQuickRows] = useState<QuickEntry[]>([
    { name: '', phone: '', ticketNo: '', address: '' },
  ]);
  const [importRows, setImportRows] = useState<QuickEntry[]>([]);

  const submitEntries = async (rows: QuickEntry[], closeTarget: 'quick' | 'import') => {
    const cleaned = rows
      .filter((r) => r.name.trim() && r.phone.trim())
      .map((r) => ({
        fullName: r.name.trim(),
        phone: r.phone.trim(),
        ticketNo: r.ticketNo.trim() || undefined,
        address: r.address.trim() || undefined,
      }));
    if (cleaned.length === 0) {
      setError('Add at least one member with both name and phone.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await quickAddChitMembersAction(groupId, cleaned, expandCapacity);
      if (res.ok) {
        setSuccessMsg(`Added ${res.added.length} member ticket(s).`);
        if (closeTarget === 'quick') {
          setQuickRows([{ name: '', phone: '', ticketNo: '', address: '' }]);
          setQuickOpen(false);
        } else {
          setImportRows([]);
          setImportOpen(false);
        }
        router.refresh();
      } else {
        setError(res.error || 'Failed to add members');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unexpected error');
    }
    setBusy(false);
  };

  const handleParseFile = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.set('kind', 'members');
      fd.set('file', file);
      const res = await fetch('/api/chits/templates/parse', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.rows)) {
        setError(data.error || 'Failed to parse spreadsheet');
      } else {
        setImportRows(
          (data.rows as Array<Record<string, unknown>>).map((r) => ({
            name: String(r.name ?? ''),
            phone: String(r.phone ?? ''),
            ticketNo: String(r.ticketNo ?? ''),
            address: String(r.address ?? ''),
          })),
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload parse error');
    }
    setBusy(false);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={disabled}
          onClick={() => {
            setError('');
            setSuccessMsg('');
            setQuickOpen(true);
          }}
        >
          ⚡ Quick-Add Member
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={disabled}
          onClick={() => {
            setError('');
            setSuccessMsg('');
            setImportOpen(true);
          }}
        >
          📊 Bulk Import Excel/CSV
        </button>
      </div>

      {successMsg && (
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#047857' }}>
          ✓ {successMsg}
        </span>
      )}

      {quickOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '640px', padding: '20px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0 }}>⚡ Quick-Add Member (Name + Phone Only)</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Seats: {currentCount}/{totalMembers} · Existing phone numbers auto-link to existing customers.
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuickOpen(false)}>✕</button>
            </div>

            {error && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginBottom: '10px' }}>{error}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {quickRows.map((row, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 0.7fr 1.1fr auto', gap: '6px', alignItems: 'center' }}>
                  <input
                    className="form-control"
                    placeholder="Full Name *"
                    value={row.name}
                    onChange={(e) => setQuickRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))}
                  />
                  <input
                    className="form-control"
                    placeholder="Phone (+91) *"
                    value={row.phone}
                    onChange={(e) => setQuickRows((prev) => prev.map((r, i) => (i === idx ? { ...r, phone: e.target.value } : r)))}
                  />
                  <input
                    className="form-control"
                    placeholder="Ticket #"
                    value={row.ticketNo}
                    onChange={(e) => setQuickRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ticketNo: e.target.value } : r)))}
                  />
                  <input
                    className="form-control"
                    placeholder="City / Area"
                    value={row.address}
                    onChange={(e) => setQuickRows((prev) => prev.map((r, i) => (i === idx ? { ...r, address: e.target.value } : r)))}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={quickRows.length <= 1}
                    onClick={() => setQuickRows((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setQuickRows((prev) => [...prev, { name: '', phone: '', ticketNo: '', address: '' }])}
                >
                  + Add another row
                </button>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={expandCapacity} onChange={(e) => setExpandCapacity(e.target.checked)} />
                  Expand capacity if full
                </label>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => submitEntries(quickRows, 'quick')}>
                  {busy ? 'Adding…' : `Add ${quickRows.length} Member(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '700px', padding: '20px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0 }}>📊 Bulk Import Members (Excel / CSV)</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Download our template, fill subscriber rows, and upload to preview before saving.
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImportOpen(false)}>✕</button>
            </div>

            {error && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginBottom: '10px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', padding: '10px', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <a href="/api/chits/templates/members?format=xlsx" download="chit-members-template.xlsx" className="btn btn-secondary btn-sm">⬇ Download Excel (.xlsx)</a>
              <a href="/api/chits/templates/members?format=csv" download="chit-members-template.csv" className="btn btn-secondary btn-sm">⬇ Download CSV (.csv)</a>
              <label className="btn btn-primary btn-sm" style={{ margin: 0, cursor: 'pointer' }}>
                {busy ? 'Parsing…' : '📤 Choose .xlsx / .csv'}
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  style={{ display: 'none' }}
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleParseFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {importRows.length > 0 && (
              <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '12px' }}>
                <table className="data-table" style={{ margin: 0, fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Ticket</th>
                      <th>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>{r.phone}</td>
                        <td>{r.ticketNo || 'Auto'}</td>
                        <td>{r.address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}>
                <input type="checkbox" checked={expandCapacity} onChange={(e) => setExpandCapacity(e.target.checked)} />
                Expand capacity if exceeding {totalMembers} tickets
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setImportOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy || importRows.length === 0}
                  onClick={() => submitEntries(importRows, 'import')}
                >
                  {busy ? 'Importing…' : `Import ${importRows.length} Member(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
