'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { changeDeletionRequestStatus } from './actions';

export interface DeletionRequestItem {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  organization: string | null;
  reason: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  field_agent: 'Field agent',
  branch_manager: 'Branch staff',
  superadmin: 'Owner / superadmin',
  borrower: 'Borrower',
};

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  new: { bg: '#FEE2E2', text: '#B91C1C', label: 'New' },
  in_progress: { bg: '#DBEAFE', text: '#1D4ED8', label: 'In progress' },
  completed: { bg: '#DCFCE7', text: '#15803D', label: 'Completed' },
  rejected: { bg: '#F1F5F9', text: '#475569', label: 'Rejected' },
};

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

/** Business days elapsed since submission (Mon–Sat, matching the support desk). */
function businessDaysSince(iso: string): number {
  const start = new Date(iso);
  const now = new Date();
  let days = 0;
  for (const d = new Date(start); d < now; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0) days++;
  }
  return Math.max(0, days - 1);
}

export default function DeletionRequestsClient({
  initialRows,
  currentFilter,
}: {
  initialRows: DeletionRequestItem[];
  currentFilter: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (currentFilter === 'all') return rows;
    if (currentFilter === 'open') return rows.filter((r) => r.status === 'new' || r.status === 'in_progress');
    return rows.filter((r) => r.status === currentFilter);
  }, [rows, currentFilter]);

  const setStatus = (row: DeletionRequestItem, status: string) => {
    let note: string | undefined;
    if (status === 'completed' || status === 'rejected') {
      const input = prompt(
        status === 'completed'
          ? `Mark ${row.reference} completed. Note what was deleted (kept for audit):`
          : `Reject ${row.reference}. Reason (e.g. could not verify requester):`,
        row.admin_note || '',
      );
      if (input === null) return;
      note = input;
    }
    setBusyId(row.id);
    startTransition(async () => {
      try {
        await changeDeletionRequestStatus(row.id, status, note);
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status, admin_note: note ?? r.admin_note } : r)));
      } catch {
        alert('Could not update the request. Please try again.');
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Account Deletion Requests</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            From zolofunds.com/delete-account and the app&apos;s Settings link. Verify the requester, then complete within 7 business days.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/deletion-requests?status=${f.key}`}
            className={`btn btn-sm ${currentFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="card table-wrapper" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Requester</th>
              <th>Role / organisation</th>
              <th>Submitted</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                  No requests here.
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.new;
              const open = r.status === 'new' || r.status === 'in_progress';
              const age = businessDaysSince(r.created_at);
              return (
                <tr key={r.id}>
                  <td data-label="Reference" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{r.reference}</td>
                  <td data-label="Requester">
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: '0.8rem' }}>
                      <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Your deletion request ${r.reference}`)}`}>{r.email}</a>
                      {' · '}
                      <a href={`tel:${r.phone}`}>{r.phone}</a>
                    </div>
                    {r.reason && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>“{r.reason}”</div>}
                    {r.admin_note && <div style={{ fontSize: '0.78rem', marginTop: 4 }}><b>Note:</b> {r.admin_note}</div>}
                  </td>
                  <td data-label="Role / organisation">
                    <div>{ROLE_LABEL[r.role] ?? r.role}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.organization || '—'}</div>
                  </td>
                  <td data-label="Submitted" style={{ whiteSpace: 'nowrap' }}>
                    <div>{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    {open && (
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: age >= 7 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {age} business day{age === 1 ? '' : 's'} open
                      </div>
                    )}
                  </td>
                  <td data-label="Status">
                    <span style={{ background: st.bg, color: st.text, padding: '3px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700 }}>
                      {st.label}
                    </span>
                  </td>
                  <td data-label="Actions" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {open && (
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {r.status === 'new' && (
                          <button className="btn btn-sm btn-secondary" disabled={busyId === r.id} onClick={() => setStatus(r, 'in_progress')}>
                            Start
                          </button>
                        )}
                        <button className="btn btn-sm btn-primary" disabled={busyId === r.id} onClick={() => setStatus(r, 'completed')}>
                          Complete
                        </button>
                        <button className="btn btn-sm btn-secondary" disabled={busyId === r.id} onClick={() => setStatus(r, 'rejected')}>
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
