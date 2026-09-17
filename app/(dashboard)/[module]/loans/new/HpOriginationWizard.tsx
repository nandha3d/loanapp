'use client';

/**
 * Auto Finance: the 4-step Hire-Purchase ledger create wizard.
 *
 * Deliberately a separate component from the generic `LoanForm` — HP
 * origination captures the vehicle, the sourcing partners, the charge stack
 * and up to three guarantors in one pass, which does not fit the shared
 * single-page form used by the other five modules.
 */

import { compressFormDataImages } from '@/lib/imageCompression';
import { useMemo, useState } from 'react';
import { createHpLoan } from '../actions';
import { calculateHpQuote, calculateHpDisbursement, validatePayoutSplit } from '@/lib/autofinance/hp';
import Modal from '@/components/Modal';
import CustomerForm from '../../customers/new/CustomerForm';
import Link from '@/components/layout/DashboardLink';

type Partner = { id: string; name: string; type: string; commissionRate: string | null };

type AadhaarCheck = {
  found: boolean;
  hasDefaults: boolean;
  activeLoanCount: number;
  asGuarantorCount: number;
  asCustomerCount: number;
  linkedLoans: Array<{
    loanCode: string;
    status: string;
    npaStatus: string | null;
    daysOverdue: number;
    outstanding: number;
    customerName: string;
  }>;
};

const STEPS = [
  { n: 1, label: 'Basic & Vehicle', icon: 'directions_car' },
  { n: 2, label: 'Financials', icon: 'calculate' },
  { n: 3, label: 'Charges & Payout', icon: 'receipt_long' },
  { n: 4, label: 'Guarantors', icon: 'groups' },
];

const PAYMENT_MODES = ['cash', 'bank_transfer', 'upi', 'cheque', 'dd'];

export default function HpOriginationWizard({
  customers,
  brokers,
  dealers,
  currencySymbol,
  defaultPenalty,
  preSelectedCustomerId,
  routes = [],
  agents = [],
  dict,
  viewerRole,
}: {
  customers: any[];
  brokers: Partner[];
  dealers: Partner[];
  currencySymbol: string;
  defaultPenalty: number;
  preSelectedCustomerId?: string;
  routes?: any[];
  agents?: any[];
  dict: any;
  viewerRole?: string;
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Step 1
  const [customerId, setCustomerId] = useState(preSelectedCustomerId || '');
  const [registrationNo, setRegistrationNo] = useState('');
  const [vehicleType, setVehicleType] = useState('two_wheeler');

  // Step 2
  const [vehicleValue, setVehicleValue] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [interestMethod, setInterestMethod] = useState<'flat' | 'diminishing'>('flat');
  const [tenureMonths, setTenureMonths] = useState('');
  const [roundOffEmi, setRoundOffEmi] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [firstDueDate, setFirstDueDate] = useState('');

  // Step 3
  const [handLoanAmount, setHandLoanAmount] = useState('');
  const [insuranceCharge, setInsuranceCharge] = useState('');
  const [documentCharge, setDocumentCharge] = useState('');
  const [brokerCommission, setBrokerCommission] = useState('');
  const [brokerId, setBrokerId] = useState('');
  const [payoutAmount1, setPayoutAmount1] = useState('');
  const [payoutAmount2, setPayoutAmount2] = useState('');

  // Step 4
  const [aadhaarChecks, setAadhaarChecks] = useState<Record<number, AadhaarCheck | null>>({});
  const [checking, setChecking] = useState<number | null>(null);

  const selectedCustomer = localCustomers.find((c) => c.id === customerId) || null;

  // ── Live quote ───────────────────────────────────────────────────────────
  const quote = useMemo(() => {
    const value = Number(vehicleValue);
    const down = Number(downPayment) || 0;
    const rate = Number(interestRate);
    const months = Number(tenureMonths);
    if (!value || !months || Number.isNaN(rate)) return null;
    try {
      return calculateHpQuote({
        vehicleValue: value,
        downPayment: down,
        additionalFinancedAmount: Number(handLoanAmount) || 0,
        interestRate: rate,
        interestMethod,
        tenureMonths: months,
        roundOffEmi,
      });
    } catch {
      return null;
    }
  }, [vehicleValue, downPayment, handLoanAmount, interestRate, interestMethod, tenureMonths, roundOffEmi]);

  const disbursement = useMemo(() => {
    if (!quote) return null;
    return calculateHpDisbursement({
      principal: quote.principal,
      insuranceCharge: Number(insuranceCharge) || 0,
      documentCharge: Number(documentCharge) || 0,
      brokerCommission: Number(brokerCommission) || 0,
    });
  }, [quote, insuranceCharge, documentCharge, brokerCommission]);

  const splitCheck = useMemo(() => {
    if (!disbursement) return { valid: true };
    return validatePayoutSplit(disbursement.netPayout, Number(payoutAmount1), Number(payoutAmount2));
  }, [disbursement, payoutAmount1, payoutAmount2]);

  const money = (n: number) => `${currencySymbol}${Math.round(n).toLocaleString('en-IN')}`;

  // ── Step gating ──────────────────────────────────────────────────────────
  const stepErrors = useMemo(() => {
    const errors: Record<number, string | null> = { 1: null, 2: null, 3: null, 4: null };
    if (!customerId) errors[1] = 'Select a customer.';
    else if (!registrationNo.trim()) errors[1] = 'Vehicle registration number is required.';
    if (!quote) errors[2] = 'Enter vehicle value, interest rate and tenure to compute the EMI.';
    if (!splitCheck.valid) errors[3] = splitCheck.message ?? 'Payment split does not reconcile.';
    return errors;
  }, [customerId, registrationNo, quote, splitCheck]);

  const canAdvance = (from: number) => !stepErrors[from];

  const goNext = () => {
    if (!canAdvance(step)) return;
    setStep((s) => Math.min(4, s + 1));
  };

  // ── Guarantor Aadhaar auto-check ─────────────────────────────────────────
  async function checkAadhaar(index: number, value: string) {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 12) {
      setAadhaarChecks((prev) => ({ ...prev, [index]: null }));
      return;
    }
    setChecking(index);
    try {
      const res = await fetch('/api/v1/guarantors/check-aadhaar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar: digits }),
      });
      const json = await res.json();
      setAadhaarChecks((prev) => ({ ...prev, [index]: json?.data ?? null }));
    } catch {
      setAadhaarChecks((prev) => ({ ...prev, [index]: null }));
    } finally {
      setChecking(null);
    }
  }

  const labelStyle = { fontSize: '.78rem', fontWeight: 700, color: 'var(--text-secondary)' };

  return (
    <div className="grid-60-40" style={{ alignItems: 'start' }}>
      <div className="card">
        <div className="card-header">
          <h3>🚗 New Hire-Purchase Ledger</h3>
          <span className="badge badge-info">Step {step} of 4</span>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {STEPS.map((s) => {
            const state = s.n === step ? 'active' : s.n < step ? 'done' : 'todo';
            return (
              <button
                key={s.n}
                type="button"
                // Only allow jumping back, or forward through validated steps.
                onClick={() => { if (s.n < step || canAdvance(step)) setStep(s.n); }}
                style={{
                  flex: '1 1 120px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${state === 'active' ? 'var(--primary)' : 'var(--border)'}`,
                  background: state === 'active' ? 'var(--primary)' : state === 'done' ? 'var(--bg)' : 'transparent',
                  color: state === 'active' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '.78rem',
                  fontWeight: 700,
                  textAlign: 'left',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                  {state === 'done' ? 'check_circle' : s.icon}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>

        <form
          action={async (fd: FormData) => {
            setLoading(true);
            setSubmitError(null);
            // The financed amount is derived, not typed — send it explicitly.
            if (quote) fd.set('principal', String(quote.principal));
            // Shrink camera photos before they hit the Server Action body limit.
            await compressFormDataImages(fd);
            const result = await createHpLoan(fd);
            if (result && 'error' in result) {
              setSubmitError(result.error);
              setLoading(false);
            }
          }}
        >
          {submitError && (
            <div style={{ background: 'var(--danger-bg, #fee2e2)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>block</span>
              {submitError}
            </div>
          )}

          {/* ── STEP 1 ─────────────────────────────────────────────────── */}
          <div hidden={step !== 1}>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ margin: 0 }}>Customer *</label>
                <button type="button" onClick={() => setIsCustomerModalOpen(true)} className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', color: 'var(--primary)', fontSize: '.8rem' }}>
                  + New Customer
                </button>
              </div>
              <select name="customerId" className="form-control" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Search customer…</option>
                {localCustomers.map((c) => (
                  <option key={c.id} value={c.id}>{c.customerCode} — {c.name} ({c.route?.name || 'No Route'})</option>
                ))}
              </select>
            </div>

            {selectedCustomer && (
              <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '.8rem' }}>
                <Link href={`/customers/${selectedCustomer.customerCode}`} target="_blank"><strong>{selectedCustomer.name}</strong></Link>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {selectedCustomer.phone} · {selectedCustomer.route?.name || 'No route'} · KYC {selectedCustomer.kycStatus}
                </div>
              </div>
            )}

            <h4 style={{ margin: '24px 0 12px', fontSize: '.95rem' }}>Vehicle Details</h4>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Registration No *</label>
                <input name="registrationNo" className="form-control" required value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value.toUpperCase())}
                  placeholder="TN 01 AB 1234" style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Type *</label>
                <select name="vehicleType" className="form-control" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                  <option value="two_wheeler">Two Wheeler</option>
                  <option value="three_wheeler">Three Wheeler</option>
                  <option value="four_wheeler">Four Wheeler</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Make *</label>
                <input name="make" className="form-control" required placeholder="Hero" />
              </div>
              <div className="form-group">
                <label className="form-label">Model *</label>
                <input name="vehicleModel" className="form-control" required placeholder="Splendor Plus" />
              </div>
              <div className="form-group">
                <label className="form-label">Year</label>
                <input name="year" type="number" className="form-control" placeholder="2024" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Engine No</label>
                <input name="engineNo" className="form-control" />
              </div>
              <div className="form-group">
                <label className="form-label">Chassis No</label>
                <input name="chassisNo" className="form-control" />
              </div>
              <div className="form-group">
                <label className="form-label">Colour</label>
                <input name="color" className="form-control" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Insurance Expiry</label>
                <input name="insuranceExpiry" type="date" className="form-control" />
              </div>
              <div className="form-group">
                <label className="form-label">Geo-code / Map Link</label>
                <input name="geoLink" className="form-control" placeholder="https://maps.google.com/…" />
              </div>
            </div>

            <h4 style={{ margin: '24px 0 12px', fontSize: '.95rem' }}>Documents</h4>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Customer Photo</label>
                <input name="customerPhoto" type="file" accept="image/*" className="form-control" />
              </div>
              <div className="form-group">
                <label className="form-label" style={labelStyle}>RC Book</label>
                <input name="rcDoc" type="file" accept="image/*,application/pdf" className="form-control" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Vehicle Photo</label>
                <input name="vehiclePhoto" type="file" accept="image/*" className="form-control" />
              </div>
              <div className="form-group">
                <label className="form-label" style={labelStyle}>Insurance Document</label>
                <input name="insuranceDoc" type="file" accept="image/*,application/pdf" className="form-control" />
              </div>
            </div>
          </div>

          {/* ── STEP 2 ─────────────────────────────────────────────────── */}
          <div hidden={step !== 2}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Vehicle Value ({currencySymbol}) *</label>
                <input name="vehicleValue" type="number" min="1" step="0.01" className="form-control" required
                  value={vehicleValue} onChange={(e) => setVehicleValue(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Down Payment ({currencySymbol})</label>
                <input name="downPayment" type="number" min="0" step="0.01" className="form-control"
                  value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Loan Amount ({currencySymbol})</label>
                <input className="form-control" readOnly disabled
                  value={quote ? quote.principal.toLocaleString('en-IN') : '—'}
                  style={{ background: 'var(--bg)', fontWeight: 700 }} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Interest Rate (% p.a.) *</label>
                <input name="interestRate" type="number" min="0" step="0.01" className="form-control" required
                  value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Interest Method</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['flat', 'diminishing'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setInterestMethod(m)}
                      className={`btn btn-sm ${interestMethod === m ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, textTransform: 'capitalize' }}>
                      {m}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="interestMethod" value={interestMethod} />
              </div>
              <div className="form-group">
                <label className="form-label">Tenure (months) *</label>
                <input name="tenureMonths" type="number" min="1" step="1" className="form-control" required
                  value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Issue Date *</label>
                <input name="startDate" type="date" className="form-control" required
                  value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">First Due Date</label>
                <input name="firstDueDate" type="date" className="form-control"
                  value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
                <small style={{ color: 'var(--text-light)' }}>Sets the monthly due day.</small>
              </div>
              <div className="form-group">
                <label className="form-label">Due Day</label>
                <input name="dueDay" type="number" min="1" max="31" className="form-control"
                  value={firstDueDate ? new Date(firstDueDate).getDate() : ''} readOnly
                  style={{ background: 'var(--bg)' }} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 20px', cursor: 'pointer' }}>
              <input type="checkbox" name="roundOffEmi" checked={roundOffEmi} onChange={(e) => setRoundOffEmi(e.target.checked)} />
              <span style={{ fontWeight: 600 }}>Round off EMI amount</span>
            </label>

            {quote && (
              <div className="card" style={{ background: 'var(--bg)', padding: '16px' }}>
                <div className="kpi-grid">
                  <div><div style={labelStyle}>Principal</div><div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{money(quote.principal)}</div></div>
                  <div><div style={labelStyle}>Total Interest</div><div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{money(quote.totalInterest)}</div></div>
                  <div><div style={labelStyle}>Total Payable</div><div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{money(quote.totalPayable)}</div></div>
                  <div><div style={labelStyle}>Monthly EMI</div><div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary)' }}>{money(quote.emi)}</div></div>
                </div>
              </div>
            )}
          </div>

          {/* ── STEP 3 ─────────────────────────────────────────────────── */}
          <div hidden={step !== 3}>
            <h4 style={{ margin: '0 0 12px', fontSize: '.95rem' }}>Penalty</h4>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Grace Period (days)</label>
                <input name="gracePeriodDays" type="number" min="0" className="form-control" defaultValue={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Penalty per Day ({currencySymbol})</label>
                <input name="penaltyPerDay" type="number" min="0" step="0.01" className="form-control" defaultValue={defaultPenalty} />
              </div>
            </div>

            <h4 style={{ margin: '24px 0 12px', fontSize: '.95rem' }}>Charges & Sourcing</h4>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Hand Loan / Extra ({currencySymbol})</label>
                <input name="handLoanAmount" type="number" min="0" step="0.01" className="form-control"
                  value={handLoanAmount} onChange={(e) => setHandLoanAmount(e.target.value)} />
                <small style={{ color: 'var(--text-light)' }}>Insurance / RTO advanced to the customer.</small>
              </div>
              <div className="form-group">
                <label className="form-label">Insurance Charge ({currencySymbol})</label>
                <input name="insuranceCharge" type="number" min="0" step="0.01" className="form-control"
                  value={insuranceCharge} onChange={(e) => setInsuranceCharge(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Document Charge ({currencySymbol})</label>
                <input name="documentCharge" type="number" min="0" step="0.01" className="form-control"
                  value={documentCharge} onChange={(e) => setDocumentCharge(e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Broker</label>
                <select name="brokerId" className="form-control" value={brokerId}
                  onChange={(e) => {
                    setBrokerId(e.target.value);
                    // Prefill the commission from the partner's default rate.
                    const partner = brokers.find((b) => b.id === e.target.value);
                    if (partner?.commissionRate && quote) {
                      setBrokerCommission(String(Math.round(quote.principal * Number(partner.commissionRate) / 100)));
                    }
                  }}>
                  <option value="">— None —</option>
                  {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dealer</label>
                <select name="dealerId" className="form-control" defaultValue="">
                  <option value="">— None —</option>
                  {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Broker Commission ({currencySymbol})</label>
                <input name="brokerCommission" type="number" min="0" step="0.01" className="form-control"
                  value={brokerCommission} onChange={(e) => setBrokerCommission(e.target.value)} />
              </div>
            </div>

            {(brokers.length === 0 && dealers.length === 0) && (
              <p style={{ fontSize: '.78rem', color: 'var(--text-light)' }}>
                No brokers or dealers on file yet — add them under{' '}
                <Link href="/finance-partners" style={{ color: 'var(--primary)' }}>Masters → Brokers &amp; Dealers</Link>.
              </p>
            )}

            <h4 style={{ margin: '24px 0 12px', fontSize: '.95rem' }}>Payment Splitter</h4>
            {disbursement && (
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '.82rem' }}>
                <span>Gross payout <strong>{money(disbursement.grossPayout)}</strong></span>
                <span>Charges recovered <strong>−{money(disbursement.recoveredCharges)}</strong></span>
                <span style={{ color: 'var(--primary)' }}>Net to hand over <strong>{money(disbursement.netPayout)}</strong></span>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Mode 1</label>
                <select name="payoutMode1" className="form-control" defaultValue="cash">
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount 1 ({currencySymbol})</label>
                <input name="payoutAmount1" type="number" min="0" step="0.01" className="form-control"
                  value={payoutAmount1} onChange={(e) => setPayoutAmount1(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Mode 2</label>
                <select name="payoutMode2" className="form-control" defaultValue="">
                  <option value="">—</option>
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount 2 ({currencySymbol})</label>
                <input name="payoutAmount2" type="number" min="0" step="0.01" className="form-control"
                  value={payoutAmount2} onChange={(e) => setPayoutAmount2(e.target.value)} />
              </div>
            </div>
            {!splitCheck.valid && (
              <div style={{ color: 'var(--danger)', fontSize: '.8rem', fontWeight: 600 }}>{splitCheck.message}</div>
            )}

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Voucher Reference</label>
              <input name="voucherRef" className="form-control" />
            </div>
          </div>

          {/* ── STEP 4 ─────────────────────────────────────────────────── */}
          <div hidden={step !== 4}>
            <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Enter a 12-digit Aadhaar to instantly check for existing loans or defaults linked to that person.
            </p>
            {[1, 2, 3].map((i) => {
              const check = aadhaarChecks[i];
              return (
                <div key={i} className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '.9rem' }}>
                    Guarantor {i} {i === 1 && <span style={{ color: 'var(--danger)' }}>*</span>}
                  </h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Name {i === 1 && '*'}</label>
                      <input name={`guarantor${i}Name`} className="form-control" required={i === 1} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone {i === 1 && '*'}</label>
                      <input name={`guarantor${i}Phone`} className="form-control" required={i === 1} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Relation</label>
                      <input name={`guarantor${i}Relation`} className="form-control" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        Aadhaar {checking === i && <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>· checking…</span>}
                      </label>
                      <input name={`guarantor${i}Aadhaar`} className="form-control" inputMode="numeric" maxLength={14}
                        onBlur={(e) => checkAadhaar(i, e.target.value)} placeholder="1234 5678 9012" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Address</label>
                      <input name={`guarantor${i}Address`} className="form-control" />
                    </div>
                  </div>

                  {check && check.found && (
                    <div style={{
                      marginTop: '8px', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: '.8rem',
                      background: check.hasDefaults ? 'var(--danger-bg, #fee2e2)' : 'var(--bg)',
                      color: check.hasDefaults ? 'var(--danger)' : 'var(--text-secondary)',
                      border: `1px solid ${check.hasDefaults ? 'var(--danger)' : 'var(--border)'}`,
                    }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                          {check.hasDefaults ? 'warning' : 'info'}
                        </span>
                        {check.hasDefaults
                          ? 'This Aadhaar has overdue or NPA-classified loans.'
                          : 'This Aadhaar is already on file.'}
                      </strong>
                      <div style={{ marginTop: '6px' }}>
                        Known as customer ×{check.asCustomerCount}, guarantor ×{check.asGuarantorCount} ·{' '}
                        {check.activeLoanCount} active loan(s).
                      </div>
                      {check.linkedLoans.length > 0 && (
                        <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
                          {check.linkedLoans.slice(0, 5).map((l) => (
                            <li key={l.loanCode}>
                              {l.loanCode} — {l.customerName} · {l.status}
                              {l.daysOverdue > 0 && ` · ${l.daysOverdue}d overdue`}
                              {' · '}{money(l.outstanding)} outstanding
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {check && !check.found && (
                    <div style={{ marginTop: '8px', fontSize: '.78rem', color: 'var(--success, #16a34a)' }}>
                      ✓ No existing record for this Aadhaar.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Navigation ─────────────────────────────────────────────── */}
          {stepErrors[step] && (
            <div style={{ color: 'var(--danger)', fontSize: '.8rem', fontWeight: 600, marginBottom: '12px' }}>
              {stepErrors[step]}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <button type="button" className="btn btn-secondary" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
              Back
            </button>
            {step < 4 ? (
              <button type="button" className="btn btn-primary" onClick={goNext} disabled={!canAdvance(step)}>
                Continue
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={loading || !quote}>
                {loading ? 'Creating…' : 'Create HP Ledger'}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Live summary rail ───────────────────────────────────────────── */}
      <div className="card" style={{ position: 'sticky', top: '16px' }}>
        <div className="card-header"><h3>Summary</h3></div>
        {!quote ? (
          <p style={{ color: 'var(--text-light)', fontSize: '.85rem' }}>
            Fill in the vehicle value, rate and tenure to see the quote.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '10px', fontSize: '.85rem' }}>
            <Row label="Vehicle" value={registrationNo || '—'} />
            <Row label="Vehicle Value" value={money(Number(vehicleValue))} />
            <Row label="Down Payment" value={money(Number(downPayment) || 0)} />
            <Row label="Financed" value={money(quote.principal)} strong />
            <Row label={`Interest (${interestMethod})`} value={money(quote.totalInterest)} />
            <Row label="Total Payable" value={money(quote.totalPayable)} />
            <Row label={`EMI × ${tenureMonths}`} value={money(quote.emi)} strong />
            {disbursement && <Row label="Net Payout" value={money(disbursement.netPayout)} />}
          </div>
        )}
      </div>

      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title="New Customer">
        <CustomerForm
          appType="autofinance"
          routes={routes}
          agents={agents}
          dict={dict}
          viewerRole={viewerRole}
          onSuccess={(created: any) => {
            if (created?.id) {
              setLocalCustomers((prev) => [created, ...prev]);
              setCustomerId(created.id);
            }
            setIsCustomerModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 600 }}>{value}</span>
    </div>
  );
}
