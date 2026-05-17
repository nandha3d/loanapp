'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { reviewRequest, reviewPendingLoan, approveCustomerCreation, rejectCustomerCreation } from './actions';
import { useRouter } from 'next/navigation';

export default function ApprovalsClient({
  requests,
  pendingLoans = [],
  pendingCustomers = [],
  userRole,
  dict
}: {
  requests: any[];
  pendingLoans?: any[];
  pendingCustomers?: any[];
  userRole: string;
  dict: any;
}) {
  const d = dict.approvals;
  const router = useRouter();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loanLoading, setLoanLoading] = useState<string | null>(null);
  const [customerLoading, setCustomerLoading] = useState<string | null>(null);

  // Dynamically set default active tab based on which section has pending items
  const [activeTab, setActiveTab] = useState<'customers' | 'loans' | 'edits'>(() => {
    if (pendingCustomers.length > 0) return 'customers';
    if (pendingLoans.length > 0) return 'loans';
    return 'edits';
  });

  async function handleLoanReview(loanId: string, action: 'approve' | 'reject') {
    if (!confirm(`Are you sure you want to ${action} this loan?`)) return;
    setLoanLoading(loanId);
    const fd = new FormData();
    fd.set('loanId', loanId);
    fd.set('action', action);
    fd.set('reviewNotes', '');
    const res = await reviewPendingLoan(fd);
    setLoanLoading(null);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error);
    }
  }

  async function handleCustomerReview(customerId: string, action: 'approve' | 'reject') {
    if (!confirm(`Are you sure you want to ${action} this customer registration?`)) return;
    setCustomerLoading(customerId);
    const res = action === 'approve'
      ? await approveCustomerCreation(customerId)
      : await rejectCustomerCreation(customerId);
    setCustomerLoading(null);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || 'Failed to process request');
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="header-content">
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>{d.title}</h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0' }}>{d.description}</p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        gap: '24px',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        <button
          onClick={() => setActiveTab('customers')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 4px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'customers' ? 600 : 500,
            color: activeTab === 'customers' ? 'var(--primary)' : 'var(--text-light)',
            borderBottom: activeTab === 'customers' ? '2px solid var(--primary)' : '2px solid transparent',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>person_add</span>
          New Registrations
          {pendingCustomers.length > 0 && (
            <span style={{
              background: 'var(--primary-bg)',
              color: 'var(--primary)',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              {pendingCustomers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('loans')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 4px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'loans' ? 600 : 500,
            color: activeTab === 'loans' ? 'var(--primary)' : 'var(--text-light)',
            borderBottom: activeTab === 'loans' ? '2px solid var(--primary)' : '2px solid transparent',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>account_balance</span>
          Loan Applications
          {pendingLoans.length > 0 && (
            <span style={{
              background: 'var(--primary-bg)',
              color: 'var(--primary)',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              {pendingLoans.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('edits')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 4px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'edits' ? 600 : 500,
            color: activeTab === 'edits' ? 'var(--primary)' : 'var(--text-light)',
            borderBottom: activeTab === 'edits' ? '2px solid var(--primary)' : '2px solid transparent',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>edit</span>
          Profile Edit Requests
          {requests.filter(r => r.status === 'pending').length > 0 && (
            <span style={{
              background: 'var(--primary-bg)',
              color: 'var(--primary)',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              {requests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Contents: Customers */}
      {activeTab === 'customers' && (
        <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Date Registered</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Customer Name</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Phone</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Address</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Submitting Agent</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '16px 20px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-light)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '48px', marginBottom: '12px', display: 'block' }}>face</span>
                      <h3 style={{ margin: 0 }}>No Customer Registrations Pending</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>All new agent registrations are fully processed.</p>
                    </td>
                  </tr>
                ) : (
                  pendingCustomers.map((cust) => (
                    <tr key={cust.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px 20px' }}>{new Date(cust.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <strong>{cust.name}</strong>
                        {cust.customerCode && <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{cust.customerCode}</div>}
                      </td>
                      <td style={{ padding: '16px 20px' }}>{cust.phone}</td>
                      <td style={{ padding: '16px 20px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cust.address}</td>
                      <td style={{ padding: '16px 20px' }}>{cust.agent?.name || '—'}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span className="badge badge-pending" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                          Pending Review
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}
                            disabled={customerLoading === cust.id}
                            onClick={() => handleCustomerReview(cust.id, 'approve')}
                          >
                            {customerLoading === cust.id ? '...' : 'Approve'}
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}
                            disabled={customerLoading === cust.id}
                            onClick={() => handleCustomerReview(cust.id, 'reject')}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Contents: Loans */}
      {activeTab === 'loans' && (
        <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Loan Code</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Principal</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Submitted By</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '16px 20px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingLoans.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-light)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '48px', marginBottom: '12px', display: 'block' }}>receipt_long</span>
                      <h3 style={{ margin: 0 }}>No Loan Applications Pending</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>All loan requests are fully processed.</p>
                    </td>
                  </tr>
                ) : (
                  pendingLoans.map((loan: any) => (
                    <tr key={loan.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px 20px' }}>{new Date(loan.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '16px 20px' }}><strong>{loan.loanCode}</strong></td>
                      <td style={{ padding: '16px 20px' }}>{loan.customer?.name} ({loan.customer?.customerCode})</td>
                      <td style={{ padding: '16px 20px' }}>₹{Number(loan.principal).toLocaleString()}</td>
                      <td style={{ padding: '16px 20px' }}>{loan.createdBy?.name || '—'}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span className="badge badge-pending" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                          Pending Review
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}
                            disabled={loanLoading === loan.id}
                            onClick={() => handleLoanReview(loan.id, 'approve')}
                          >
                            {loanLoading === loan.id ? '...' : 'Approve'}
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}
                            disabled={loanLoading === loan.id}
                            onClick={() => handleLoanReview(loan.id, 'reject')}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Contents: Edits */}
      {activeTab === 'edits' && (
        <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>{d.date}</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>{d.requestedBy}</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>{d.entityType}</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>{d.changes}</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>{d.status}</th>
                  <th style={{ textAlign: 'right', padding: '16px 20px' }}>{d.action}</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-light)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '48px', marginBottom: '12px', display: 'block' }}>check_circle</span>
                      <h3 style={{ margin: 0 }}>{d.noRequests}</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>{d.allCaughtUp}</p>
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => {
                    const changes = JSON.parse(req.requestedChanges || '{}');
                    return (
                      <tr key={req.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px 20px' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '16px 20px' }}>{req.requestedBy?.name}</td>
                        <td style={{ padding: '16px 20px', textTransform: 'capitalize' }}>{req.entityType}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontSize: '0.85rem' }}>
                            {Object.keys(changes).map(k => (
                              <div key={k}><strong>{k}:</strong> {changes[k]}</div>
                            ))}
                          </div>
                          {req.reason && <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '4px' }}>{d.reason}: {req.reason}</div>}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span className={`badge badge-${req.status === 'pending' ? 'pending' : req.status === 'approved' ? 'active' : 'missed'}`} style={{
                            background: req.status === 'pending' ? 'var(--warning-bg)' : req.status === 'approved' ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: req.status === 'pending' ? 'var(--warning)' : req.status === 'approved' ? 'var(--success)' : 'var(--danger)',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem'
                          }}>
                            {req.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          {req.status === 'pending' && userRole !== 'agent' ? (
                            <button className="btn btn-primary btn-sm" onClick={() => setSelectedRequest(req)}>{d.review}</button>
                          ) : (
                            req.reviewedBy && <span style={{ fontSize: '0.85rem' }}>{d.reviewedBy} {req.reviewedBy.name}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profile Review Modal */}
      <Modal isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} title={d.reviewTitle}>
        {selectedRequest && (
          <form action={async (fd) => {
            setLoading(true);
            const res = await reviewRequest(fd);
            setLoading(false);
            if (res.success) {
              setSelectedRequest(null);
              router.refresh();
            } else {
              alert(res.error);
            }
          }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input type="hidden" name="requestId" value={selectedRequest.id} />

            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 600 }}>{d.requestedChanges}:</h4>
              <pre style={{ background: 'var(--bg-dark)', padding: '12px', borderRadius: 'var(--radius-sm)', overflowX: 'auto', fontSize: '0.85rem', margin: 0 }}>
                {JSON.stringify(JSON.parse(selectedRequest.requestedChanges), null, 2)}
              </pre>
              <p style={{ marginTop: '12px', fontSize: '0.9rem' }}><strong>{d.reason}:</strong> {selectedRequest.reason}</p>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>{d.actionLabel}</label>
              <select name="action" className="form-control" style={{ borderRadius: 'var(--radius-sm)' }}>
                <option value="approve">{d.approve}</option>
                <option value="reject">{d.reject}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>{d.reviewNotes}</label>
              <textarea name="reviewNotes" className="form-control" rows={3} placeholder={d.notesPlaceholder} style={{ borderRadius: 'var(--radius-sm)' }}></textarea>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedRequest(null)}>{d.cancel}</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? d.processing : d.submitReview}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
