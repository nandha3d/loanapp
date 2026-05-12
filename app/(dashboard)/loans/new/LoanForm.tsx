'use client';

import { useState, useEffect } from 'react';
import { createLoan } from '../actions';
import { calculateEndDate, formatDateISO } from '@/lib/utils';
import Link from 'next/link';
import Modal from '@/components/Modal';
import CustomerForm from '../../customers/new/CustomerForm';

export default function LoanForm({
  customers,
  packages,
  defaultPenalty,
  currencySymbol,
  preSelectedCustomerId,
  routes,
  agents
}: {
  customers: any[];
  packages: any[];
  defaultPenalty: number;
  currencySymbol: string;
  preSelectedCustomerId?: string;
  routes?: any[];
  agents?: any[];
}) {
  const [loading, setLoading] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  
  const [principal, setPrincipal] = useState<number | ''>('');
  const [deduction, setDeduction] = useState<number | ''>('');
  const [frequency, setFrequency] = useState('daily');
  const [tenure, setTenure] = useState<number | ''>('');
  const [startDate, setStartDate] = useState(formatDateISO(new Date()));
  const [penalty, setPenalty] = useState<number>(defaultPenalty);
  const [packageId, setPackageId] = useState('');

  // New: loan type
  const [loanType, setLoanType] = useState('cheque');
  const [collateralDetails, setCollateralDetails] = useState('');
  const [collateralDocs, setCollateralDocs] = useState<{ id: number; name: string }[]>([]);

  // New: guarantor selection
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');

  useEffect(() => {
    if (preSelectedCustomerId) {
      handleCustomerChange(preSelectedCustomerId);
    }
  }, [preSelectedCustomerId]);

  const handleCustomerChange = (id: string) => {
    const cust = localCustomers.find(c => c.id === id);
    setSelectedCustomer(cust || null);
  };

  const handleCustomerCreated = (newCustomer: any) => {
    setLocalCustomers([...localCustomers, newCustomer]);
    setSelectedCustomer(newCustomer);
    setIsCustomerModalOpen(false);
  };

  const handlePackageChange = (id: string) => {
    setPackageId(id);
    if (!id) return;
    const pkg = packages.find(p => p.id === id);
    if (pkg) {
      setPrincipal(Number(pkg.principal));
      setDeduction(Number(pkg.deduction));
      setFrequency(pkg.frequency);
      setTenure(pkg.tenure);
      setPenalty(Number(pkg.penaltyRate));
    }
  };

  const p = Number(principal) || 0;
  const d = Number(deduction) || 0;
  const t = Number(tenure) || 0;
  
  const netDisbursed = p - d;
  const perInstalment = t > 0 ? Math.round(p / t) : 0;
  const endDate = startDate && t > 0 ? calculateEndDate(new Date(startDate), frequency, t) : null;

  const loanTypeLabels: Record<string, string> = {
    cheque: '🏦 Cheque Based',
    gold: '🥇 Gold Based',
    property: '🏠 Property Based',
  };

  return (
    <div className="card" style={{ maxWidth: '900px' }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <h3>📝 Create New Loan</h3>
        {packages.length > 0 && (
          <select className="form-control" style={{ width: 'auto', fontSize: '1rem', padding: '10px' }} onChange={e => handlePackageChange(e.target.value)} value={packageId}>
            <option value="">Apply Package Template...</option>
            {packages.map(pkg => (
              <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
            ))}
          </select>
        )}
      </div>

      <form action={async (fd: FormData) => {
        setLoading(true);
        setLimitError(null);
        const result = await createLoan(fd);
        if (result && 'error' in result) {
          setLimitError(result.error);
          setLoading(false);
        }
      }}>
        {limitError && (
          <div style={{ background: 'var(--danger-bg, #fee2e2)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>block</span>
            {limitError}
          </div>
        )}
        <input type="hidden" name="packageId" value={packageId} />
        <input type="hidden" name="loanType" value={loanType} />
        
        {/* --- Customer Selection --- */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Customer *</label>
            <button type="button" onClick={() => setIsCustomerModalOpen(true)} className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', color: 'var(--primary)', fontSize: '.8rem' }}>
              + New Customer
            </button>
          </div>
          <select 
            name="customerId" className="form-control" required 
            value={selectedCustomer?.id || ''}
            onChange={(e) => handleCustomerChange(e.target.value)}
            style={{ fontSize: '1rem', padding: '12px' }}
          >
            <option value="">Search / Select Customer</option>
            {localCustomers.map(c => (
              <option key={c.id} value={c.id}>{c.customerCode} — {c.name} ({c.route?.name || 'No Route'})</option>
            ))}
          </select>
        </div>

        {selectedCustomer && (
          <div style={{ display: 'block', marginBottom: '18px' }} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
              <div className="profile-avatar" style={{ width: '40px', height: '40px', fontSize: '.85rem' }}>
                {selectedCustomer.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <strong>{selectedCustomer.name}</strong><br />
                <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>
                  {selectedCustomer.phone} · {selectedCustomer.route?.name} · {selectedCustomer.kycStatus}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* --- Loan Type Selector --- */}
        <div className="form-group">
          <label className="form-label">Loan Type *</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {Object.entries(loanTypeLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLoanType(key)}
                style={{
                  padding: '12px 20px', borderRadius: 'var(--radius-sm)',
                  border: loanType === key ? '2px solid var(--primary)' : '2px solid var(--border)',
                  background: loanType === key ? 'var(--primary-light)' : 'var(--bg)',
                  color: loanType === key ? 'var(--primary-dark)' : 'var(--text)',
                  fontWeight: loanType === key ? 700 : 400,
                  cursor: 'pointer', fontSize: '.9rem', flex: '1', minWidth: '120px', textAlign: 'center'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* --- Collateral based on type --- */}
        {loanType === 'gold' && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px', background: 'var(--bg)' }}>
            <h4 style={{ fontSize: '.85rem', marginBottom: '10px' }}>🥇 Gold / Jewel Details</h4>
            <div className="form-group">
              <label className="form-label">Description (items, weight, etc.)</label>
              <textarea name="collateralDetails" className="form-control" placeholder="e.g. Gold chain 10g, Gold ring 5g..." value={collateralDetails} onChange={e => setCollateralDetails(e.target.value)} style={{ fontSize: '1rem', padding: '12px' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Jewel Photos</label>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', justifyContent: 'center' }}>
                <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>add_photo_alternate</span>
                <span style={{ fontSize: '.85rem' }}>Upload jewel photos</span>
                <input type="file" name="collateralDocs" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => setCollateralDocs([...collateralDocs, ...Array.from(e.target.files || []).map(f => ({ id: Date.now() + Math.random(), name: f.name }))])} />
              </label>
              {collateralDocs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {collateralDocs.map(d => (
                    <span key={d.id} style={{ background: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '.78rem', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      📷 {d.name}
                      <button type="button" onClick={() => setCollateralDocs(collateralDocs.filter(x => x.id !== d.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--danger)' }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {loanType === 'property' && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px', background: 'var(--bg)' }}>
            <h4 style={{ fontSize: '.85rem', marginBottom: '10px' }}>🏠 Property Details</h4>
            <div className="form-group">
              <label className="form-label">Property Description / Address</label>
              <textarea name="collateralDetails" className="form-control" placeholder="Property address, survey number, etc..." value={collateralDetails} onChange={e => setCollateralDetails(e.target.value)} style={{ fontSize: '1rem', padding: '12px' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Property Documents</label>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', justifyContent: 'center' }}>
                <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>upload_file</span>
                <span style={{ fontSize: '.85rem' }}>Upload property documents</span>
                <input type="file" name="collateralDocs" accept="image/*,.pdf" multiple style={{ display: 'none' }}
                  onChange={e => setCollateralDocs([...collateralDocs, ...Array.from(e.target.files || []).map(f => ({ id: Date.now() + Math.random(), name: f.name }))])} />
              </label>
              {collateralDocs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {collateralDocs.map(d => (
                    <span key={d.id} style={{ background: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '.78rem', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      📄 {d.name}
                      <button type="button" onClick={() => setCollateralDocs(collateralDocs.filter(x => x.id !== d.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--danger)' }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Financial Details --- */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Loan Principal ({currencySymbol}) *</label>
            <input type="number" name="principal" className="form-control" placeholder="e.g. 30000" value={principal} onChange={e => setPrincipal(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1.1rem', padding: '12px' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Deduction Amount ({currencySymbol}) *</label>
            <input type="number" name="deduction" className="form-control" placeholder="e.g. 3000" value={deduction} onChange={e => setDeduction(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1.1rem', padding: '12px' }} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Net Cash Disbursed</label>
          <div className="form-computed">{currencySymbol}{netDisbursed.toLocaleString()}</div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Collection Frequency *</label>
            <select name="frequency" className="form-control" value={frequency} onChange={e => setFrequency(e.target.value)} required style={{ fontSize: '1rem', padding: '12px' }}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tenure (no. of instalments) *</label>
            <input type="number" name="tenure" className="form-control" placeholder="e.g. 100" value={tenure} onChange={e => setTenure(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1.1rem', padding: '12px' }} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Start Date *</label>
            <input type="date" name="startDate" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ fontSize: '1rem', padding: '12px' }} />
          </div>
          <div className="form-group">
            <label className="form-label">End Date (auto)</label>
            <div className="form-computed">{endDate ? endDate.toISOString().split('T')[0] : '—'}</div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Per-Instalment Amount</label>
            <div className="form-computed">{currencySymbol}{perInstalment.toLocaleString()}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Penalty / Missed ({currencySymbol})</label>
            <input type="number" name="penaltyRate" className="form-control" value={penalty} onChange={e => setPenalty(Number(e.target.value))} style={{ fontSize: '1rem', padding: '12px' }} />
          </div>
        </div>

        {/* --- Guarantor for this loan --- */}
        <h4 style={{ margin: '24px 0 12px', fontSize: '.9rem', fontWeight: 600 }}>🤝 Guarantor / Surety for this Loan</h4>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px', background: 'var(--bg)' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Guarantor Name</label>
              <input type="text" name="guarantorName" className="form-control" placeholder="Guarantor full name" value={guarantorName} onChange={e => setGuarantorName(e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Guarantor Phone</label>
              <input type="tel" name="guarantorPhone" className="form-control" placeholder="Phone" value={guarantorPhone} onChange={e => setGuarantorPhone(e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label className="form-label">Debit Voucher Reference</label>
          <input type="text" name="voucherRef" className="form-control" placeholder="Enter voucher reference" style={{ fontSize: '1rem', padding: '12px' }} />
        </div>

        <div className="form-actions" style={{ marginTop: '24px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading || !selectedCustomer} style={{ padding: '12px 24px', fontSize: '1rem' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>check</span> 
            {loading ? 'Creating...' : 'Create Loan'}
          </button>
          <Link href="/loans" className="btn btn-ghost" style={{ padding: '12px 24px', fontSize: '1rem' }}>Cancel</Link>
        </div>
      </form>

      {/* --- Customer Creation Modal --- */}
      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title="Register New Customer">
        {routes && agents ? (
          <CustomerForm routes={routes} agents={agents} onSuccess={handleCustomerCreated} />
        ) : (
          <p>Loading form...</p>
        )}
      </Modal>
    </div>
  );
}
