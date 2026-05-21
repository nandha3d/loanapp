'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateChitGroup } from '../../actions';

export default function ChitGroupEditForm({
  group,
  currencySymbol,
  dict,
}: {
  group: { id: string; name: string; commissionPct: number; status: string };
  currencySymbol: string;
  dict: any;
}) {
  const d = dict.chits;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await updateChitGroup(group.id, new FormData(e.currentTarget));
    } catch (err: any) {
      setError(err.message || 'Failed to update');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '500px' }}>
      <div className="card-header"><h3>Edit Chit Group</h3></div>

      {error && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label className="form-label">{d.groupName} *</label>
        <input name="name" type="text" className="form-control" required defaultValue={group.name} />
      </div>

      <div className="form-group" style={{ marginBottom: '24px' }}>
        <label className="form-label">{d.commission} (%)</label>
        <input name="commissionPct" type="number" className="form-control" step="0.5" min="0" max="20" defaultValue={Number(group.commissionPct)} />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
          {d.cancel}
        </button>
      </div>
    </form>
  );
}
