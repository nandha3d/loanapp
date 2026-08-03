'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { saveFinancePartner, setFinancePartnerStatus, deleteFinancePartner } from './actions';

type Partner = {
  id: string;
  type: string;
  name: string;
  phone: string | null;
  address: string | null;
  commissionRate: string | null;
  notes: string | null;
  status: string;
  loanCount: number;
};

export default function PartnersClient({
  partners,
  currencySymbol,
}: {
  partners: Partner[];
  currencySymbol: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'broker' | 'dealer'>('broker');
  const [editing, setEditing] = useState<Partner | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = partners.filter((p) => p.type === tab);

  const openNew = () => { setEditing(null); setError(null); setIsOpen(true); };
  const openEdit = (p: Partner) => { setEditing(p); setError(null); setIsOpen(true); };

  async function toggleStatus(p: Partner) {
    setBusy(true);
    const result = await setFinancePartnerStatus(p.id, p.status === 'active' ? 'inactive' : 'active');
    setBusy(false);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  async function remove(p: Partner) {
    if (!confirm(`Remove ${p.name}? Existing loans keep their link for history.`)) return;
    setBusy(true);
    const result = await deleteFinancePartner(p.id);
    setBusy(false);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>🤝 Brokers &amp; Dealers</h3>
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span> Add {tab}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {(['broker', 'dealer'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textTransform: 'capitalize' }}>
              {t}s ({partners.filter((p) => p.type === t).length})
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg, #fee2e2)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="empty-state">
            <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>handshake</span>
            <p>No {tab}s on file yet.</p>
            <button className="btn btn-primary btn-sm" onClick={openNew}>Add the first {tab}</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Default Commission</th>
                  <th>Loans Sourced</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      {p.address && <><br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{p.address}</span></>}
                    </td>
                    <td>{p.phone || '—'}</td>
                    <td>{p.commissionRate ? `${p.commissionRate}%` : '—'}</td>
                    <td>{p.loanCount}</td>
                    <td>
                      <span className={`badge badge-${p.status === 'active' ? 'success' : 'secondary'}`}>{p.status}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => toggleStatus(p)}>
                        {p.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} disabled={busy} onClick={() => remove(p)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? `Edit ${editing.type}` : `New ${tab}`}>
        <form action={async (fd: FormData) => {
          setBusy(true);
          setError(null);
          const result = await saveFinancePartner(fd);
          setBusy(false);
          if (result?.error) setError(result.error);
          else { setIsOpen(false); router.refresh(); }
        }}>
          {editing && <input type="hidden" name="partnerId" value={editing.id} />}
          <div className="form-group">
            <label className="form-label">Type *</label>
            <select name="type" className="form-control" defaultValue={editing?.type ?? tab} required>
              <option value="broker">Broker</option>
              <option value="dealer">Dealer</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input name="name" className="form-control" required defaultValue={editing?.name ?? ''} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input name="phone" className="form-control" defaultValue={editing?.phone ?? ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Default Commission (%)</label>
              <input name="commissionRate" type="number" min="0" max="100" step="0.01" className="form-control"
                defaultValue={editing?.commissionRate ?? ''} />
              <small style={{ color: 'var(--text-light)' }}>
                Prefills the commission in {currencySymbol} on the HP wizard.
              </small>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea name="address" className="form-control" rows={2} defaultValue={editing?.address ?? ''} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea name="notes" className="form-control" rows={2} defaultValue={editing?.notes ?? ''} />
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: '.82rem', marginBottom: '10px' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
