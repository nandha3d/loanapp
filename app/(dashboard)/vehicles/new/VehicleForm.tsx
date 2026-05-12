'use client';

import { useState } from 'react';
import { createVehicle } from '../actions';
import { useRouter } from 'next/navigation';

export default function VehicleForm({
  customers,
  loans,
}: {
  customers: { id: string; name: string; customerCode: string }[];
  loans: { id: string; loanCode: string; customerId: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');

  const filteredLoans = loans.filter((l) => l.customerId === selectedCustomer);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    try {
      await createVehicle(fd);
    } catch (err: any) {
      setError(err.message || 'Failed to create vehicle');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '640px' }}>
      <div className="card-header"><h3>Add New Vehicle</h3></div>

      {error && <div className="alert alert-danger" style={{ margin: '0 0 16px' }}>{error}</div>}

      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Customer *</label>
          <select
            name="customerId"
            className="form-control"
            required
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
          >
            <option value="">Select Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Linked Loan (optional)</label>
          <select name="loanId" className="form-control" disabled={!selectedCustomer}>
            <option value="">No loan linked</option>
            {filteredLoans.map((l) => (
              <option key={l.id} value={l.id}>{l.loanCode}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Registration Number *</label>
          <input name="registrationNo" type="text" className="form-control" required placeholder="e.g. TN01AB1234" />
        </div>

        <div className="form-group">
          <label className="form-label">Vehicle Type *</label>
          <select name="vehicleType" className="form-control" required>
            <option value="two_wheeler">Two Wheeler</option>
            <option value="four_wheeler">Four Wheeler</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Make *</label>
          <input name="make" type="text" className="form-control" required placeholder="e.g. Honda" />
        </div>

        <div className="form-group">
          <label className="form-label">Model *</label>
          <input name="model" type="text" className="form-control" required placeholder="e.g. Activa 6G" />
        </div>

        <div className="form-group">
          <label className="form-label">Year</label>
          <input name="year" type="number" className="form-control" min="1990" max="2030" placeholder="e.g. 2022" />
        </div>

        <div className="form-group">
          <label className="form-label">Color</label>
          <input name="color" type="text" className="form-control" placeholder="e.g. Black" />
        </div>

        <div className="form-group">
          <label className="form-label">Engine Number</label>
          <input name="engineNo" type="text" className="form-control" />
        </div>

        <div className="form-group">
          <label className="form-label">Chassis Number</label>
          <input name="chassisNo" type="text" className="form-control" />
        </div>

        <div className="form-group">
          <label className="form-label">Insurance Expiry</label>
          <input name="insuranceExpiry" type="date" className="form-control" />
        </div>

        <div className="form-group">
          <label className="form-label">RC Document Path</label>
          <input name="rcDocPath" type="text" className="form-control" placeholder="URL or file path" />
        </div>

        <div className="form-group">
          <label className="form-label">Insurance Document Path</label>
          <input name="insurancePath" type="text" className="form-control" placeholder="URL or file path" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Add Vehicle'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}
