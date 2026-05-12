'use client';

import { useState, useEffect } from 'react';
import { createLoan } from '../actions';
import { calculateEndDate, formatDateISO } from '@/lib/utils';
import Link from 'next/link';
import Modal from '@/components/Modal';
import CustomerForm from '../../customers/new/CustomerForm';

function formatCurrency(amount: number, symbol: string) {
  return symbol + amount.toLocaleString();
}

export default function LoanForm({
  customers,
  packages,
  defaultPenalty,
  currencySymbol,
  preSelectedCustomerId,
  routes,
  agents,
  dict
}: {
  customers: any[];
  packages: any[];
  defaultPenalty: number;
  currencySymbol: string;
  preSelectedCustomerId?: string;
  routes?: any[];
  agents?: any[];
  dict: any;
}) {
  const [loading, setLoading] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  
  const [history, setHistory] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [principal, setPrincipal] = useState<number | ''>('');
  const [deduction, setDeduction] = useState<number | ''>('');
  const [frequency, setFrequency] = useState('daily');
  const [tenure, setTenure] = useState<number | ''>('');
  const [startDate, setStartDate] = useState(formatDateISO(new Date()));
  const [penalty, setPenalty] = useState<number>(defaultPenalty);
  const [packageId, setPackageId] = useState('');

  const [loanType, setLoanType] = useState('cheque');
  const [collateralDetails, setCollateralDetails] = useState('');

  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');

  useEffect(() => {
    if (preSelectedCustomerId) {
      handleCustomerChange(preSelectedCustomerId);
    }
  }, [preSelectedCustomerId]);

  const handleCustomerChange = async (id: string) => {
    const cust = localCustomers.find(c => c.id === id);
    setSelectedCustomer(cust || null);
    
    if (id) {
      setLoadingHistory(true);
      setHistory(null);
      try {
        const res = await fetch(`/api/customers/${id}/history`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
        }
      } catch (err) {
        console.error('Failed to fetch history', err);
      } finally {
        setLoadingHistory(false);
      }
    } else {
      setHistory(null);
    }
  };

  const handleCustomerCreated = (newCustomer: any) => {
    setLocalCustomers([...localCustomers, newCustomer]);
    setSelectedCustomer(newCustomer);
    setIsCustomerModalOpen(false);
    handleCustomerChange(newCustomer.id);
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
    cheque: dict.loans.chequeBased,
    gold: dict.loans.goldBased,
    property: dict.loans.propertyBased,
  };

  return (
    <div className="grid-60-40" style={{ alignItems: 'start' }}>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <h3>📝 {dict.loans.createTitle}</h3>
          {packages.length > 0 && (
            <select className="form-control" style={{ width: 'auto', fontSize: '1rem', padding: '10px' }} onChange={e => handlePackageChange(e.target.value)} value={packageId}>
              <option value="">{dict.loans.applyTemplate}</option>
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
          
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ margin: 0 }}>{dict.customers.fullName} *</label>
              <button type="button" onClick={() => setIsCustomerModalOpen(true)} className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', color: 'var(--primary)', fontSize: '.8rem' }}>
                {dict.loans.newCustomer}
              </button>
            </div>
            <select 
              name="customerId" className="form-control" required 
              value={selectedCustomer?.id || ''}
              onChange={(e) => handleCustomerChange(e.target.value)}
              style={{ fontSize: '1rem', padding: '12px' }}
            >
              <option value="">{dict.loans.searchCustomer}</option>
              {localCustomers.map(c => (
                <option key={c.id} value={c.id}>{c.customerCode} — {c.name} ({c.route?.name || 'No Route'})</option>
              ))}
            </select>
          </div>

          {selectedCustomer && (
            <div style={{ block: 'block', marginBottom: '18px' }} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                <div className="profile-avatar" style={{ width: '40px', height: '40px', fontSize: '.85rem' }}>
                  {selectedCustomer.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <Link href={`/customers/${selectedCustomer.customerCode}`} target="_blank">
                    <strong>{selectedCustomer.name}</strong>
                  </Link>
                  <br />
                  <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>
                    {selectedCustomer.phone} · {selectedCustomer.route?.name} · {selectedCustomer.kycStatus}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{dict.loans.loanType} *</label>
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

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{dict.loans.principal} ({currencySymbol}) *</label>
              <input type="number" name="principal" className="form-control" placeholder={dict.creditInsights.placeholders.principal} value={principal} onChange={e => setPrincipal(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1.1rem', padding: '12px' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{dict.loans.deduction} ({currencySymbol}) *</label>
              <input type="number" name="deduction" className="form-control" placeholder={dict.creditInsights.placeholders.deduction} value={deduction} onChange={e => setDeduction(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1.1rem', padding: '12px' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{dict.loans.netDisbursed}</label>
            <div className="form-computed">{currencySymbol}{netDisbursed.toLocaleString()}</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{dict.loans.frequency} *</label>
              <select name="frequency" className="form-control" value={frequency} onChange={e => setFrequency(e.target.value)} required style={{ fontSize: '1rem', padding: '12px' }}>
                <option value="daily">{dict.creditInsights.daily}</option>
                <option value="weekly">{dict.creditInsights.weekly}</option>
                <option value="monthly">{dict.creditInsights.monthly}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{dict.loans.tenure} *</label>
              <input type="number" name="tenure" className="form-control" placeholder={dict.creditInsights.placeholders.tenure} value={tenure} onChange={e => setTenure(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1.1rem', padding: '12px' }} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{dict.loans.startDate} *</label>
              <input type="date" name="startDate" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ fontSize: '1rem', padding: '12px' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{dict.loans.endDate}</label>
              <div className="form-computed">{endDate ? endDate.toISOString().split('T')[0] : '—'}</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{dict.loans.perInstalment}</label>
              <div className="form-computed">{currencySymbol}{perInstalment.toLocaleString()}</div>
            </div>
            <div className="form-group">
              <label className="form-label">{dict.loans.penaltyMissed} ({currencySymbol})</label>
              <input type="number" name="penaltyRate" className="form-control" value={penalty} onChange={e => setPenalty(Number(e.target.value))} style={{ fontSize: '1rem', padding: '12px' }} />
            </div>
          </div>

          <h4 style={{ margin: '24px 0 12px', fontSize: '.9rem', fontWeight: 600 }}>{dict.loans.guarantorHeader}</h4>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px', background: 'var(--bg)' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{dict.loans.guarantorName}</label>
                <input type="text" name="guarantorName" className="form-control" placeholder={dict.loans.guarantorName} value={guarantorName} onChange={e => setGuarantorName(e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">{dict.loans.guarantorPhone}</label>
                <input type="tel" name="guarantorPhone" className="form-control" placeholder={dict.loans.guarantorPhone} value={guarantorPhone} onChange={e => setGuarantorPhone(e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">{dict.loans.voucherRef}</label>
            <input type="text" name="voucherRef" className="form-control" placeholder={dict.loans.voucherRef} style={{ fontSize: '1rem', padding: '12px' }} />
          </div>

          <div className="form-actions" style={{ marginTop: '24px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading || !selectedCustomer} style={{ padding: '12px 24px', fontSize: '1rem' }}>
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>check</span> 
              {loading ? dict.loans.creating : dict.loans.submit}
            </button>
            <Link href="/loans" className="btn btn-ghost" style={{ padding: '12px 24px', fontSize: '1rem' }}>{dict.loans.cancel}</Link>
          </div>
        </form>
      </div>

      <div className="card sticky-top" style={{ top: '20px' }}>
        <div className="card-header">
          <h3>📊 {dict.creditInsights.title}</h3>
        </div>
        
        {!selectedCustomer ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--border)' }}>person_search</span>
            <p style={{ marginTop: '12px', fontSize: '.85rem' }}>{dict.creditInsights.history}</p>
          </div>
        ) : loadingHistory ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '12px', fontSize: '.85rem' }}>Analyzing...</p>
          </div>
        ) : history ? (
          <div style={{ padding: '4px' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', 
              color: '#fff', padding: '20px', borderRadius: 'var(--radius-sm)', marginBottom: '20px',
              textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,.1)'
            }}>
              <div style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: .8 }}>{dict.creditInsights.score}</div>
              <div style={{ fontSize: '3rem', fontWeight: 800, margin: '4px 0' }}>{history.profile.score}</div>
              <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(255,255,255,.2)', borderRadius: '20px', fontSize: '.85rem', fontWeight: 600 }}>
                {dict.creditInsights.grade}: {history.profile.grade}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>{dict.creditInsights.totalBorrowed}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>{formatCurrency(history.profile.stats.totalBorrowed, currencySymbol)}</div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>{dict.creditInsights.totalPaid}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>{formatCurrency(history.profile.stats.totalPaid, currencySymbol)}</div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>{dict.creditInsights.activeLoans}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>{history.profile.stats.activeLoans}</div>
              </div>
              <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>{dict.creditInsights.consistency}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: history.profile.stats.punctuality > 80 ? 'var(--success)' : 'var(--warning)' }}>
                  {history.profile.stats.punctuality}%
                </div>
              </div>
            </div>

            <h4 style={{ fontSize: '.85rem', marginBottom: '10px' }}>📜 {dict.creditInsights.history}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.loans.length > 0 ? history.loans.slice(0, 5).map((l: any) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: '.85rem' }}>
                  <div>
                    <strong>{l.loanCode}</strong>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>{new Date(l.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{formatCurrency(Number(l.principal), currencySymbol)}</div>
                    <span style={{ 
                      fontSize: '.7rem', padding: '2px 6px', borderRadius: '4px',
                      background: l.status === 'closed' ? '#dcfce7' : '#fef9c3',
                      color: l.status === 'closed' ? '#166534' : '#854d0e'
                    }}>
                      {l.status}
                    </span>
                  </div>
                </div>
              )) : (
                <p style={{ fontSize: '.8rem', color: 'var(--text-light)', textAlign: 'center' }}>{dict.creditInsights.noHistory}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title={dict.customers.registerTitle}>
        {routes && agents ? (
          <CustomerForm routes={routes} agents={agents} onSuccess={handleCustomerCreated} />
        ) : (
          <p>Loading form...</p>
        )}
      </Modal>
    </div>
  );
}
