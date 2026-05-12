'use client';

import { useState } from 'react';
import { createChitGroup } from '../actions';
import { useRouter } from 'next/navigation';

export default function ChitGroupForm({
  customers,
}: {
  customers: { id: string; name: string; customerCode: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalMembers, setTotalMembers] = useState(5);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const addMemberSlot = () => {
    if (selectedMembers.length < totalMembers) {
      setSelectedMembers([...selectedMembers, '']);
    }
  };

  const updateMember = (idx: number, val: string) => {
    const updated = [...selectedMembers];
    updated[idx] = val;
    setSelectedMembers(updated);
  };

  const removeMember = (idx: number) => {
    setSelectedMembers(selectedMembers.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    // Replace member selects with current state
    selectedMembers.forEach((id) => {
      if (id) fd.append('memberIds', id);
    });
    try {
      await createChitGroup(fd);
    } catch (err: any) {
      setError(err.message || 'Failed to create chit group');
      setLoading(false);
    }
  };

  const availableCustomers = (idx: number) =>
    customers.filter(
      (c) => !selectedMembers.some((id, i) => i !== idx && id === c.id)
    );

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '700px' }}>
      <div className="card-header"><h3>Create Chit Group</h3></div>

      {error && <div className="alert alert-danger" style={{ margin: '0 0 16px', padding: '10px 14px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>{error}</div>}

      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Group Name *</label>
          <input name="name" type="text" className="form-control" required placeholder="e.g. January 2026 Group" />
        </div>

        <div className="form-group">
          <label className="form-label">Chit Value (₹) *</label>
          <input name="chitValue" type="number" className="form-control" required min="1000" placeholder="e.g. 100000" />
        </div>

        <div className="form-group">
          <label className="form-label">Monthly Contribution (₹) *</label>
          <input name="monthlyContrib" type="number" className="form-control" required min="100" placeholder="e.g. 5000" />
        </div>

        <div className="form-group">
          <label className="form-label">Total Members *</label>
          <input
            name="totalMembers"
            type="number"
            className="form-control"
            required
            min="2"
            max="100"
            value={totalMembers}
            onChange={(e) => setTotalMembers(parseInt(e.target.value) || 2)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Commission % *</label>
          <input name="commissionPct" type="number" className="form-control" defaultValue="5" step="0.5" min="0" max="20" />
        </div>

        <div className="form-group">
          <label className="form-label">Start Date *</label>
          <input name="startDate" type="date" className="form-control" required />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h4 style={{ margin: 0 }}>Members ({selectedMembers.length}/{totalMembers})</h4>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={addMemberSlot}
            disabled={selectedMembers.length >= totalMembers}
          >
            + Add Member
          </button>
        </div>
        {selectedMembers.map((memberId, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
            <span style={{ width: '24px', color: 'var(--text-secondary)', fontSize: '.85rem' }}>{idx + 1}.</span>
            <select
              className="form-control"
              value={memberId}
              onChange={(e) => updateMember(idx, e.target.value)}
              required
            >
              <option value="">Select Customer</option>
              {availableCustomers(idx).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>
              ))}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeMember(idx)}>
              <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--danger)' }}>close</span>
            </button>
          </div>
        ))}
        {selectedMembers.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Click &ldquo;Add Member&rdquo; to enroll customers.</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" className="btn btn-primary" disabled={loading || selectedMembers.filter(Boolean).length !== totalMembers}>
          {loading ? 'Creating...' : 'Create Chit Group'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}
