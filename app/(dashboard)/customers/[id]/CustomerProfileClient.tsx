'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate, getBadgeClass, getInitials, calcPercentage } from '@/lib/utils';
import { submitEditRequest } from '@/app/(dashboard)/approvals/actions';
import { resetCustomerPassword } from '@/app/(dashboard)/customers/actions';
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

export default function CustomerProfileClient({
  customer,
  currencySymbol,
  userRole,
  dict,
}: {
  customer: any;
  currencySymbol: string;
  userRole: string;
  dict: any;
}) {
  const d = dict.customerProfile;
  const [activeTab, setActiveTab] = useState('loans');
  const [editRequestModal, setEditRequestModal] = useState(false);
  const [editRequestLoading, setEditRequestLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

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
