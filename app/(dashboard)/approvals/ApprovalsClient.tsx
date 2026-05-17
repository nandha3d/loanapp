'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { reviewRequest, reviewPendingLoan } from './actions';

export default function ApprovalsClient({ requests, pendingLoans = [], userRole, dict }: { requests: any[], pendingLoans?: any[], userRole: string, dict: any }) {
  const d = dict.approvals;
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loanLoading, setLoanLoading] = useState<string | null>(null);

  async function handleLoanReview(loanId: string, action: 'approve' | 'reject') {
    if (!confirm(`Are you sure you want to ${action} this loan?`)) return;
    setLoanLoading(loanId);
    const fd = new FormData();
    fd.set('loanId', loanId);
    fd.set('action', action);
    fd.set('reviewNotes', '');
    const res = await reviewPendingLoan(fd);
    setLoanLoading(null);
    if (!res.success) {
      alert(res.error);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>{d.title}</h1>
          <p className="text-muted">{d.description}</p>
        </div>
      </div>

      {/* Pending Loans Section */}
      {pendingLoans.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-icons-outlined" style={{ color: '#e67e22' }}>assignment</span>
            <h3 style={{ margin: 0 }}>Pending Loan Approvals</h3>
            <span className="badge badge-pending" style={{ marginLeft: '8px' }}>{pendingLoans.length}</span>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Loan Code</th>
                  <th>Customer</th>
                  <th>Principal</th>
                  <th>Submitted By</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingLoans.map((loan: any) => (
                  <tr key={loan.id}>
                    <td>{new Date(loan.createdAt).toLocaleDateString()}</td>
                    <td><strong>{loan.loanCode}</strong></td>
                    <td>{loan.customer?.name} ({loan.customer?.customerCode})</td>
                    <td>₹{Number(loan.principal).toLocaleString()}</td>
                    <td>{loan.createdBy?.name || '—'}</td>
                    <td>
                      <span className="badge badge-pending">Pending Review</span>
                    </td>
                    <td style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-sm"
                        style={{ background: '#27ae60', color: '#fff', border: 'none' }}
                        disabled={loanLoading === loan.id}
                        onClick={() => handleLoanReview(loan.id, 'approve')}
                      >
                        {loanLoading === loan.id ? '...' : 'Approve'}
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: '#e74c3c', color: '#fff', border: 'none' }}
                        disabled={loanLoading === loan.id}
                        onClick={() => handleLoanReview(loan.id, 'reject')}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Existing Approval Requests Section */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>{d.date}</th>
                <th>{d.requestedBy}</th>
                <th>{d.entityType}</th>
                <th>{d.changes}</th>
                <th>{d.status}</th>
                <th>{d.action}</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && pendingLoans.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>
                    <div className="empty-state">
                      <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>check_circle</span>
                      <h3>{d.noRequests}</h3>
                      <p className="text-muted">{d.allCaughtUp}</p>
                    </div>
                  </td>
                </tr>
              ) : requests.map((req) => {
                const changes = JSON.parse(req.requestedChanges || '{}');
                return (
                  <tr key={req.id}>
                    <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                    <td>{req.requestedBy?.name}</td>
                    <td style={{textTransform:'capitalize'}}>{req.entityType}</td>
                    <td>
                      <div style={{fontSize: '0.85rem'}}>
                        {Object.keys(changes).map(k => (
                          <div key={k}><strong>{k}:</strong> {changes[k]}</div>
                        ))}
                      </div>
                      {req.reason && <div style={{fontSize: '0.8rem', color:'var(--text-light)', marginTop:'4px'}}>{d.reason}: {req.reason}</div>}
                    </td>
                    <td>
                      <span className={`badge badge-${req.status === 'pending' ? 'pending' : req.status === 'approved' ? 'active' : 'missed'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td>
                      {req.status === 'pending' && userRole !== 'agent' ? (
                        <button className="btn btn-primary btn-sm" onClick={() => setSelectedRequest(req)}>{d.review}</button>
                      ) : (
                        req.reviewedBy && <span style={{fontSize:'0.85rem'}}>{d.reviewedBy} {req.reviewedBy.name}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} title={d.reviewTitle}>
        {selectedRequest && (
          <form action={async (fd) => {
            setLoading(true);
            const res = await reviewRequest(fd);
            setLoading(false);
            if (res.success) {
              setSelectedRequest(null);
            } else {
              alert(res.error);
            }
          }}>
            <input type="hidden" name="requestId" value={selectedRequest.id} />
            
            <div style={{marginBottom: '20px'}}>
              <h4>{d.requestedChanges}:</h4>
              <pre style={{background:'#f5f5f5', padding:'10px', borderRadius:'4px', marginTop:'5px'}}>
                {JSON.stringify(JSON.parse(selectedRequest.requestedChanges), null, 2)}
              </pre>
              <p style={{marginTop:'10px'}}><strong>{d.reason}:</strong> {selectedRequest.reason}</p>
            </div>

            <div className="form-group">
              <label className="form-label">{d.actionLabel}</label>
              <select name="action" className="form-control">
                <option value="approve">{d.approve}</option>
                <option value="reject">{d.reject}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{d.reviewNotes}</label>
              <textarea name="reviewNotes" className="form-control" rows={3} placeholder={d.notesPlaceholder}></textarea>
            </div>
            
            <div className="form-actions" style={{marginTop:'20px'}}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? d.processing : d.submitReview}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedRequest(null)}>{d.cancel}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
