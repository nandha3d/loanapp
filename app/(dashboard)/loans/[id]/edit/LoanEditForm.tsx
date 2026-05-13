'use client';

import { useState, useEffect } from 'react';
import { updateLoan } from '../../actions';
import { useRouter } from 'next/navigation';
import { calculateEndDate, formatDateISO } from '@/lib/utils';
import Link from 'next/link';

export default function LoanEditForm({
  loan,
  currencySymbol,
  dict
}: {
  loan: any;
  currencySymbol: string;
  dict: any;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [principal, setPrincipal] = useState<number | ''>(Number(loan.principal));
  const [deduction, setDeduction] = useState<number | ''>(Number(loan.deduction));
  const [frequency, setFrequency] = useState(loan.frequency);
  const [tenure, setTenure] = useState<number | ''>(Number(loan.tenure));
  const [startDate, setStartDate] = useState(formatDateISO(new Date(loan.startDate)));
  const [penalty, setPenalty] = useState<number>(Number(loan.penaltyRate));
  const [loanType, setLoanType] = useState(loan.loanType || 'cheque');
  const [collateralDetails, setCollateralDetails] = useState(loan.collateralDetails || '');
  const [guarantorName, setGuarantorName] = useState(loan.guarantor?.name || '');
  const [guarantorPhone, setGuarantorPhone] = useState(loan.guarantor?.phone || '');
  const [voucherRef, setVoucherRef] = useState(loan.voucherRef || '');

  // Computed values
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

  const handleSubmit = async (fd: FormData) => {
    setLoading(true);
    setError(null);
    
    // Explicitly append all fields since it's a client form with state
    fd.set('loanId', loan.id);
    fd.set('principal', principal.toString());
    fd.set('deduction', deduction.toString());
    fd.set('frequency', frequency);
    fd.set('tenure', tenure.toString());
    fd.set('startDate', startDate);
    fd.set('penaltyRate', penalty.toString());
    fd.set('loanType', loanType);
    fd.set('collateralDetails', collateralDetails);
    fd.set('guarantorName', guarantorName);
    fd.set('guarantorPhone', guarantorPhone);
    fd.set('voucherRef', voucherRef);
    
    const result = await updateLoan(fd);
    setLoading(false);
    
    if (result && result.error) {
      setError(result.error);
    } else {
      router.push(`/loans/${loan.id}`);
      router.refresh();
    }
  };

  return (
    <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="card-header">
        <h3>🛠️ {dict.loans.editTitle || 'Edit Loan'}: {loan.loanCode}</h3>
        <span className="badge badge-warning">Caution: Changing core values will regenerate the schedule</span>
      </div>
      
      <form action={handleSubmit} style={{ padding: '24px' }}>
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>error_outline</span>
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">{dict.customers.fullName}</label>
          <div className="form-computed" style={{ background: '#F1F5F9', fontWeight: 700 }}>
            {loan.customer.name} ({loan.customer.customerCode})
          </div>
        </div>

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
            <input type="number" name="principal" className="form-control" value={principal} onChange={e => setPrincipal(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1.1rem', padding: '12px' }} />
          </div>
          <div className="form-group">
            <label className="form-label">{dict.loans.deduction} ({currencySymbol}) *</label>
            <input type="number" name="deduction" className="form-control" value={deduction} onChange={e => setDeduction(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1.1rem', padding: '12px' }} />
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
            <input type="number" name="tenure" className="form-control" value={tenure} onChange={e => setTenure(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1.1rem', padding: '12px' }} />
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
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px', background: 'var(--bg)', marginBottom: '20px' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{dict.loans.guarantorName}</label>
              <input type="text" name="guarantorName" className="form-control" value={guarantorName} onChange={e => setGuarantorName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{dict.loans.guarantorPhone}</label>
              <input type="tel" name="guarantorPhone" className="form-control" value={guarantorPhone} onChange={e => setGuarantorPhone(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Collateral Details</label>
          <textarea 
            name="collateralDetails" 
            className="form-control" 
            rows={2} 
            value={collateralDetails}
            onChange={e => setCollateralDetails(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{dict.loans.voucherRef}</label>
          <input type="text" name="voucherRef" className="form-control" value={voucherRef} onChange={e => setVoucherRef(e.target.value)} />
        </div>

        <div className="form-actions" style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '12px 32px', fontSize: '1rem' }}>
            {loading ? (dict.loans.saving || 'Saving...') : (dict.loans.update || 'Update Loan')}
          </button>
          <Link href={`/loans/${loan.id}`} className="btn btn-ghost" style={{ padding: '12px 24px' }}>{dict.loans.cancel}</Link>
        </div>
      </form>
    </div>
  );
}
