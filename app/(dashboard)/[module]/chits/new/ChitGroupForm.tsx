'use client';

import { useState } from 'react';
import { createChitGroup } from '../actions';
import { useRouter } from 'next/navigation';

export default function ChitGroupForm({
  customers,
  currencySymbol,
  dict,
}: {
  customers: { id: string; name: string; customerCode: string }[];
  currencySymbol: string;
  dict: any;
}) {
  const d = dict.chits;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalMembers, setTotalMembers] = useState(5);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [chitValue, setChitValue] = useState(0);
  const [monthlyContrib, setMonthlyContrib] = useState(0);

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
    if (chitValue > 0 && monthlyContrib > 0 && chitValue !== monthlyContrib * totalMembers) {
      setError(`Chit value must equal monthly contribution × total members (${monthlyContrib} × ${totalMembers} = ${monthlyContrib * totalMembers})`);
      setLoading(false);
      return;
    }
    const fd = new FormData(e.currentTarget);
    // Replace member selects with current state
    selectedMembers.forEach((id) => {
      if (id) fd.append('memberIds', id);
    });
    try {
      await createChitGroup(fd);
    } catch (err: any) {
      setError(err.message || d.failed);
      setLoading(false);
    }
  };

  const availableCustomers = (idx: number) =>
    customers.filter(
      (c) => !selectedMembers.some((id, i) => i !== idx && id === c.id)
    );

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '700px' }}>
      <div className="card-header"><h3>{d.createGroup}</h3></div>

      {error && <div className="alert alert-danger" style={{ margin: '0 0 16px', padding: '10px 14px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>{error}</div>}

      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">{d.groupName} *</label>
          <input name="name" type="text" className="form-control" required placeholder="e.g. January 2026 Group" />
        </div>

        <div className="form-group">
          <label className="form-label">{d.chitValue} ({currencySymbol}) *</label>
          <input name="chitValue" type="number" className="form-control" required min="1000" placeholder="e.g. 100000" onChange={(e) => setChitValue(Number(e.target.value))} />
          {chitValue > 0 && monthlyContrib > 0 && chitValue !== monthlyContrib * totalMembers && (
            <p style={{ fontSize: '.78rem', color: 'var(--danger)', marginTop: '4px' }}>
              Must equal {monthlyContrib} × {totalMembers} = {monthlyContrib * totalMembers}
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">{d.monthlyContribution} ({currencySymbol}) *</label>
          <input name="monthlyContrib" type="number" className="form-control" required min="100" placeholder="e.g. 5000" onChange={(e) => setMonthlyContrib(Number(e.target.value))} />
        </div>

        <div className="form-group">
          <label className="form-label">{d.totalMembers} *</label>
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
          <label className="form-label">{d.commission} *</label>
          <input name="commissionPct" type="number" className="form-control" defaultValue="5" step="0.5" min="0" max="20" />
        </div>

        <div className="form-group">
          <label className="form-label">{d.startDate} *</label>
          <input name="startDate" type="date" className="form-control" required />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h4 style={{ margin: 0 }}>{d.members} ({selectedMembers.length}/{totalMembers})</h4>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={addMemberSlot}
            disabled={selectedMembers.length >= totalMembers}
          >
            + {d.addMember}
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
              <option value="">{d.selectCustomer}</option>
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
          <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>{d.clickAddMember}</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" className="btn btn-primary" disabled={loading || selectedMembers.filter(Boolean).length !== totalMembers}>
        {loading ? d.creating : d.createGroup}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>{d.cancel}</button>
      </div>
    </form>
  );
}
