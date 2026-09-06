'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { seizeVehicle, releaseVehicle } from '../recoveryActions';

export type RecoveryEpisode = {
  id: string;
  seizedAt: string;
  yardLocation: string;
  seizingCharges: string;
  remarks: string | null;
  status: string;
  seizedByName: string | null;
  seizedBy: { name: string } | null;
  releasedAt: string | null;
  releasedBy: { name: string } | null;
  releaseRemarks: string | null;
};

/**
 * Seize / Release control for a financed vehicle. Renders the open episode
 * prominently and keeps the full history underneath for audit.
 */
export default function VehicleRecoveryPanel({
  vehicleId,
  registrationNo,
  hasLoan,
  episodes,
  agents,
  currencySymbol,
  formatDate,
}: {
  vehicleId: string;
  registrationNo: string;
  hasLoan: boolean;
  episodes: RecoveryEpisode[];
  agents: Array<{ id: string; name: string }>;
  currencySymbol: string;
  formatDate: (d: string | null) => string;
}) {
  const router = useRouter();
  const [seizeOpen, setSeizeOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = episodes.find((e) => e.status === 'seized') || null;
  const money = (v: string | number) => `${currencySymbol}${Number(v).toLocaleString('en-IN')}`;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <div className="card-header">
        <h3>🚨 Recovery &amp; Asset Management</h3>
        {hasLoan && (open ? (
          <button className="btn btn-primary btn-sm" onClick={() => { setError(null); setReleaseOpen(true); }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>lock_open</span> Release Vehicle
          </button>
        ) : (
          <button className="btn btn-danger btn-sm" onClick={() => { setError(null); setSeizeOpen(true); }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>car_crash</span> Seize Vehicle
          </button>
        ))}
      </div>

      {!hasLoan && (
        <p style={{ color: 'var(--text-light)', fontSize: '.85rem' }}>
          This vehicle is not linked to a loan, so it cannot be seized.
        </p>
      )}

      {error && (
        <div style={{ background: 'var(--danger-bg, #fee2e2)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {open && (
        <div style={{
          padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px',
          background: 'var(--danger-bg, #fee2e2)', border: '1px solid var(--danger)',
        }}>
          <strong style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>warning</span>
            Currently seized
          </strong>
          <div style={{ marginTop: '8px', fontSize: '.85rem', display: 'grid', gap: '4px' }}>
            <span>Seized on <strong>{formatDate(open.seizedAt)}</strong> by <strong>{open.seizedBy?.name || open.seizedByName || '—'}</strong></span>
            <span>Yard / godown: <strong>{open.yardLocation}</strong></span>
            <span>Seizing charges: <strong>{money(open.seizingCharges)}</strong></span>
            {open.remarks && <span>Remarks: {open.remarks}</span>}
          </div>
        </div>
      )}

      {episodes.length === 0 ? (
        <p style={{ color: 'var(--text-light)', fontSize: '.85rem' }}>No seizure history.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Seized</th><th>Yard</th><th>Charges</th><th>By</th><th>Released</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.seizedAt)}</td>
                  <td>{e.yardLocation}</td>
                  <td>{money(e.seizingCharges)}</td>
                  <td>{e.seizedBy?.name || e.seizedByName || '—'}</td>
                  <td>{e.releasedAt ? formatDate(e.releasedAt) : '—'}</td>
                  <td>
                    <span className={`badge badge-${e.status === 'seized' ? 'danger' : 'success'}`}>{e.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Seize ─────────────────────────────────────────────────────── */}
      <Modal isOpen={seizeOpen} onClose={() => setSeizeOpen(false)} title={`Seize ${registrationNo}`}>
        <form action={async (fd: FormData) => {
          setBusy(true); setError(null);
          const result = await seizeVehicle(fd);
          setBusy(false);
          if (result?.error) setError(result.error);
          else { setSeizeOpen(false); router.refresh(); }
        }}>
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date of Seizure *</label>
              <input name="seizedAt" type="date" className="form-control" required defaultValue={today} max={today} />
            </div>
            <div className="form-group">
              <label className="form-label">Seized By (agent)</label>
              <select name="seizedById" className="form-control" defaultValue="">
                <option value="">— Select —</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Or Recovery Team Name</label>
              <input name="seizedByName" className="form-control" placeholder="External recovery agency" />
            </div>
            <div className="form-group">
              <label className="form-label">Seizing Charges ({currencySymbol})</label>
              <input name="seizingCharges" type="number" min="0" step="0.01" className="form-control" defaultValue={0} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Godown / Yard Location *</label>
            <input name="yardLocation" className="form-control" required placeholder="Main yard, Anna Nagar" />
          </div>
          <div className="form-group">
            <label className="form-label">Remarks</label>
            <textarea name="remarks" className="form-control" rows={3} />
          </div>
          <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>
            The loan and the vehicle both move to <strong>Seized</strong> status.
          </p>
          {error && <div style={{ color: 'var(--danger)', fontSize: '.82rem', marginBottom: '10px' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setSeizeOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={busy}>{busy ? 'Recording…' : 'Confirm Seizure'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Release ───────────────────────────────────────────────────── */}
      <Modal isOpen={releaseOpen} onClose={() => setReleaseOpen(false)} title={`Release ${registrationNo}`}>
        <form action={async (fd: FormData) => {
          setBusy(true); setError(null);
          const result = await releaseVehicle(fd);
          setBusy(false);
          if (result?.error) setError(result.error);
          else { setReleaseOpen(false); router.refresh(); }
        }}>
          <input type="hidden" name="recoveryId" value={open?.id ?? ''} />
          {open && (
            <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: '14px', fontSize: '.85rem' }}>
              Seizing charges outstanding: <strong>{money(open.seizingCharges)}</strong>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Release Date</label>
              <input name="releasedAt" type="date" className="form-control" defaultValue={today} max={today} />
            </div>
            <div className="form-group">
              <label className="form-label">Charges Collected ({currencySymbol})</label>
              <input name="chargesCollected" type="number" min="0" step="0.01" className="form-control"
                defaultValue={open ? Number(open.seizingCharges) : 0} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select name="paymentMode" className="form-control" defaultValue="cash">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Remarks</label>
            <textarea name="releaseRemarks" className="form-control" rows={3} />
          </div>
          <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>
            Collected charges are booked against the loan as a <strong>charges</strong> receipt,
            so they stay out of EMI collection figures. The loan returns to <strong>Active</strong>.
          </p>
          {error && <div style={{ color: 'var(--danger)', fontSize: '.82rem', marginBottom: '10px' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setReleaseOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Releasing…' : 'Confirm Release'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
