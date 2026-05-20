'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { flagForRepo, clearRepoFlag } from '../actions';

interface Vehicle {
  id: string;
  registrationNo: string;
  make: string;
  model: string;
  year: number | null;
  vehicleType: string;
  engineNo: string | null;
  chassisNo: string | null;
  color: string | null;
  rcDocPath: string | null;
  insurancePath: string | null;
  insuranceExpiry: Date | null;
  repoFlag: boolean;
  repoFlaggedAt: Date | null;
  repoFlaggedBy: { name: string } | null;
  customer: { id: string; name: string; customerCode: string };
  loan: { id: string; loanCode: string; status: string } | null;
}

export default function VehicleDetailClient({
  vehicle,
  formatDate,
  dict,
}: {
  vehicle: Vehicle;
  formatDate: (d: Date | null) => string;
  dict: any;
}) {
  const d = dict.vehicles;
  const router = useRouter();
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [repoReason, setRepoReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFlagRepo = async () => {
    if (!repoReason.trim()) return;
    setLoading(true);
    await flagForRepo(vehicle.id, repoReason);
    setLoading(false);
    setShowRepoModal(false);
    router.refresh();
  };

  const handleClearRepo = async () => {
    setLoading(true);
    await clearRepoFlag(vehicle.id);
    setLoading(false);
    router.refresh();
  };

  return (
    <>
      <div className="card-header" style={{ marginBottom: '16px' }}>
        <div>
          <h3>
            🚗 {vehicle.make} {vehicle.model}
            {vehicle.repoFlag && (
              <span className="badge badge-danger" style={{ marginLeft: '10px' }}>{d.repo} FLAGGED</span>
            )}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', marginTop: '4px' }}>
            {vehicle.registrationNo} &bull; {vehicle.vehicleType.replace('_', ' ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {vehicle.repoFlag ? (
            <button className="btn btn-secondary btn-sm" onClick={handleClearRepo} disabled={loading}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>flag</span>
              {d.clearRepoFlag}
            </button>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={() => setShowRepoModal(true)}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>car_crash</span>
              {d.flagForRepo}
            </button>
          )}
        </div>
      </div>

      {vehicle.repoFlag && (
        <div className="alert alert-danger" style={{ marginBottom: '16px', padding: '12px 16px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>
          <strong>⚠️ {d.repoFlagActive}</strong>
          {vehicle.repoFlaggedAt && <span> — {d.flaggedOn} {formatDate(vehicle.repoFlaggedAt)}</span>}
          {vehicle.repoFlaggedBy && <span> {d.by} {vehicle.repoFlaggedBy.name}</span>}
        </div>
      )}

      <div className="grid-2" style={{ gap: '20px' }}>
        <div className="card">
          <div className="card-header"><h3>{d.vehicleDetails}</h3></div>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr><td style={{ color: 'var(--text-secondary)', width: '40%' }}>{d.registrationNoLabel}</td><td><strong>{vehicle.registrationNo}</strong></td></tr>
              <tr><td style={{ color: 'var(--text-secondary)' }}>{d.makeModel}</td><td>{vehicle.make} {vehicle.model}</td></tr>
              <tr><td style={{ color: 'var(--text-secondary)' }}>{d.year}</td><td>{vehicle.year || '—'}</td></tr>
              <tr><td style={{ color: 'var(--text-secondary)' }}>{d.type}</td><td>{vehicle.vehicleType.replace('_', ' ')}</td></tr>
              <tr><td style={{ color: 'var(--text-secondary)' }}>{d.color}</td><td>{vehicle.color || '—'}</td></tr>
              <tr><td style={{ color: 'var(--text-secondary)' }}>{d.engineNo}</td><td>{vehicle.engineNo || '—'}</td></tr>
              <tr><td style={{ color: 'var(--text-secondary)' }}>{d.chassisNo}</td><td>{vehicle.chassisNo || '—'}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header"><h3>{d.insuranceDocs}</h3></div>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-secondary)', width: '40%' }}>{d.insuranceExpiry}</td>
                <td>
                  {vehicle.insuranceExpiry ? (
                    <span style={{ color: new Date(vehicle.insuranceExpiry) < new Date(Date.now() + 30 * 86400000) ? 'var(--danger)' : 'var(--success)' }}>
                      {formatDate(vehicle.insuranceExpiry)}
                    </span>
                  ) : '—'}
                </td>
              </tr>
              <tr><td style={{ color: 'var(--text-secondary)' }}>{d.rcDocument}</td><td>{vehicle.rcDocPath ? <a href={vehicle.rcDocPath} target="_blank" rel="noopener noreferrer">{d.viewRC}</a> : '—'}</td></tr>
              <tr><td style={{ color: 'var(--text-secondary)' }}>{d.insuranceDoc}</td><td>{vehicle.insurancePath ? <a href={vehicle.insurancePath} target="_blank" rel="noopener noreferrer">{d.viewInsurance}</a> : '—'}</td></tr>
            </tbody>
          </table>

          <div className="card-header" style={{ marginTop: '16px' }}><h3>{d.linkedRecords}</h3></div>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-secondary)', width: '40%' }}>{d.customer}</td>
                <td><a href={`/customers/${vehicle.customer.customerCode}`}>{vehicle.customer.name}</a> <span style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>({vehicle.customer.customerCode})</span></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>{d.loan}</td>
                <td>{vehicle.loan ? <a href={`/loans/${vehicle.loan.loanCode}`}>{vehicle.loan.loanCode}</a> : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Repo Modal */}
      {showRepoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '400px', padding: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>{d.flagForRepossession}</h3>
            <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              This will flag vehicle <strong>{vehicle.registrationNo}</strong> for repossession and send a notification.
            </p>
            <textarea
              className="form-control"
              placeholder={d.reasonPlaceholder}
              value={repoReason}
              onChange={(e) => setRepoReason(e.target.value)}
              rows={3}
              style={{ marginBottom: '16px', width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowRepoModal(false)}>{d.cancel}</button>
              <button className="btn btn-danger btn-sm" onClick={handleFlagRepo} disabled={loading || !repoReason.trim()}>
                {loading ? d.flagging : d.flagForRepo}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
