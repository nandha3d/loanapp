'use client';

import { useState } from 'react';
import { createVehicle } from '../actions';
import { useRouter } from 'next/navigation';

export default function VehicleForm({
  customers,
  loans,
  dict,
}: {
  customers: { id: string; name: string; customerCode: string }[];
  loans: { id: string; loanCode: string; customerId: string }[];
  dict: any;
}) {
  const d = dict.vehicles;
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
      setError(err.message || d.failedVehicle);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '640px' }}>
      <div className="card-header"><h3>{d.addNewVehicle}</h3></div>

      {error && <div className="alert alert-danger" style={{ margin: '0 0 16px' }}>{error}</div>}

      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">{d.customer} *</label>
          <select
            name="customerId"
            className="form-control"
            required
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
          >
            <option value="">{d.selectCustomer}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">{d.linkedLoan}</label>
          <select name="loanId" className="form-control" disabled={!selectedCustomer}>
            <option value="">{d.noLoanLinked}</option>
            {filteredLoans.map((l) => (
              <option key={l.id} value={l.id}>{l.loanCode}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">{d.registrationNumber} *</label>
          <input name="registrationNo" type="text" className="form-control" required placeholder="e.g. TN01AB1234" />
        </div>

        <div className="form-group">
          <label className="form-label">{d.vehicleType} *</label>
          <select name="vehicleType" className="form-control" required>
            <option value="two_wheeler">{d.twoWheeler}</option>
            <option value="four_wheeler">{d.fourWheeler}</option>
            <option value="commercial">{d.commercial}</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">{d.makeLabel} *</label>
          <input name="make" type="text" className="form-control" required placeholder="e.g. Honda" />
        </div>

        <div className="form-group">
          <label className="form-label">{d.modelLabel} *</label>
          <input name="model" type="text" className="form-control" required placeholder="e.g. Activa 6G" />
        </div>

        <div className="form-group">
          <label className="form-label">{d.year}</label>
          <input name="year" type="number" className="form-control" min="1990" max="2030" placeholder="e.g. 2022" />
        </div>

        <div className="form-group">
          <label className="form-label">{d.color}</label>
          <input name="color" type="text" className="form-control" placeholder="e.g. Black" />
        </div>

        <div className="form-group">
          <label className="form-label">{d.engineNumber}</label>
          <input name="engineNo" type="text" className="form-control" />
        </div>

        <div className="form-group">
          <label className="form-label">{d.chassisNumber}</label>
          <input name="chassisNo" type="text" className="form-control" />
        </div>

        <div className="form-group">
          <label className="form-label">{d.insuranceExpiry}</label>
          <input name="insuranceExpiry" type="date" className="form-control" />
        </div>

        <div className="form-group">
          <label className="form-label">{d.rcDocumentPath}</label>
          <input name="rcDocPath" type="text" className="form-control" placeholder="URL or file path" />
        </div>

        <div className="form-group">
          <label className="form-label">{d.insuranceDocumentPath}</label>
          <input name="insurancePath" type="text" className="form-control" placeholder="URL or file path" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? d.saving : d.addVehicle}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>{d.cancel}</button>
      </div>
    </form>
  );
}
