'use client';

import { useState } from 'react';
import Link from '@/components/layout/DashboardLink';
import { formatCurrency, formatDate, getBadgeClass, getInitials, calcPercentage } from '@/lib/utils';
import { submitEditRequest } from '@/app/(dashboard)/[module]/approvals/actions';
import { resetCustomerPassword } from '@/app/(dashboard)/[module]/customers/actions';
import { calculateCreditScore } from '@/lib/creditScore';
import { getCreditScoreGaugePresentation } from '@/lib/creditScoreGauge';

const CreditScoreGauge = ({ score, grade }: { score: number, grade: string }) => {
  const gauge = getCreditScoreGaugePresentation(score, grade);

  return (
    <div style={{ textAlign: 'center', width: '140px' }}>
      <div style={{ position: 'relative', height: '70px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
        <svg viewBox="0 0 100 55" role="img" aria-label={gauge.ariaLabel} style={{ width: '120px' }}>
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#F1F5F9" strokeWidth="10" strokeLinecap="round" />
          <path d="M 10 50 A 40 40 0 0 1 30 15.3" fill="none" stroke="#EF4444" strokeWidth="10" />
          <path d="M 30 15.3 A 40 40 0 0 1 50 10" fill="none" stroke="#F59E0B" strokeWidth="10" />
          <path d="M 50 10 A 40 40 0 0 1 70 15.3" fill="none" stroke="#EAB308" strokeWidth="10" />
          <path d="M 70 15.3 A 40 40 0 0 1 90 50" fill="none" stroke="#16A34A" strokeWidth="10" />
          <g style={{ transform: `rotate(${gauge.rotation}deg)`, transformOrigin: '50px 50px', transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <circle cx="50" cy="10" r="5" fill="#FFF" stroke={gauge.color} strokeWidth="2" />
          </g>
        </svg>
        <div style={{ position: 'absolute', bottom: '2px', fontSize: '1.8rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px' }}>{score}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.55rem', color: 'var(--text-light)', marginTop: '-8px', padding: '0 8px', fontWeight: 700, width: '120px', margin: '0 auto' }}>
        <span>300</span>
        <span>850</span>
      </div>
      <div style={{ fontSize: '.75rem', fontWeight: 800, color: gauge.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{grade}</div>
    </div>
  );
};

import { useRouter } from 'next/navigation';

export default function CustomerProfileClient({
  customer,
  currencySymbol,
  userRole,
  dict,
  kycEnabled = false,
  tenantKycMethod = 'manual_upload',
}: {
  customer: any;
  currencySymbol: string;
  userRole: string;
  dict: any;
  kycEnabled?: boolean;
  tenantKycMethod?: string;
}) {
  const router = useRouter();
  const d = dict.customerProfile;
  const [activeTab, setActiveTab] = useState('loans');
  const [editRequestModal, setEditRequestModal] = useState(false);
  const [editRequestLoading, setEditRequestLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [kycLoading, setKycLoading] = useState(false);
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [aadhaarSessionId, setAadhaarSessionId] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [videoKycSession, setVideoKycSession] = useState<{ sessionId: string, sessionUrl: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const handleSendAadhaarOtp = async () => {
    if (!aadhaarInput || aadhaarInput.length !== 12 || !/^\d+$/.test(aadhaarInput)) {
      alert('Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    setKycLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/kyc/aadhaar-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initiate',
          customerId: customer.id,
          aadhaarNumber: aadhaarInput,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAadhaarSessionId(data.data.sessionId);
        setOtpSent(true);
      } else {
        alert(data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      alert('An error occurred. Please try again.');
    } finally {
      setKycLoading(false);
    }
  };

  const handleVerifyAadhaarOtp = async () => {
    if (!otpValue || otpValue.length < 4) {
      setOtpError('Please enter a valid OTP.');
      return;
    }
    setKycLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/kyc/aadhaar-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          sessionId: aadhaarSessionId,
          otp: otpValue,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(d.otpVerified || 'Aadhaar verified successfully!');
        setOtpSent(false);
        setOtpValue('');
        setAadhaarSessionId(null);
        router.refresh();
      } else {
        setOtpError(data.error || d.invalidOtp || 'Verification failed. Invalid OTP.');
      }
    } catch (err) {
      setOtpError('An error occurred during verification.');
    } finally {
      setKycLoading(false);
    }
  };

  const handleInitiateVideoKyc = async () => {
    setKycLoading(true);
    try {
      const res = await fetch('/api/kyc/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          customerId: customer.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVideoKycSession({
          sessionId: data.data.sessionId,
          sessionUrl: data.data.sessionUrl,
        });
        router.refresh();
      } else {
        alert(data.error || 'Failed to initiate Video KYC.');
      }
    } catch (err) {
      alert('An error occurred. Please try again.');
    } finally {
      setKycLoading(false);
    }
  };

  const handleReviewVideoKyc = async (sessionId: string, decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !reviewNotes) {
      alert('Please provide a reason/notes for rejecting the KYC.');
      return;
    }
    setKycLoading(true);
    try {
      const res = await fetch('/api/kyc/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          sessionId,
          decision,
          notes: reviewNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Video KYC session successfully ${decision}.`);
        setReviewNotes('');
        router.refresh();
      } else {
        alert(data.error || 'Failed to submit review.');
      }
    } catch (err) {
      alert('An error occurred. Please try again.');
    } finally {
      setKycLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!window.confirm('Are you sure you want to reset the borrower portal password for this customer? They will be forced to verify via OTP and set a new password on their next login attempt.')) {
      return;
    }
    setResetLoading(true);
    try {
      const res = await resetCustomerPassword(customer.id);
      if (res.success) {
        alert('Borrower portal password reset successfully.');
      } else {
        alert(res.error || 'Failed to reset password.');
      }
    } catch (err) {
      alert('An error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const { score, grade, stats } = calculateCreditScore(customer.loans);

  return (
    <>
      {/* Profile Header */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="profile-header">
          <div className="profile-avatar" style={{ width: '140px', height: '140px', borderRadius: '16px', overflow: 'hidden', border: '3px solid var(--border)', flexShrink: 0 }}>
            {customer.profilePhoto ? (
              <img 
                src={customer.profilePhoto} 
                alt={customer.name} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-alt)', fontSize: '2.5rem', fontWeight: 800 }}>
                {getInitials(customer.name)}
              </div>
            )}
          </div>
          <div className="profile-info">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900 }}>{customer.name}</h1>
              <div style={{ fontSize: '1rem', color: 'var(--text-light)', fontWeight: 600 }}>[{customer.customerCode}]</div>
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '6px', 
                background: score >= 750 ? '#DCFCE7' : score >= 650 ? '#FEF3C7' : '#FEE2E2',
                color: score >= 750 ? '#166534' : score >= 650 ? '#92400E' : '#991B1B',
                padding: '4px 12px', borderRadius: '20px', fontSize: '.85rem', fontWeight: 700,
                border: '1px solid rgba(0,0,0,0.05)'
              }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>stars</span>
                {grade}
              </div>
            </div>
            <div className="profile-meta" style={{ display: 'flex', gap: '20px', fontSize: '.9rem', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-icons-outlined" style={{ fontSize: '16px' }}>phone</span> {customer.phone}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-icons-outlined" style={{ fontSize: '16px' }}>location_on</span> {customer.route?.name || d.noRoute}</span>
              <span><span className={getBadgeClass(customer.kycStatus)} style={{textTransform:'capitalize', padding: '2px 10px', borderRadius: '4px'}}>{customer.kycStatus}</span></span>
            </div>
            <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>{customer.address}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {userRole !== 'agent' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetPassword}
                disabled={resetLoading}
                style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: 'rgb(239, 68, 68)', background: 'transparent' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>lock_reset</span>
                {resetLoading ? 'Resetting...' : 'Reset Portal PW'}
              </button>
            )}
            {userRole !== 'agent' && (
              <Link href={`/customers/new?edit=${customer.id}`} className="btn btn-secondary btn-sm">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span> {d.edit}
              </Link>
            )}
            {userRole === 'agent' && (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditRequestModal(true)}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit_note</span> {d.requestEdit}
              </button>
            )}
            <a
              href={`/api/customers/${customer.id}/collection-receipt`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>receipt_long</span>
              {d.collectionReceipt || 'Collection Receipt'}
            </a>
            {userRole !== 'agent' && (
              <Link href={`/loans/new?customerId=${customer.id}`} className="btn btn-primary btn-sm">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span> {d.newLoan}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Credit Summary Bar */}
      <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
          <CreditScoreGauge score={score} grade={grade} />
        </div>
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-dark)' }}>{formatCurrency(stats.totalBorrowed, currencySymbol)}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{d.totalBorrowed}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{stats.punctuality}%</div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{d.repaymentConsistency}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.activeLoans} / {stats.closedLoans}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{d.activeClosedLoans}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'loans' ? 'active' : ''}`} onClick={() => setActiveTab('loans')}>{d.loanHistory}</div>
          <div className={`tab ${activeTab === 'kyc' ? 'active' : ''}`} onClick={() => setActiveTab('kyc')}>{d.kycDocuments}</div>
          <div className={`tab ${activeTab === 'cheques' ? 'active' : ''}`} onClick={() => setActiveTab('cheques')}>{d.securityCheques}</div>
          <div className={`tab ${activeTab === 'guarantors' ? 'active' : ''}`} onClick={() => setActiveTab('guarantors')}>{d.guarantors}</div>
        </div>

        {/* Loans Tab */}
        <div className={`tab-content ${activeTab === 'loans' ? 'active' : ''}`}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{d.loanId}</th>
                  <th>{d.principal}</th>
                  <th>{d.frequency}</th>
                  <th>{d.startDate}</th>
                  <th>{d.progress}</th>
                  <th>{d.status}</th>
                  <th>{d.action}</th>
                </tr>
              </thead>
              <tbody>
                {customer.loans.map((l: any) => {
                  const total = l.tenure;
                  const paid = l.instalments.filter((i: any) => i.status === 'paid').length;
                  const pct = Math.round((paid / total) * 100);
                  
                  return (
                    <tr key={l.id}>
                      <td><Link href={`/loans/${l.loanCode}`}><strong>{l.loanCode}</strong></Link></td>
                      <td>{formatCurrency(Number(l.principal), currencySymbol)}</td>
                      <td style={{textTransform:'capitalize'}}>{l.frequency}</td>
                      <td>{formatDate(l.startDate)}</td>
                      <td>
                        <div className="progress" style={{ width: '100px' }}>
                          <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="progress-text">{pct}% ({paid}/{total})</span>
                      </td>
                      <td><span className={getBadgeClass(l.status)} style={{textTransform:'capitalize'}}>{l.status}</span></td>
                      <td>
                        <Link href={`/loans/${l.loanCode}`} className="btn btn-ghost btn-sm">{d.view}</Link>
                      </td>
                    </tr>
                  );
                })}
                {customer.loans.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-light)' }}>
                      {d.noLoans}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* KYC Tab */}
        <div className={`tab-content ${activeTab === 'kyc' ? 'active' : ''}`}>
          {!kycEnabled ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ 
                background: 'rgba(234, 179, 8, 0.05)', 
                borderLeft: '4px solid var(--warning)', 
                padding: '20px', 
                borderRadius: '8px',
                display: 'flex',
                gap: '16px',
                alignItems: 'start'
              }}>
                <span className="material-icons-outlined" style={{ color: 'var(--warning)', fontSize: '32px' }}>workspace_premium</span>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700 }}>{dict.sidebar?.subscription || 'Premium Add-on'}</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {d.kycAddonNeeded}
                  </p>
                </div>
              </div>

              {/* Standard manual details as fallback */}
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <h4 style={{ marginBottom: '12px' }}>{d.aadharCard}</h4>
                  <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '40px', textAlign: 'center', border: '1px solid var(--border)' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>credit_card</span>
                    <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                      Aadhar: <strong>{customer.aadharNumber || d.notProvided}</strong>
                    </p>
                    <p style={{ fontSize: '.75rem', color: 'var(--text-light)', marginTop: '4px' }}>{d.documentUploaded}</p>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <h4 style={{ marginBottom: '12px' }}>{d.verificationStatus}</h4>
                  <div className="card" style={{ background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <span className="material-icons-outlined" style={{ color: customer.kycStatus === 'verified' ? 'var(--success)' : 'var(--warning)', fontSize: '28px' }}>
                        {customer.kycStatus === 'verified' ? 'verified' : 'pending_actions'}
                      </span>
                      <div>
                        <strong style={{textTransform:'capitalize'}}>{customer.kycStatus}</strong>
                        <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{d.statusChangedByAdmin}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {/* Left Side: Aadhar & Basic Status */}
              <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h4 style={{ marginBottom: '12px' }}>{d.aadharCard}</h4>
                  <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '30px', textAlign: 'center', border: '1px solid var(--border)' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>credit_card</span>
                    <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                      Aadhar: <strong>{customer.aadharNumber || d.notProvided}</strong>
                    </p>
                    <p style={{ fontSize: '.75rem', color: 'var(--text-light)', marginTop: '4px' }}>{d.documentUploaded}</p>
                  </div>
                </div>

                <div>
                  <h4 style={{ marginBottom: '12px' }}>{d.verificationStatus}</h4>
                  <div className="card" style={{ background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <span className="material-icons-outlined" style={{ 
                        color: customer.kycStatus === 'verified' ? 'var(--success)' : customer.kycStatus === 'rejected' ? 'var(--danger)' : 'var(--warning)', 
                        fontSize: '32px' 
                      }}>
                        {customer.kycStatus === 'verified' ? 'verified' : customer.kycStatus === 'rejected' ? 'cancel' : 'pending_actions'}
                      </span>
                      <div>
                        <div style={{ fontSize: '.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>Current Status</div>
                        <strong style={{textTransform:'capitalize', fontSize: '1.1rem'}}>{customer.kycStatus}</strong>
                        {customer.kycRejectedReason && (
                          <p style={{ fontSize: '.8rem', color: 'var(--danger)', marginTop: '4px' }}>
                            <strong>Reason:</strong> {customer.kycRejectedReason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', fontSize: '.8rem', color: 'var(--text-secondary)' }}>
                      <div>{d.kycMethodLabel}: <strong>{d[`kycMethod_${customer.kycMethod || tenantKycMethod}`] || customer.kycMethod || tenantKycMethod}</strong></div>
                      {customer.kycVerifiedAt && (
                        <div style={{ marginTop: '4px' }}>Verified at: <strong>{formatDate(customer.kycVerifiedAt)}</strong></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Interactive KYC Panel */}
              <div style={{ flex: 1.2, minWidth: '350px' }}>
                <h4 style={{ marginBottom: '12px' }}>Automated KYC Verification</h4>
                
                {tenantKycMethod === 'aadhaar_otp' && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {customer.kycStatus === 'verified' && customer.kycMethod === 'aadhaar_otp' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--success)' }}>
                          <span className="material-icons-outlined" style={{ fontSize: '24px' }}>check_circle</span>
                          <strong style={{ fontSize: '0.95rem' }}>{d.otpVerified}</strong>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-alt)', padding: '16px', borderRadius: '6px', fontSize: '0.85rem' }}>
                          <div style={{ fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '4px' }}>{d.verifiedDetails}</div>
                          <div>
                            <span style={{ color: 'var(--text-light)', display: 'inline-block', width: '100px' }}>{d.aadhaarName}:</span>
                            <strong>{customer.aadhaarName}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-light)', display: 'inline-block', width: '100px' }}>{d.aadhaarDob}:</span>
                            <strong>{customer.aadhaarDob}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-light)', display: 'inline-block', width: '100px' }}>{d.aadhaarAddress}:</span>
                            <strong style={{ fontWeight: 500 }}>{customer.aadhaarAddress}</strong>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                          Verify the customer identity using secure Aadhaar OTP integration via Digio. An OTP will be sent to the customer's Aadhaar-linked mobile number.
                        </p>

                        {!otpSent ? (
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Aadhaar Number (12 Digits)</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <input 
                                type="text" 
                                className="form-control" 
                                placeholder="Enter 12-digit Aadhaar Number" 
                                maxLength={12}
                                value={aadhaarInput}
                                onChange={(e) => setAadhaarInput(e.target.value.replace(/\D/g, ''))}
                                disabled={kycLoading}
                              />
                              <button 
                                type="button" 
                                className="btn btn-primary"
                                onClick={handleSendAadhaarOtp}
                                disabled={kycLoading || aadhaarInput.length !== 12}
                              >
                                {kycLoading ? 'Sending...' : d.sendAadhaarOtp}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="alert alert-info" style={{ fontSize: '0.82rem', padding: '10px 14px', margin: 0 }}>
                              {d.otpSent}
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label">{d.enterOtp}</label>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  placeholder="Enter 6-digit OTP" 
                                  maxLength={6}
                                  value={otpValue}
                                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                                  disabled={kycLoading}
                                />
                                <button 
                                  type="button" 
                                  className="btn btn-primary"
                                  onClick={handleVerifyAadhaarOtp}
                                  disabled={kycLoading || otpValue.length < 4}
                                >
                                  {kycLoading ? 'Verifying...' : d.verifyOtp}
                                </button>
                              </div>
                              {otpError && (
                                <p style={{ color: 'var(--danger)', fontSize: '0.78rem', margin: '4px 0 0 0' }}>{otpError}</p>
                              )}
                            </div>
                            <button 
                              type="button" 
                              className="btn btn-link btn-sm" 
                              style={{ alignSelf: 'flex-start', padding: 0 }}
                              onClick={() => { setOtpSent(false); setOtpValue(''); setOtpError(''); }}
                              disabled={kycLoading}
                            >
                              Edit Aadhaar Number
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {tenantKycMethod === 'video_kyc' && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {(() => {
                      const latestSession = customer.kycSessions?.find((s: any) => s.method === 'video_kyc');
                      
                      if (customer.kycStatus === 'verified' && latestSession?.status === 'video_approved') {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--success)' }}>
                              <span className="material-icons-outlined" style={{ fontSize: '24px' }}>verified_user</span>
                              <strong style={{ fontSize: '0.95rem' }}>Video KYC Approved</strong>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                              This customer's Video KYC session was successfully reviewed and approved.
                            </p>
                            {latestSession.reviewNotes && (
                              <div style={{ background: 'var(--bg-alt)', padding: '12px', borderRadius: '4px', fontSize: '0.82rem' }}>
                                <strong>Admin Notes:</strong> {latestSession.reviewNotes}
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (customer.kycStatus === 'video_under_review' || latestSession?.status === 'video_reviewing') {
                        // Under review state. Display review buttons for admins.
                        const responseData = latestSession.responseData ? JSON.parse(latestSession.responseData) : null;
                        const videoUrl = responseData?.video_url || latestSession.reviewNotes; // fallback

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="alert alert-warning" style={{ fontSize: '0.82rem', padding: '10px 14px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>hourglass_empty</span>
                              <span>{d.videoUnderReview}</span>
                            </div>

                            {videoUrl && (
                              <a 
                                href={videoUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="btn btn-secondary btn-sm"
                                style={{ alignSelf: 'flex-start' }}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>play_circle</span>
                                View Recorded Video KYC
                              </a>
                            )}

                            {userRole !== 'agent' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label">Review Notes / Remarks</label>
                                  <textarea 
                                    className="form-control" 
                                    rows={2} 
                                    placeholder={d.notesPlaceholder}
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                    disabled={kycLoading}
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <button 
                                    type="button" 
                                    className="btn btn-primary"
                                    onClick={() => handleReviewVideoKyc(latestSession.id, 'approved')}
                                    disabled={kycLoading}
                                  >
                                    {kycLoading ? d.kycSubmitting : d.approveVideoKyc}
                                  </button>
                                  <button 
                                    type="button" 
                                    className="btn btn-secondary"
                                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                                    onClick={() => handleReviewVideoKyc(latestSession.id, 'rejected')}
                                    disabled={kycLoading}
                                  >
                                    {kycLoading ? d.kycSubmitting : d.rejectVideoKyc}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', margin: 0 }}>
                                Waiting for an administrator to review the recorded video session.
                              </p>
                            )}
                          </div>
                        );
                      }

                      if (customer.kycStatus === 'video_submitted' || latestSession?.status === 'initiated') {
                        // Session is created, but not completed yet
                        const sessionUrl = latestSession?.responseData ? JSON.parse(latestSession.responseData)?.sessionUrl : videoKycSession?.sessionUrl;
                        const url = sessionUrl || videoKycSession?.sessionUrl;

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                              {d.videoKycInitiated}
                            </p>
                            {url ? (
                              <a 
                                href={url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="btn btn-primary"
                                style={{ alignSelf: 'flex-start' }}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>videocam</span>
                                {d.openVideoKyc}
                              </a>
                            ) : (
                              <button 
                                type="button" 
                                className="btn btn-primary"
                                onClick={handleInitiateVideoKyc}
                                disabled={kycLoading}
                              >
                                {kycLoading ? 'Initiating...' : 'Refresh / Get Link'}
                              </button>
                            )}
                          </div>
                        );
                      }

                      // No active session or rejected/failed
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                            Generate a Video KYC link for the customer. The customer will need to record a short video answering verification questions.
                          </p>
                          <button 
                            type="button" 
                            className="btn btn-primary"
                            style={{ alignSelf: 'flex-start' }}
                            onClick={handleInitiateVideoKyc}
                            disabled={kycLoading}
                          >
                            {kycLoading ? 'Initiating...' : d.initiateVideoKyc}
                          </button>

                          {videoKycSession?.sessionUrl && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', background: 'var(--bg-alt)', padding: '14px', borderRadius: '6px' }}>
                              <p style={{ fontSize: '0.8.rem', color: 'var(--text-secondary)', margin: 0 }}>
                                Copy the link below or open to complete verification:
                              </p>
                              <a 
                                href={videoKycSession.sessionUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="btn btn-secondary btn-sm"
                                style={{ alignSelf: 'flex-start' }}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>launch</span>
                                {d.openVideoKyc}
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
                
                {tenantKycMethod === 'manual_upload' && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                      The system is currently configured for Manual Document Upload. Automated integrations (Aadhaar OTP eKYC, Video KYC) can be enabled under System Config if the KYC premium add-on is active.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cheques Tab */}
        <div className={`tab-content ${activeTab === 'cheques' ? 'active' : ''}`}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Bank Name</th>
                  <th>Cheque Number</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customer.securityCheques.map((ch: any, i: number) => (
                  <tr key={ch.id}>
                    <td>{i + 1}</td>
                    <td>{ch.bankName}</td>
                    <td>{ch.chequeNumber}</td>
                    <td><span className={getBadgeClass(ch.status)} style={{textTransform:'capitalize'}}>{ch.status}</span></td>
                  </tr>
                ))}
                {customer.securityCheques.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-light)' }}>
                      {d.noCheques}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Guarantors Tab */}
        <div className={`tab-content ${activeTab === 'guarantors' ? 'active' : ''}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {customer.guarantors && customer.guarantors.length > 0 ? customer.guarantors.map((g: any) => (
              <div key={g.id} className="card" style={{ background: 'var(--bg)', display: 'flex', gap: '20px', padding: '20px' }}>
                <div style={{ 
                  width: '120px', height: '150px', borderRadius: 'var(--radius-sm)', 
                  background: 'var(--border)', flexShrink: 0, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {g.photo ? (
                    <img src={g.photo} alt={g.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>person</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{g.name}</h4>
                      <span style={{ fontSize: '.85rem', color: 'var(--primary)', fontWeight: 600 }}>{g.relation || d.relationNotSpecified}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '.9rem' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '16px' }}>phone</span>
                        {g.phone}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <div style={{ fontSize: '.7rem', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '4px' }}>{d.aadharNumber}</div>
                      <div style={{ fontSize: '.9rem' }}>{g.aadharNumber || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '.7rem', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '4px' }}>{d.address}</div>
                      <div style={{ fontSize: '.9rem', lineHeight: 1.4 }}>{g.address || '—'}</div>
                    </div>
                  </div>
                  {g.notes && (
                    <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(0,0,0,0.03)', borderRadius: '4px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
                      <strong>{d.notes}:</strong> {g.notes}
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <div className="empty-state" style={{ padding: '40px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--border)' }}>handshake</span>
                <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>{d.noGuarantors}</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Request Edit Modal */}
      {editRequestModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setEditRequestModal(false); }}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{d.requestEdit}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setEditRequestModal(false)}>close</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setEditRequestLoading(true);
              const fd = new FormData(e.currentTarget);
              fd.set('customerId', customer.id);
              const res = await submitEditRequest(fd);
              setEditRequestLoading(false);
              if (res.success) {
                setEditRequestModal(false);
                alert(d.editRequestSubmitted);
              } else {
                alert(res.error || d.failedToSubmit);
              }
            }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '.85rem', color: 'var(--text-light)' }}>
                  {d.fillUpdatedValues}
                </p>
                <div className="form-group">
                  <label className="form-label">{d.name}</label>
                  <input type="text" name="name" className="form-control" defaultValue={customer.name} />
                </div>
                <div className="form-group">
                  <label className="form-label">{d.phone}</label>
                  <input type="text" name="phone" className="form-control" defaultValue={customer.phone} />
                </div>
                <div className="form-group">
                  <label className="form-label">{d.address}</label>
                  <input type="text" name="address" className="form-control" defaultValue={customer.address} />
                </div>
                <div className="form-group">
                  <label className="form-label">{d.aadhaarNumber}</label>
                  <input type="text" name="aadharNumber" className="form-control" defaultValue={customer.aadharNumber} />
                </div>
                <div className="form-group">
                  <label className="form-label">{d.kycStatus}</label>
                  <select name="kycStatus" className="form-control" defaultValue={customer.kycStatus}>
                    <option value="pending">{d.pending}</option>
                    <option value="verified">{d.verified}</option>
                    <option value="rejected">{d.rejected}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{d.reasonForChange} <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <textarea name="reason" className="form-control" rows={3} required placeholder={d.reasonPlaceholder} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditRequestModal(false)}>{d.cancel}</button>
                <button type="submit" className="btn btn-primary" disabled={editRequestLoading}>
                  {editRequestLoading ? d.submitting : d.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
