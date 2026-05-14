'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { reviewRequest } from './actions';

export default function ApprovalsClient({ requests, userRole, dict }: { requests: any[], userRole: string, dict: any }) {
  const d = dict.approvals;
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>{d.title}</h1>
          <p className="text-muted">{d.description}</p>
        </div>
      </div>

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
              {requests.length === 0 ? (
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
