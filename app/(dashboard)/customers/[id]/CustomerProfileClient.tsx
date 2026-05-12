'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate, getBadgeClass, getInitials, calcPercentage } from '@/lib/utils';
import { submitEditRequest } from '@/app/(dashboard)/approvals/actions';

export default function CustomerProfileClient({
  customer,
  currencySymbol,
  userRole,
}: {
  customer: any;
  currencySymbol: string;
  userRole: string;
}) {
  const [activeTab, setActiveTab] = useState('loans');
  const [editRequestModal, setEditRequestModal] = useState(false);
  const [editRequestLoading, setEditRequestLoading] = useState(false);

  return (
    <>
      {/* Profile Header */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="profile-header">
          <div className="profile-avatar">{getInitials(customer.name)}</div>
          <div className="profile-info">
            <h2>{customer.name}</h2>
            <div className="profile-meta">
              <span><span className="material-icons-outlined" style={{ fontSize: '14px' }}>badge</span> {customer.customerCode}</span>
              <span><span className="material-icons-outlined" style={{ fontSize: '14px' }}>phone</span> {customer.phone}</span>
              <span><span className="material-icons-outlined" style={{ fontSize: '14px' }}>location_on</span> {customer.route?.name || 'No Route'}</span>
              <span><span className={getBadgeClass(customer.kycStatus)} style={{textTransform:'capitalize'}}>{customer.kycStatus}</span></span>
            </div>
            <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>{customer.address}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {userRole !== 'agent' && (
              <Link href={`/customers/new?edit=${customer.id}`} className="btn btn-secondary btn-sm">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span> Edit
              </Link>
            )}
            {userRole === 'agent' && (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditRequestModal(true)}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit_note</span> Request Edit
              </button>
            )}
            {userRole !== 'agent' && (
              <Link href={`/loans/new?customerId=${customer.id}`} className="btn btn-primary btn-sm">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span> New Loan
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'loans' ? 'active' : ''}`} onClick={() => setActiveTab('loans')}>Loan History</div>
          <div className={`tab ${activeTab === 'kyc' ? 'active' : ''}`} onClick={() => setActiveTab('kyc')}>KYC Documents</div>
          <div className={`tab ${activeTab === 'cheques' ? 'active' : ''}`} onClick={() => setActiveTab('cheques')}>Security Cheques</div>
        </div>

        {/* Loans Tab */}
        <div className={`tab-content ${activeTab === 'loans' ? 'active' : ''}`}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Loan ID</th>
                  <th>Principal</th>
                  <th>Frequency</th>
                  <th>Start Date</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {customer.loans.map((l: any) => {
                  const pct = calcPercentage(l.paidCount, l.totalInstalments);
                  return (
                    <tr key={l.id}>
                      <td><Link href={`/loans/${l.id}`}><strong>{l.loanCode}</strong></Link></td>
                      <td>{formatCurrency(l.principal, currencySymbol)}</td>
                      <td style={{textTransform:'capitalize'}}>{l.frequency}</td>
                      <td>{formatDate(l.startDate)}</td>
                      <td>
                        <div className="progress" style={{ width: '100px' }}>
                          <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="progress-text">{pct}% ({l.paidCount}/{l.totalInstalments})</span>
                      </td>
                      <td><span className={getBadgeClass(l.status)} style={{textTransform:'capitalize'}}>{l.status}</span></td>
                      <td>
                        <Link href={`/loans/${l.id}`} className="btn btn-ghost btn-sm">View</Link>
                      </td>
                    </tr>
                  );
                })}
                {customer.loans.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-light)' }}>
                      No loans found
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
              <h4 style={{ marginBottom: '12px' }}>Aadhar Card</h4>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '40px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>credit_card</span>
                <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Aadhar: <strong>{customer.aadharNumber || 'Not provided'}</strong>
                </p>
                <p style={{ fontSize: '.75rem', color: 'var(--text-light)', marginTop: '4px' }}>Document uploaded via app</p>
              </div>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>upload</span> Replace Document
              </button>
            </div>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <h4 style={{ marginBottom: '12px' }}>Verification Status</h4>
              <div className="card" style={{ background: 'var(--bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span className="material-icons-outlined" style={{ color: customer.kycStatus === 'verified' ? 'var(--success)' : 'var(--warning)', fontSize: '28px' }}>
                    {customer.kycStatus === 'verified' ? 'verified' : 'pending_actions'}
                  </span>
                  <div>
                    <strong style={{textTransform:'capitalize'}}>{customer.kycStatus}</strong>
                    <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>Status can be changed by Admin</p>
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
                      No cheques registered
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Request Edit Modal — agent only */}
      {editRequestModal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setEditRequestModal(false); }}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Request Customer Edit</h3>
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
                alert('Edit request submitted. An admin will review it shortly.');
              } else {
                alert(res.error || 'Failed to submit request');
              }
            }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '.85rem', color: 'var(--text-light)' }}>
                  Fill in the updated values for the fields you want changed. Leave a field blank to keep its current value.
                </p>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input type="text" name="name" className="form-control" defaultValue={customer.name} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input type="text" name="phone" className="form-control" defaultValue={customer.phone} />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input type="text" name="address" className="form-control" defaultValue={customer.address} />
                </div>
                <div className="form-group">
                  <label className="form-label">Aadhaar Number</label>
                  <input type="text" name="aadharNumber" className="form-control" defaultValue={customer.aadharNumber} />
                </div>
                <div className="form-group">
                  <label className="form-label">KYC Status</label>
                  <select name="kycStatus" className="form-control" defaultValue={customer.kycStatus}>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason for Change <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <textarea name="reason" className="form-control" rows={3} required placeholder="Briefly explain why this change is needed..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditRequestModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editRequestLoading}>
                  {editRequestLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
