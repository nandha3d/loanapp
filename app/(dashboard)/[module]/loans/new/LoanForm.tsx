'use client';

import { useState, useEffect } from 'react';
import { createLoan } from '../actions';
import { resolveOrnamentLine, ornamentTotals } from '@/lib/gold/ornaments';
import { calculateEndDate, formatDateISO } from '@/lib/utils';
import { getCreditScoreGaugePresentation } from '@/lib/creditScoreGauge';
import Link from '@/components/layout/DashboardLink';
import Modal from '@/components/Modal';
import CustomerForm from '../../customers/new/CustomerForm';
import { BureauReportCard } from '@/components/bureau/BureauReportCard';

function formatCurrency(amount: number, symbol: string) {
  return symbol + amount.toLocaleString();
}

const CreditScoreGauge = ({ score, grade }: { score: number, grade: string }) => {
  const gauge = getCreditScoreGaugePresentation(score, grade);

  return (
    <div style={{ textAlign: 'center', width: '100%' }}>
      <div style={{ position: 'relative', height: '80px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
        <svg viewBox="0 0 100 55" role="img" aria-label={gauge.ariaLabel} style={{ width: '140px' }}>
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" strokeLinecap="round" />
          <path d="M 10 50 A 40 40 0 0 1 30 15.3" fill="none" stroke="#EF4444" strokeWidth="10" />
          <path d="M 30 15.3 A 40 40 0 0 1 50 10" fill="none" stroke="#F59E0B" strokeWidth="10" />
          <path d="M 50 10 A 40 40 0 0 1 70 15.3" fill="none" stroke="#EAB308" strokeWidth="10" />
          <path d="M 70 15.3 A 40 40 0 0 1 90 50" fill="none" stroke="#16A34A" strokeWidth="10" />
          <g style={{ transform: `rotate(${gauge.rotation}deg)`, transformOrigin: '50px 50px', transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <circle cx="50" cy="10" r="5" fill="#FFF" stroke={gauge.color} strokeWidth="2" />
          </g>
        </svg>
        <div style={{ position: 'absolute', bottom: '5px', fontSize: '2.4rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px' }}>{score}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.6rem', color: 'var(--text-light)', marginTop: '-12px', padding: '0 4px', fontWeight: 700, width: '140px', margin: '0 auto' }}>
        <span>300</span>
        <span>850</span>
      </div>
      <div style={{ fontSize: '.9rem', fontWeight: 800, color: gauge.color, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px' }}>{grade}</div>
    </div>
  );
};

export default function LoanForm({
  customers,
  packages,
  defaultPenalty,
  currencySymbol,
  preSelectedCustomerId,
  routes,
  agents,
  dict,
  appType,
  viewerRole,
  goldMaster,
  goldConfig
}: {
  customers: any[];
  packages: any[];
  defaultPenalty: number;
  currencySymbol: string;
  preSelectedCustomerId?: string;
  routes?: any[];
  agents?: any[];
  dict: any;
  appType?: string;
  viewerRole?: string;
  goldMaster?: { ornamentTypes: any[]; ornamentSpecs: any[]; bankNames: any[] };
  goldConfig?: any;
}) {
  const [loading, setLoading] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [localPackages, setLocalPackages] = useState(packages);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  
  const [history, setHistory] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [existingGuarantorId, setExistingGuarantorId] = useState<string | null>(null);

  // Bureau checking states
  const [insightsTab, setInsightsTab] = useState<'internal' | 'bureau'>('internal');
  const [bureauReport, setBureauReport] = useState<any | null>(null);
  const [loadingBureau, setLoadingBureau] = useState(false);
  const [bureauStatusText, setBureauStatusText] = useState('');
  const [consentObtained, setConsentObtained] = useState(false);
  const [bureauError, setBureauError] = useState<string | null>(null);

  const triggerBureauPull = () => {
    if (!selectedCustomer) return;
    setLoadingBureau(true);
    setBureauError(null);
    setBureauStatusText('Initializing connection...');

    const url = `/api/bureau/pull?customerId=${selectedCustomer.id}&consentObtained=true&pullType=hard&consentMethod=verbal_recorded`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.status === 'fetching') {
          setBureauStatusText('Contacting credit bureau APIs...');
        } else if (payload.status === 'success') {
          setBureauReport(payload.data);
          setLoadingBureau(false);
          eventSource.close();
        } else if (payload.status === 'error') {
          setBureauError(payload.message || 'Bureau pull failed.');
          setLoadingBureau(false);
          eventSource.close();
        }
      } catch (err) {
        setBureauError('Failed to parse status updates.');
        setLoadingBureau(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setBureauError('Connection to status server was interrupted.');
      setLoadingBureau(false);
      eventSource.close();
    };
  };
  
  // --- Cheque handlers ---
  const [cheques, setCheques] = useState<any[]>([]);
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

  // Form State
  const [principal, setPrincipal] = useState<number | ''>('');
  const [interestType, setInterestType] = useState<string>('upfront_fixed');
  const [interestRate, setInterestRate] = useState<number | ''>('');
  const [frequency, setFrequency] = useState('daily');
  const [dueDay, setDueDay] = useState<number | ''>('');
  const [tenure, setTenure] = useState<number | ''>('');
  const [startDate, setStartDate] = useState(formatDateISO(new Date()));
  const [penalty, setPenalty] = useState<number>(defaultPenalty);
  const [packageId, setPackageId] = useState('');

  const [loanType, setLoanType] = useState('cheque');
  const [isLoanTypeExpanded, setIsLoanTypeExpanded] = useState(true);
  
  // Dynamic Collateral State
  const [chequeBankName, setChequeBankName] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeAmount, setChequeAmount] = useState<number | ''>('');
  
  const [goldGrams, setGoldGrams] = useState<number | ''>('');
  const [goldCarat, setGoldCarat] = useState('22K');
  const [goldItems, setGoldItems] = useState('');

  // Multi-ornament pledge: line items + header. Dropdowns come from goldMaster
  // (DB-driven, no hardcode); rate/LTV defaults come from goldConfig.
  const ornTypes = goldMaster?.ornamentTypes ?? [];
  const ornSpecs = goldMaster?.ornamentSpecs ?? [];
  const ornBanks = goldMaster?.bankNames ?? [];
  const defaultRate = goldConfig?.goldPureRatePerGram ?? '';
  const blankRow = () => ({ ornamentType: '', specification: '', purityKarat: '22K', quantity: 1, grossWeightGrams: '', wastageGrams: '', netWeightGrams: '', ratePerGram: defaultRate, bankName: '', refNo: '' });
  const [ornamentRows, setOrnamentRows] = useState<any[]>([blankRow()]);
  const [goldPacketNo, setGoldPacketNo] = useState('');
  const [goldStorage, setGoldStorage] = useState('');
  const updateRow = (i: number, field: string, val: any) =>
    setOrnamentRows(rows => rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  const addRow = () => setOrnamentRows(rows => [...rows, blankRow()]);
  const removeRow = (i: number) => setOrnamentRows(rows => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));
  const goldTotals = ornamentTotals(ornamentRows.map((r: any) => ({
    quantity: Number(r.quantity) || 1,
    grossWeightGrams: Number(r.grossWeightGrams) || 0,
    wastageGrams: Number(r.wastageGrams) || 0,
    netWeightGrams: r.netWeightGrams ? Number(r.netWeightGrams) : undefined,
    ratePerGram: Number(r.ratePerGram) || 0,
  })));
  const buildGoldCollateralJson = () => JSON.stringify({
    packetNo: goldPacketNo || null,
    storageLocation: goldStorage || null,
    marketRatePerGram: defaultRate !== '' ? Number(defaultRate) : null,
    eligibleLtvPercent: goldConfig?.defaultLtvPercent ?? null,
    items: ornamentRows
      .filter((r: any) => r.ornamentType || r.grossWeightGrams || r.netWeightGrams)
      .map((r: any) => ({
        ornamentType: r.ornamentType,
        specification: r.specification || null,
        purityKarat: r.purityKarat || null,
        quantity: Number(r.quantity) || 1,
        grossWeightGrams: Number(r.grossWeightGrams) || 0,
        wastageGrams: Number(r.wastageGrams) || 0,
        netWeightGrams: r.netWeightGrams ? Number(r.netWeightGrams) : undefined,
        ratePerGram: Number(r.ratePerGram) || 0,
        bankName: r.bankName || null,
        refNo: r.refNo || null,
      })),
  });
  
  const [propertyType, setPropertyType] = useState('residential');
  const [propertyValue, setPropertyValue] = useState<number | ''>('');
  const [propertyAddress, setPropertyAddress] = useState('');

  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [guarantorAadhar, setGuarantorAadhar] = useState('');
  const [guarantorAddress, setGuarantorAddress] = useState('');
  const [guarantorRelation, setGuarantorRelation] = useState('');
  const [guarantorPhoto, setGuarantorPhoto] = useState<File | null>(null);
  const [guarantorPhotoPreview, setGuarantorPhotoPreview] = useState<string | null>(null);

  const handleGuarantorPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGuarantorPhoto(file);
      setGuarantorPhotoPreview(URL.createObjectURL(file));
    }
  };

  const pickExistingGuarantor = (g: any) => {
    setExistingGuarantorId(g.id || null);
    setGuarantorName(g.name || '');
    setGuarantorPhone(g.phone || '');
    setGuarantorAadhar(g.aadharNumber || '');
    setGuarantorAddress(g.address || '');
    setGuarantorRelation(g.relation || '');
    setGuarantorPhotoPreview(g.photo || null);
    setGuarantorPhoto(null); // Reset file if picking existing
  };

  // API Calculated Data
  const [calculatedData, setCalculatedData] = useState<{
    disbursedAmount: number;
    totalPayable: number;
    perInstalment: number;
    deduction: number;
  }>({ disbursedAmount: 0, totalPayable: 0, perInstalment: 0, deduction: 0 });

  useEffect(() => {
    if (preSelectedCustomerId) {
      handleCustomerChange(preSelectedCustomerId);
    }
  }, [preSelectedCustomerId]);

  // Debounced API Call for Calculation
  useEffect(() => {
    const p = Number(principal);
    const t = Number(tenure);
    if (!p || !t) {
      setCalculatedData({ disbursedAmount: p || 0, totalPayable: p || 0, perInstalment: 0, deduction: 0 });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/loans/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            principal: p,
            interestType,
            interestRate: Number(interestRate) || 0,
            tenure: t,
            frequency,
            startDate,
            dueDay: dueDay === '' ? null : Number(dueDay),
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setCalculatedData(json.data);
          }
        }
      } catch (err) {
        console.error('Failed to calculate', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [principal, interestType, interestRate, tenure, frequency, startDate, dueDay]);

  const handleCustomerChange = async (id: string) => {
    const cust = localCustomers.find(c => c.id === id);
    setSelectedCustomer(cust || null);
    
    if (id) {
      setLoadingHistory(true);
      setHistory(null);
      
      // Reset bureau pull panel variables
      setBureauReport(null);
      setBureauError(null);
      setConsentObtained(false);
      setInsightsTab('internal');

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

      // Check for a valid cached bureau report pulled within 30 days
      try {
        const bRes = await fetch(`/api/bureau/history/${id}`);
        if (bRes.ok) {
          const bJson = await bRes.json();
          if (bJson.success && bJson.data && bJson.data.length > 0) {
            const latest = bJson.data[0];
            const isValid = new Date(latest.validUntil) >= new Date();
            if (isValid && latest.status === 'success') {
              setBureauReport(latest);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch bureau history', err);
      }
    } else {
      setHistory(null);
      setBureauReport(null);
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
    const pkg = localPackages.find(p => p.id === id);
    if (pkg) {
      setFrequency(pkg.frequency);
      setTenure(pkg.tenure);
      if (pkg.deductionType) setInterestType(pkg.deductionType);
      if (pkg.deduction !== undefined) setInterestRate(pkg.deduction);
      setPrincipal(pkg.principal);
    }
  };

  const t = Number(tenure) || 0;
  const endDate = startDate && t > 0 ? calculateEndDate(new Date(startDate), frequency, t) : null;

  const loanTypeLabels: Record<string, string> = {
    cheque: appType === 'autofinance' ? 'Vehicle / Cheque' : (dict.loans.chequeBased || 'Cheque Based'),
  };
  
  if (appType !== 'autofinance') {
    loanTypeLabels['gold'] = dict.loans.goldBased || 'Gold Based';
    loanTypeLabels['property'] = dict.loans.propertyBased || 'Property Based';
  }

  // Build JSON for collateral details
  const getCollateralDetailsJson = () => {
    if (loanType === 'cheque') {
      return JSON.stringify({ bankName: chequeBankName, chequeNumber, chequeAmount });
    } else if (loanType === 'gold') {
      return JSON.stringify({ grams: goldGrams, carat: goldCarat, items: goldItems });
    } else if (loanType === 'property') {
      return JSON.stringify({ type: propertyType, value: propertyValue, address: propertyAddress });
    }
    return '';
  };

  // Interest grouping state
  const isEmiAddition = interestType.startsWith('emi_');
  const setCalcModel = (model: 'upfront' | 'emi') => {
    if (model === 'upfront') setInterestType('upfront_fixed');
    else setInterestType('emi_flat');
  };

  return (
    <div className="grid-60-40" style={{ alignItems: 'start' }}>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <h3>📝 {dict.loans.createTitle}</h3>
          <select className="form-control" style={{ width: 'auto', fontSize: '1rem', padding: '10px' }} onChange={e => handlePackageChange(e.target.value)} value={packageId}>
            <option value="">Premade Template</option>
            {localPackages.map(pkg => (
              <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
            ))}
          </select>
        </div>

        <form action={async (fd: FormData) => {
          setLoading(true);
          setLimitError(null);
          fd.set('collateralDetails', getCollateralDetailsJson());
          fd.set('deductionType', interestType);
          fd.set('guarantorId', existingGuarantorId || '');
          if (loanType === 'gold') fd.set('goldCollateralJson', buildGoldCollateralJson());
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
          
          <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem', color: 'var(--primary-dark)' }}>
              <span className="material-icons-outlined">person</span> 👤 {dict.customers.registerTitle || 'Customer Selection'}
            </h4>
          </div>
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
            <div style={{ display: 'block', marginBottom: '18px' }} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                <div className="profile-avatar" style={{ width: '120px', height: '120px', fontSize: '2rem', borderRadius: '24px', border: '3px solid var(--border)', flexShrink: 0, overflow: 'hidden' }}>
                  {selectedCustomer.profilePhoto ? (
                    <img src={selectedCustomer.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: '#FFF' }}>
                      {selectedCustomer.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
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
                <div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Packet No</label>
                      <input type="text" className="form-control" value={goldPacketNo} onChange={e=>setGoldPacketNo(e.target.value)} placeholder="e.g. P-001" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Storage / Bank</label>
                      {ornBanks.length > 0 ? (
                        <select className="form-control" value={goldStorage} onChange={e=>setGoldStorage(e.target.value)}>
                          <option value="">Select…</option>
                          {ornBanks.map((b:any)=>(<option key={b.id} value={b.name}>{b.name}</option>))}
                        </select>
                      ) : (
                        <input type="text" className="form-control" value={goldStorage} onChange={e=>setGoldStorage(e.target.value)} placeholder="SELF LOCKER" />
                      )}
                    </div>
                  </div>

                  <label className="form-label" style={{ marginTop: 8 }}>Ornament Details</label>
                  {ornamentRows.map((row, i) => {
                    const line = resolveOrnamentLine({
                      quantity: Number(row.quantity) || 1,
                      grossWeightGrams: Number(row.grossWeightGrams) || 0,
                      wastageGrams: Number(row.wastageGrams) || 0,
                      netWeightGrams: row.netWeightGrams ? Number(row.netWeightGrams) : undefined,
                      ratePerGram: Number(row.ratePerGram) || 0,
                    });
                    return (
                      <div key={i} className="form-row" style={{ alignItems: 'flex-end', gap: 6, marginBottom: 6 }}>
                        <div className="form-group" style={{ flex: '1 1 130px' }}>
                          <label className="form-label">Ornament</label>
                          {ornTypes.length > 0 ? (
                            <select className="form-control" value={row.ornamentType} onChange={e=>updateRow(i,'ornamentType',e.target.value)}>
                              <option value="">Select…</option>
                              {ornTypes.map((t:any)=>(<option key={t.id} value={t.name}>{t.name}</option>))}
                            </select>
                          ) : (
                            <input className="form-control" value={row.ornamentType} onChange={e=>updateRow(i,'ornamentType',e.target.value)} placeholder="CHAIN" />
                          )}
                        </div>
                        <div className="form-group" style={{ flex: '1 1 110px' }}>
                          <label className="form-label">Specification</label>
                          {ornSpecs.length > 0 ? (
                            <select className="form-control" value={row.specification} onChange={e=>{const s=ornSpecs.find((x:any)=>x.name===e.target.value); updateRow(i,'specification',e.target.value); if(s?.purityKarat) updateRow(i,'purityKarat',s.purityKarat);}}>
                              <option value="">Select…</option>
                              {ornSpecs.map((s:any)=>(<option key={s.id} value={s.name}>{s.name}</option>))}
                            </select>
                          ) : (
                            <input className="form-control" value={row.specification} onChange={e=>updateRow(i,'specification',e.target.value)} placeholder="916 22K" />
                          )}
                        </div>
                        <div className="form-group" style={{ flex: '0 1 60px' }}>
                          <label className="form-label">Qty</label>
                          <input type="number" className="form-control" value={row.quantity} onChange={e=>updateRow(i,'quantity',e.target.value)} />
                        </div>
                        <div className="form-group" style={{ flex: '0 1 80px' }}>
                          <label className="form-label">Gross</label>
                          <input type="number" step="0.001" className="form-control" value={row.grossWeightGrams} onChange={e=>updateRow(i,'grossWeightGrams',e.target.value)} />
                        </div>
                        <div className="form-group" style={{ flex: '0 1 80px' }}>
                          <label className="form-label">Wastage</label>
                          <input type="number" step="0.001" className="form-control" value={row.wastageGrams} onChange={e=>updateRow(i,'wastageGrams',e.target.value)} />
                        </div>
                        <div className="form-group" style={{ flex: '0 1 80px' }}>
                          <label className="form-label">Net</label>
                          <input type="number" step="0.001" className="form-control" value={row.netWeightGrams} onChange={e=>updateRow(i,'netWeightGrams',e.target.value)} placeholder={String(line.netWeightGrams || '')} />
                        </div>
                        <div className="form-group" style={{ flex: '0 1 90px' }}>
                          <label className="form-label">Rate/g</label>
                          <input type="number" step="0.01" className="form-control" value={row.ratePerGram} onChange={e=>updateRow(i,'ratePerGram',e.target.value)} />
                        </div>
                        <div className="form-group" style={{ flex: '0 1 100px' }}>
                          <label className="form-label">Value</label>
                          <input className="form-control" value={`${currencySymbol}${line.value.toLocaleString('en-IN')}`} readOnly />
                        </div>
                        <button type="button" className="btn btn-ghost" onClick={()=>removeRow(i)} disabled={ornamentRows.length<=1} title="Remove" style={{ padding: '8px 10px' }}>✕</button>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <button type="button" className="btn btn-ghost" onClick={addRow}>+ Add ornament</button>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Qty {goldTotals.totalQuantity} · Net {goldTotals.totalNetWeight} g · Value {currencySymbol}{goldTotals.totalValue.toLocaleString('en-IN')}
                    </span>
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
                    <input type="number" className="form-control" value={propertyValue} onChange={e=>setPropertyValue(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 500000" />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label className="form-label">Property Address</label>
                    <textarea className="form-control" rows={2} value={propertyAddress} onChange={e=>setPropertyAddress(e.target.value)} placeholder="Full address" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ flex: '1', minWidth: '220px' }}>
              <label className="form-label" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text)', marginBottom: '8px', display: 'block' }}>
                {dict.loans.principal} ({currencySymbol}) *
              </label>
              <input 
                type="number" 
                name="principal" 
                className="form-control" 
                placeholder={dict.creditInsights.placeholders.principal} 
                value={principal} 
                onChange={e => setPrincipal(e.target.value ? Number(e.target.value) : '')} 
                required 
                style={{ fontSize: '1.4rem', fontWeight: 'bold', padding: '14px', height: '54px', borderRadius: 'var(--radius-sm)' }} 
              />
            </div>

            <div style={{ flex: '1.2', minWidth: '300px' }}>
              <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Repayment Plan Model</label>
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px', background: 'var(--bg-alt)', height: '54px', alignItems: 'center' }}>
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
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', background: 'var(--bg-alt)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '20px', marginTop: '-10px' }}>
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

          <div className="form-group">
            <label className="form-label">
              {interestType === 'upfront_percentage' || interestType.includes('emi_')
                ? `Interest / Rate (%) *`
                : `${dict.loans.deduction} Amount (${currencySymbol}) *`}
            </label>
            <input
              type="number"
              name="deduction"
              className="form-control"
              placeholder={interestType.includes('percentage') || interestType.includes('emi_') ? 'e.g. 10 (for 10%)' : dict.creditInsights.placeholders.deduction}
              value={interestRate}
              onChange={e => setInterestRate(e.target.value ? Number(e.target.value) : '')}
              required
              style={{ fontSize: '1.1rem', padding: '12px' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{dict.loans.netDisbursed}</label>
              <div className="form-computed" style={{ color: 'var(--primary-dark)' }}>{currencySymbol}{calculatedData.disbursedAmount.toLocaleString()}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Total Payable</label>
              <div className="form-computed">{currencySymbol}{calculatedData.totalPayable.toLocaleString()}</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{dict.loans.frequency} *</label>
              <select name="frequency" className="form-control" value={frequency} onChange={e => { setFrequency(e.target.value); setDueDay(''); }} required style={{ fontSize: '1rem', padding: '12px' }}>
                <option value="daily">{dict.creditInsights.daily}</option>
                <option value="weekly">{dict.creditInsights.weekly}</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="monthly">{dict.creditInsights.monthly}</option>
              </select>
            </div>
            {(frequency === 'weekly' || frequency === 'biweekly') && (
              <div className="form-group">
                <label className="form-label">Due Day *</label>
                <select name="dueDay" className="form-control" value={dueDay} onChange={e => setDueDay(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1rem', padding: '12px' }}>
                  <option value="">Select Day</option>
                  {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              </div>
            )}
            {frequency === 'monthly' && (
              <div className="form-group">
                <label className="form-label">Due Date (Day of Month) *</label>
                <select name="dueDay" className="form-control" value={dueDay} onChange={e => setDueDay(e.target.value ? Number(e.target.value) : '')} required style={{ fontSize: '1rem', padding: '12px' }}>
                  <option value="">Select Date</option>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}
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
              <div className="form-computed">{endDate ? formatDateISO(endDate) : '—'}</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{dict.loans.perInstalment}</label>
              <div className="form-computed" style={{ fontWeight: 'bold' }}>{currencySymbol}{calculatedData.perInstalment.toLocaleString()}</div>
            </div>
            <div className="form-group">
              <label className="form-label">{dict.loans.penaltyMissed} ({currencySymbol})</label>
              <input type="number" name="penaltyRate" className="form-control" value={penalty} onChange={e => setPenalty(Number(e.target.value))} style={{ fontSize: '1rem', padding: '12px' }} />
            </div>
          </div>

          <div style={{ marginTop: '32px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem', color: 'var(--primary-dark)' }}>
              <span className="material-icons-outlined">security</span> 🏦 {dict.loans.securityCheques || 'Collateral & Cheques'}
            </h4>
          </div>

          <div style={{ marginTop: '24px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '.9rem', fontWeight: 600 }}>🏦 {dict.loans.securityCheques || 'Security Cheques'}</h4>
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
          
          <div style={{ marginTop: '32px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem', color: 'var(--primary-dark)' }}>
              <span className="material-icons-outlined">verified_user</span> 🛡️ Guarantor Details
            </h4>
          </div>

          {selectedCustomer?.guarantors?.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontSize: '.75rem', opacity: .7 }}>Existing Guarantors for this customer:</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selectedCustomer.guarantors.map((g: any) => (
                  <button 
                    key={g.id} 
                    type="button" 
                    className="btn btn-ghost btn-sm" 
                    onClick={() => pickExistingGuarantor(g)}
                    style={{ padding: '4px 12px', fontSize: '.8rem', border: '1px solid var(--border)', borderRadius: '20px' }}
                  >
                    👤 {g.name}
                  </button>
                ))}
                <button 
                  type="button" 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => pickExistingGuarantor({})}
                  style={{ padding: '4px 12px', fontSize: '.8rem', border: '1px dashed var(--border)', borderRadius: '20px' }}
                >
                  ➕ New Guarantor
                </button>
              </div>
            </div>
          )}

          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px', background: 'var(--bg)' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{dict.loans.guarantorName} *</label>
                <input type="text" name="guarantorName" className="form-control" placeholder={dict.loans.guarantorName} value={guarantorName} onChange={e => setGuarantorName(e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">{dict.loans.guarantorPhone} *</label>
                <input type="tel" name="guarantorPhone" className="form-control" placeholder={dict.loans.guarantorPhone} value={guarantorPhone} onChange={e => setGuarantorPhone(e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Aadhar Number</label>
                <input type="text" name="guarantorAadhar" className="form-control" placeholder="12-digit Aadhar" value={guarantorAadhar} onChange={e => setGuarantorAadhar(e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Relation</label>
                <select name="guarantorRelation" className="form-control" value={guarantorRelation} onChange={e => setGuarantorRelation(e.target.value)} style={{ fontSize: '1rem', padding: '10px' }}>
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
              <textarea name="guarantorAddress" className="form-control" rows={2} placeholder="Complete address" value={guarantorAddress} onChange={e => setGuarantorAddress(e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
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
                    Choose Photo
                    <input type="file" name="guarantorPhoto" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleGuarantorPhotoChange} />
                  </label>
                  <p style={{ fontSize: '.75rem', color: 'var(--text-secondary)', margin: 0 }}>Upload a clear passport size photo.</p>
                </div>
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
        <div className="card-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>📊 {dict.creditInsights.title}</h3>
          </div>
          {selectedCustomer && (
            <div style={{ display: 'flex', background: 'var(--bg-alt)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setInsightsTab('internal')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  border: 'none',
                  background: insightsTab === 'internal' ? 'var(--primary)' : 'transparent',
                  color: insightsTab === 'internal' ? '#fff' : 'var(--text-secondary)',
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '.82rem'
                }}
              >
                Internal History
              </button>
              <button
                type="button"
                onClick={() => setInsightsTab('bureau')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  border: 'none',
                  background: insightsTab === 'bureau' ? 'var(--primary)' : 'transparent',
                  color: insightsTab === 'bureau' ? '#fff' : 'var(--text-secondary)',
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '.82rem'
                }}
              >
                Bureau Connect
              </button>
            </div>
          )}
        </div>
        
        {!selectedCustomer ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--border)' }}>person_search</span>
            <p style={{ marginTop: '12px', fontSize: '.85rem' }}>{dict.creditInsights.history}</p>
          </div>
        ) : insightsTab === 'internal' ? (
          loadingHistory ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '12px', fontSize: '.85rem' }}>Analyzing...</p>
            </div>
          ) : history ? (
            <div style={{ padding: '4px' }}>
              <div style={{ 
                background: 'var(--bg-alt)', 
                color: 'var(--text)', padding: '24px 10px', borderRadius: 'var(--radius-md)', marginBottom: '20px',
                textAlign: 'center', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '1.2px', opacity: .6, marginBottom: '12px', fontWeight: 700 }}>{dict.creditInsights.score}</div>
                <CreditScoreGauge score={history.profile.score} grade={history.profile.grade} />
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
                      <span className={`badge ${l.status === 'closed' ? 'badge-closed' : l.status === 'overdue' ? 'badge-overdue' : 'badge-pending'}`} style={{ fontSize: '.7rem', padding: '2px 6px', borderRadius: '4px' }}>
                        {l.status}
                      </span>
                    </div>
                  </div>
                )) : (
                  <p style={{ fontSize: '.8rem', color: 'var(--text-light)', textAlign: 'center' }}>{dict.creditInsights.noHistory}</p>
                )}
              </div>
            </div>
          ) : null
        ) : (
          /* Bureau Connect Panel */
          <div style={{ padding: '12px 4px' }}>
            {loadingBureau ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
                <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>{bureauStatusText}</p>
              </div>
            ) : bureauReport ? (
              <BureauReportCard report={bureauReport} />
            ) : (
              <div style={{ padding: '10px 4px' }}>
                <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  No active credit bureau report found for this customer. Trigger a new query below.
                </p>
                {bureauError && (
                  <div style={{ color: 'var(--danger)', background: 'rgba(231, 76, 60, 0.05)', border: '1px solid var(--danger)', padding: '10px', borderRadius: '4px', fontSize: '.8rem', marginBottom: '16px' }}>
                    ⚠️ {bureauError}
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'start', gap: '8px', cursor: 'pointer', fontSize: '.82rem', lineHeight: 1.4 }}>
                    <input 
                      type="checkbox" 
                      checked={consentObtained} 
                      onChange={(e) => setConsentObtained(e.target.checked)} 
                      style={{ marginTop: '3px' }}
                    />
                    <span>I confirm that the borrower has provided verbal/written consent for a credit bureau query as per RBI guidelines.</span>
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  disabled={!consentObtained}
                  onClick={triggerBureauPull}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>search</span> Pull Bureau Report
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title={dict.customers.registerTitle}>
        {routes && agents ? (
          <CustomerForm routes={routes} agents={agents} onSuccess={handleCustomerCreated} dict={dict} viewerRole={viewerRole} />
        ) : (
          <p>Loading form...</p>
        )}
      </Modal>
    </div>
  );
}
