'use client';

import { useState, useEffect } from 'react';
import { updateLoan, requestLoanEdit } from '../../actions';
import { useRouter } from 'next/navigation';
import { calculateEndDate, formatDateISO } from '@/lib/utils';
import Link from '@/components/layout/DashboardLink';
import { useDashboardPath } from '@/components/layout/useDashboardPath';

export default function LoanEditForm({
  loan,
  currencySymbol,
  dict,
  userRole,
  appType
}: {
  loan: any;
  currencySymbol: string;
  dict: any;
  userRole?: string;
  appType?: string;
}) {
  const router = useRouter();
  const dashboardPath = useDashboardPath();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // Form State
  const [principal, setPrincipal] = useState<number | ''>(Number(loan.principal));
  const [interestType, setInterestType] = useState(loan.deductionType || 'upfront_fixed');
  const [deduction, setDeduction] = useState<number | ''>(Number(loan.deduction));
  const [frequency, setFrequency] = useState(loan.frequency);
  const [dueDay, setDueDay] = useState<number | ''>(loan.dueDay != null ? loan.dueDay : '');
  const [tenure, setTenure] = useState<number | ''>(Number(loan.tenure));
  const [startDate, setStartDate] = useState(formatDateISO(new Date(loan.startDate)));
  const [penalty, setPenalty] = useState<number>(Number(loan.penaltyRate));
  const [loanType, setLoanType] = useState(loan.loanType || 'cheque');
  const [collateralDetails, setCollateralDetails] = useState(loan.collateralDetails || '');
  const [isLoanTypeExpanded, setIsLoanTypeExpanded] = useState(true);
  
  // Dynamic Collateral states
  const [chequeBankName, setChequeBankName] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeAmount, setChequeAmount] = useState<number | ''>('');
  const [goldGrams, setGoldGrams] = useState<number | ''>('');
  const [goldCarat, setGoldCarat] = useState('22K');
  const [goldItems, setGoldItems] = useState('');
  const [propertyType, setPropertyType] = useState('residential');
  const [propertyValue, setPropertyValue] = useState<number | ''>('');
  const [propertyAddress, setPropertyAddress] = useState('');

  // Initial parse of collateral
  useEffect(() => {
    try {
      if (loan.collateralDetails) {
        const col = JSON.parse(loan.collateralDetails);
        if (loan.loanType === 'cheque') {
          setChequeBankName(col.bankName || '');
          setChequeNumber(col.chequeNumber || '');
          setChequeAmount(col.chequeAmount || '');
        } else if (loan.loanType === 'gold') {
          setGoldGrams(col.grams || '');
          setGoldCarat(col.carat || '22K');
          setGoldItems(col.items || '');
        } else if (loan.loanType === 'property') {
          setPropertyType(col.type || 'residential');
          setPropertyValue(col.value || '');
          setPropertyAddress(col.address || '');
        }
      }
    } catch(e) { console.error('collateralDetails parse error', e); }
  }, [loan.collateralDetails, loan.loanType]);
  const [existingGuarantorId, setExistingGuarantorId] = useState<string | null>(loan.guarantor?.id || null);
  const [guarantorName, setGuarantorName] = useState(loan.guarantor?.name || '');
  const [guarantorPhone, setGuarantorPhone] = useState(loan.guarantor?.phone || '');
  const [guarantorAadhar, setGuarantorAadhar] = useState(loan.guarantor?.aadharNumber || '');
  const [guarantorAddress, setGuarantorAddress] = useState(loan.guarantor?.address || '');
  const [guarantorRelation, setGuarantorRelation] = useState(loan.guarantor?.relation || '');
  const [guarantorPhoto, setGuarantorPhoto] = useState<File | null>(null);
  const [guarantorPhotoPreview, setGuarantorPhotoPreview] = useState<string | null>(loan.guarantor?.photo || null);

  const pickExistingGuarantor = (g: any) => {
    setExistingGuarantorId(g.id || null);
    setGuarantorName(g.name || '');
    setGuarantorPhone(g.phone || '');
    setGuarantorAadhar(g.aadharNumber || '');
    setGuarantorAddress(g.address || '');
    setGuarantorRelation(g.relation || '');
    setGuarantorPhotoPreview(g.photo || null);
    setGuarantorPhoto(null);
  };
  const [voucherRef, setVoucherRef] = useState(loan.voucherRef || '');
  
  // --- Cheque handlers ---
  const [cheques, setCheques] = useState<any[]>(loan.securityCheques?.map((c: any) => ({ id: c.id, bank: c.bankName, num: c.chequeNumber, fileName: c.imagePath })) || []);
  const [chequePreviews, setChequePreviews] = useState<Record<number, string>>({});
  const addChequeRow = () => {
    if (cheques.length >= 5) { alert('Maximum 5 cheques allowed'); return; }
    setCheques([...cheques, { id: Date.now(), bank: '', num: '' }]);
  };
  const removeChequeRow = (id: number) => setCheques(cheques.filter(c => c.id !== id));
  const updateCheque = (id: number, field: string, value: string) => {
    setCheques(cheques.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const handleChequePhotoChange = (id: number, file: File | null) => {
    if (file) {
      const url = URL.createObjectURL(file);
      setChequePreviews(prev => ({ ...prev, [id]: url }));
      updateCheque(id, 'fileName', file.name);
    }
  };

  // API Calculated Data
  const [calculatedData, setCalculatedData] = useState<{
    disbursedAmount: number;
    totalPayable: number;
    perInstalment: number;
    endDate: string | null;
  }>({
    disbursedAmount: Number(loan.disbursed),
    totalPayable: Number(loan.totalPayable),
    perInstalment: Number(loan.perInstalment),
    endDate: loan.endDate ? formatDateISO(new Date(loan.endDate)) : null
  });

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!principal || !tenure || !startDate) return;
      try {
        const res = await fetch('/api/loans/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            principal,
            interestType,
            interestRate: deduction,
            frequency,
            tenure,
            startDate
          })
        });
        const data = await res.json();
        if (data.success) {
          setCalculatedData({
            disbursedAmount: data.disbursedAmount || data.netDisbursed || 0,
            totalPayable: data.totalPayable || 0,
            perInstalment: data.perInstalment || 0,
            endDate: data.endDate || null
          });
        }
      } catch (e) {
        console.error('Calculation failed', e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [principal, interestType, deduction, frequency, tenure, startDate]);

  const handleGuarantorPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGuarantorPhoto(file);
      setGuarantorPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Removed static computed values, using calculatedData from API

  const isEmiAddition = interestType.startsWith('emi_');
  const setCalcModel = (model: 'upfront' | 'emi') => {
    if (model === 'upfront') setInterestType('upfront_fixed');
    else setInterestType('emi_flat');
  };

  const loanTypeLabels: Record<string, string> = {
    cheque: appType === 'autofinance' ? 'Vehicle / Cheque' : (dict.loans.chequeBased || 'Cheque Based'),
  };
  
  if (appType !== 'autofinance') {
    loanTypeLabels['gold'] = dict.loans.goldBased || 'Gold Based';
    loanTypeLabels['property'] = dict.loans.propertyBased || 'Property Based';
  }

  const handleSubmit = async (fd: FormData) => {
    setLoading(true);
    setError(null);
    
    // Explicitly append all fields since it's a client form with state
    fd.set('loanId', loan.id);
    fd.set('principal', principal.toString());
    fd.set('deductionType', interestType);
    fd.set('deduction', deduction.toString());
    fd.set('frequency', frequency);
    fd.set('tenure', tenure.toString());
    fd.set('startDate', startDate);
    fd.set('penaltyRate', penalty.toString());
    fd.set('loanType', loanType);
    fd.set('dueDay', dueDay !== '' ? dueDay.toString() : '');
    
    // Process collateral JSON
    let colObj: any = {};
    if (loanType === 'cheque') {
      colObj = { bankName: chequeBankName, chequeNumber, chequeAmount };
    } else if (loanType === 'gold') {
      colObj = { grams: goldGrams, carat: goldCarat, items: goldItems };
    } else if (loanType === 'property') {
      colObj = { type: propertyType, value: propertyValue, address: propertyAddress };
    }
    fd.set('collateralDetails', JSON.stringify(colObj));
    fd.set('guarantorId', existingGuarantorId || '');
    fd.set('guarantorName', guarantorName);
    fd.set('guarantorPhone', guarantorPhone);
    fd.set('guarantorAadhar', guarantorAadhar);
    fd.set('guarantorAddress', guarantorAddress);
    fd.set('guarantorRelation', guarantorRelation);
    if (guarantorPhoto) fd.set('guarantorPhoto', guarantorPhoto);
    fd.set('voucherRef', voucherRef);
    
    if (userRole === 'agent') {
      if (!reason.trim()) {
        setError('Reason for edit request is required.');
        setLoading(false);
        return;
      }
      fd.set('reason', reason);
      const result = await requestLoanEdit(fd);
      setLoading(false);
      
      if (result && result.error) {
        setError(result.error);
      } else {
        router.push(dashboardPath(`/loans/${loan.loanCode}`));
        router.refresh();
      }
    } else {
      const result = await updateLoan(fd);
      setLoading(false);
      
      if (result && result.error) {
        setError(result.error);
      } else {
        router.push(dashboardPath(`/loans/${loan.loanCode}`));
        router.refresh();
      }
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

        <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem', color: 'var(--primary-dark)' }}>
            <span className="material-icons-outlined">person</span> 👤 Customer Information
          </h4>
        </div>

        <div className="form-group">
          <label className="form-label">{dict.customers.fullName}</label>
          <div className="form-computed" style={{ background: '#F1F5F9', fontWeight: 700 }}>
            {loan.customer.name} ({loan.customer.customerCode})
          </div>
        </div>

        {/* Collateral Header (Always Visible) */}
        <div style={{ marginTop: '32px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.05rem', color: 'var(--primary-dark)', fontWeight: 600 }}>
            <span className="material-icons-outlined">settings</span> ⚙️ {dict.loans.loanType || 'Loan Configuration'}
          </h4>
        </div>

        {/* 3 Buttons (Always Visible) */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">{dict.loans.loanType} *</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {Object.entries(loanTypeLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLoanType(key as 'cheque' | 'gold' | 'property')}
                style={{
                  padding: '12px 20px', borderRadius: 'var(--radius-sm)',
                  border: loanType === key ? '2px solid var(--primary)' : '2px solid var(--border)',
                  background: loanType === key ? 'var(--primary-light)' : 'var(--bg)',
                  color: loanType === key ? 'var(--primary-dark)' : 'var(--text)',
                  fontWeight: loanType === key ? 700 : 400,
                  cursor: 'pointer', fontSize: '.9rem', flex: '1', minWidth: '120px', textAlign: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Accordion Details Trigger (Below the 3 Buttons) */}
        <div 
          onClick={() => setIsLoanTypeExpanded(!isLoanTypeExpanded)}
          style={{ 
            marginBottom: '16px', 
            padding: '12px 16px',
            background: 'var(--bg-alt)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'background 0.2s ease'
          }}
        >
          <span style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>info</span>
            {loanTypeLabels[loanType]} Details
          </span>
          <span 
            className="material-icons-outlined" 
            style={{ 
              transform: isLoanTypeExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
              transition: 'transform 0.2s ease-in-out',
              color: 'var(--text-secondary)',
              fontSize: '18px'
            }}
          >
            expand_more
          </span>
        </div>

        {/* Collapsible details container */}
        {isLoanTypeExpanded && (
          <div style={{ transition: 'all 0.3s ease', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '16px' }}>
            {loanType === 'cheque' && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input type="text" className="form-control" value={chequeBankName} onChange={e=>setChequeBankName(e.target.value)} placeholder="e.g. HDFC Bank" />
                </div>
                <div className="form-group">
                  <label className="form-label">Cheque Number</label>
                  <input type="text" className="form-control" value={chequeNumber} onChange={e=>setChequeNumber(e.target.value)} placeholder="000000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Cheque Amount</label>
                  <input type="number" className="form-control" value={chequeAmount} onChange={e=>setChequeAmount(e.target.value ? Number(e.target.value) : '')} placeholder="Amount" />
                </div>
              </div>
            )}

            {loanType === 'gold' && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Total Weight (Grams)</label>
                  <input type="number" className="form-control" value={goldGrams} onChange={e=>setGoldGrams(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 24.5" />
                </div>
                <div className="form-group">
                  <label className="form-label">Purity (Carat)</label>
                  <select className="form-control" value={goldCarat} onChange={e=>setGoldCarat(e.target.value)}>
                    <option value="18K">18K</option>
                    <option value="20K">20K</option>
                    <option value="22K">22K</option>
                    <option value="24K">24K</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label className="form-label">Items Description</label>
                  <input type="text" className="form-control" value={goldItems} onChange={e=>setGoldItems(e.target.value)} placeholder="e.g. 2 Bangles, 1 Chain" />
                </div>
              </div>
            )}

            {loanType === 'property' && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Property Type</label>
                  <select className="form-control" value={propertyType} onChange={e=>setPropertyType(e.target.value)}>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="land">Land</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estimated Value ({currencySymbol})</label>
                  <input type="number" className="form-control" value={propertyValue} onChange={e=>setPropertyValue(e.target.value ? Number(e.target.value) : '')} placeholder="Approx value" />
                </div>
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label className="form-label">Property Address</label>
                  <textarea className="form-control" rows={2} value={propertyAddress} onChange={e=>setPropertyAddress(e.target.value)} placeholder="Full address of the property" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label" style={{ fontWeight: '600' }}>Repayment Plan Model</label>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px', background: 'var(--bg-alt)', height: '54px', alignItems: 'center', marginBottom: '8px' }}>
            <button 
              type="button" 
              onClick={() => setCalcModel('upfront')} 
              style={{
                flex: 1,
                height: '100%',
                borderRadius: 'calc(var(--radius-sm) - 2px)',
                border: 'none',
                background: !isEmiAddition ? 'var(--primary)' : 'transparent',
                color: !isEmiAddition ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                boxShadow: !isEmiAddition ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <span>⬇️</span> Upfront
            </button>
            
            <button 
              type="button" 
              onClick={() => setCalcModel('emi')} 
              style={{
                flex: 1,
                height: '100%',
                borderRadius: 'calc(var(--radius-sm) - 2px)',
                border: 'none',
                background: isEmiAddition ? 'var(--primary)' : 'transparent',
                color: isEmiAddition ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                boxShadow: isEmiAddition ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <span>📈</span> EMI
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', background: 'var(--bg-alt)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '20px' }}>
            {!isEmiAddition ? (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.9rem', cursor: 'pointer', fontWeight: 500 }}>
                  <input type="radio" checked={interestType === 'upfront_fixed'} onChange={() => setInterestType('upfront_fixed')} style={{ accentColor: 'var(--primary)' }} /> Fixed Amount
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.9rem', cursor: 'pointer', fontWeight: 500 }}>
                  <input type="radio" checked={interestType === 'upfront_percentage'} onChange={() => setInterestType('upfront_percentage')} style={{ accentColor: 'var(--primary)' }} /> % Percentage
                </label>
              </>
            ) : (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.9rem', cursor: 'pointer', fontWeight: 500 }}>
                  <input type="radio" checked={interestType === 'emi_flat'} onChange={() => setInterestType('emi_flat')} style={{ accentColor: 'var(--primary)' }} /> Flat Interest
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.9rem', cursor: 'pointer', fontWeight: 500 }}>
                  <input type="radio" checked={interestType === 'emi_floating'} onChange={() => setInterestType('emi_floating')} style={{ accentColor: 'var(--primary)' }} /> Floating (APR)
                </label>
              </>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              {interestType === 'upfront_percentage' || interestType.includes('emi_')
                ? `Interest / Rate (%) *`
                : `${dict.loans.deduction} Amount (${currencySymbol}) *`}
            </label>
            <input type="number" name="deduction" className="form-control" value={deduction} onChange={e => setDeduction(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1.1rem', padding: '12px' }} />
          </div>
          <div className="form-group">
            <label className="form-label">{dict.loans.netDisbursed}</label>
            <div className="form-computed" style={{ color: 'var(--primary)', fontWeight: 800 }}>{currencySymbol}{(calculatedData.disbursedAmount || 0).toLocaleString()}</div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{dict.loans.frequency} *</label>
            <select name="frequency" className="form-control" value={frequency} onChange={e => { setFrequency(e.target.value); setDueDay(''); }} required style={{ fontSize: '1rem', padding: '12px' }}>
              <option value="daily">{dict.creditInsights.daily}</option>
              <option value="weekly">{dict.creditInsights.weekly}</option>
              <option value="biweekly">Bi-weekly (14 days)</option>
              <option value="monthly">{dict.creditInsights.monthly}</option>
            </select>
          </div>
          {(frequency === 'weekly' || frequency === 'biweekly') && (
            <div className="form-group">
              <label className="form-label">Due Day</label>
              <select name="dueDay" className="form-control" value={dueDay} onChange={e => setDueDay(e.target.value ? Number(e.target.value) : '')} style={{ fontSize: '1rem', padding: '12px' }}>
                <option value="">Select Day</option>
                {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day, i) => (
                  <option key={i} value={i}>{day}</option>
                ))}
              </select>
            </div>
          )}
          {frequency === 'monthly' && (
            <div className="form-group">
              <label className="form-label">Due Date (Day of Month)</label>
              <select name="dueDay" className="form-control" value={dueDay} onChange={e => setDueDay(e.target.value ? Number(e.target.value) : '')} style={{ fontSize: '1rem', padding: '12px' }}>
                <option value="">Select Date</option>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
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
            <div className="form-computed">{calculatedData.endDate || '—'}</div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{dict.loans.perInstalment}</label>
            <div className="form-computed" style={{ fontWeight: 800 }}>{currencySymbol}{calculatedData.perInstalment.toLocaleString()}</div>
          </div>
          <div className="form-group">
            <label className="form-label">{dict.loans.penaltyMissed} ({currencySymbol})</label>
            <input type="number" name="penaltyRate" className="form-control" value={penalty} onChange={e => setPenalty(Number(e.target.value))} style={{ fontSize: '1rem', padding: '12px' }} />
          </div>
        </div>

        <div style={{ marginTop: '32px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem', color: 'var(--primary-dark)' }}>
            <span className="material-icons-outlined">verified_user</span> 🛡️ Guarantor Details
          </h4>
        </div>

        {loan.customer?.guarantors?.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <label className="form-label" style={{ fontSize: '.75rem', opacity: .7 }}>Existing Guarantors for this customer:</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {loan.customer.guarantors.map((g: any) => (
                <button 
                  key={g.id} 
                  type="button" 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => pickExistingGuarantor(g)}
                  style={{ padding: '4px 12px', fontSize: '.8rem', border: '1px solid var(--border)', borderRadius: '20px' }}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px', background: 'var(--bg)', marginBottom: '20px' }}>
          <div className="form-group">
            <label className="form-label">Guarantor Name</label>
            <input type="text" name="guarantorName" className="form-control" value={guarantorName} onChange={e => setGuarantorName(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{dict.loans.guarantorPhone} *</label>
              <input type="tel" name="guarantorPhone" className="form-control" value={guarantorPhone} onChange={e => setGuarantorPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Aadhar Number</label>
              <input type="text" name="guarantorAadhar" className="form-control" value={guarantorAadhar} onChange={e => setGuarantorAadhar(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Relation</label>
              <select name="guarantorRelation" className="form-control" value={guarantorRelation} onChange={e => setGuarantorRelation(e.target.value)}>
                <option value="">Select Relation</option>
                <option value="Friend">Friend</option>
                <option value="Relative">Relative</option>
                <option value="Colleague">Colleague</option>
                <option value="Business Partner">Business Partner</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Guarantor Address</label>
            <textarea name="guarantorAddress" className="form-control" rows={2} value={guarantorAddress} onChange={e => setGuarantorAddress(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Guarantor Photo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ 
                width: '140px', height: '140px', borderRadius: '12px', 
                border: '2px dashed var(--border)', background: 'var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
              }}>
                {guarantorPhotoPreview ? (
                  <img src={guarantorPhotoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>add_a_photo</span>
                )}
              </div>
              <div>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: '8px' }}>
                  Change Photo
                  <input type="file" name="guarantorPhoto" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleGuarantorPhotoChange} />
                </label>
                <p style={{ fontSize: '.75rem', color: 'var(--text-secondary)', margin: 0 }}>Upload a clear passport size photo.</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '32px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem', color: 'var(--primary-dark)' }}>
            <span className="material-icons-outlined">security</span> 🏦 Collateral & Cheques
          </h4>
        </div>

        <div style={{ marginTop: '24px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '.9rem', fontWeight: 600 }}>🏦 Security Cheques</h4>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px', background: 'var(--bg)' }}>
            {cheques.map((cheque, index) => (
              <div key={cheque.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                <div style={{ width: '24px', textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>{index + 1}</div>
                <input type="text" name={`bankName_${index}`} className="form-control" placeholder="Bank Name" value={cheque.bank}
                  onChange={e => updateCheque(cheque.id, 'bank', e.target.value)} style={{ flex: 1, fontSize: '1rem', padding: '10px' }} />
                <input type="text" name={`chequeNumber_${index}`} className="form-control" placeholder="Cheque Number" value={cheque.num}
                  onChange={e => updateCheque(cheque.id, 'num', e.target.value)} style={{ flex: 1, fontSize: '1rem', padding: '10px' }} />
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '.8rem', overflow: 'hidden', maxWidth: '150px' }}>
                  {chequePreviews[cheque.id] ? (
                    <img src={chequePreviews[cheque.id]} alt="Cheque" style={{ width: '20px', height: '20px', objectFit: 'cover', borderRadius: '2px' }} />
                  ) : (
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>image</span>
                  )}
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cheque.fileName || 'Upload'}</span>
                  <input type="file" name={`chequeImage_${index}`} accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={e => handleChequePhotoChange(cheque.id, e.target.files?.[0] || null)} />
                </label>
                <button type="button" onClick={() => removeChequeRow(cheque.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>delete</span>
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addChequeRow} style={{ marginTop: '8px', padding: '8px 14px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span> Add Cheque
            </button>
          </div>
        </div>



        <div className="form-group">
          <label className="form-label">{dict.loans.voucherRef}</label>
          <input type="text" name="voucherRef" className="form-control" value={voucherRef} onChange={e => setVoucherRef(e.target.value)} />
        </div>

        {userRole === 'agent' && (
          <div className="form-group" style={{ marginTop: '20px' }}>
            <label className="form-label">
              Reason for Edit Request <span style={{ color: 'var(--error, #ef4444)' }}>*</span>
            </label>
            <textarea
              className="form-control"
              rows={3}
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Please provide a detailed reason for requesting these edits..."
              style={{ borderRadius: '8px' }}
            />
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '12px 32px', fontSize: '1rem' }}>
            {loading ? (dict.loans.saving || 'Saving...') : (userRole === 'agent' ? 'Submit Edit Request' : (dict.loans.update || 'Update Loan'))}
          </button>
          <Link href={`/loans/${loan.loanCode}`} className="btn btn-ghost" style={{ padding: '12px 24px' }}>{dict.loans.cancel}</Link>
        </div>
      </form>
    </div>
  );
}
