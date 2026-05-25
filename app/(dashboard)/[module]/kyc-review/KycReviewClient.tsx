'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import Modal from '@/components/Modal';
import { formatDate } from '@/lib/utils';

export default function KycReviewClient({
  customers,
  kycEnabled,
  userRole,
  dict,
}: {
  customers: any[];
  kycEnabled: boolean;
  userRole: string;
  dict: any;
}) {
  const router = useRouter();
  const k = dict.kyc || {};
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  const handleReviewVideoKyc = async (sessionId: string, decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !reviewNotes) {
      alert(k.pleaseProvideReason || 'Please provide a reason/notes for rejecting the KYC.');
      return;
    }
    setLoading(true);
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
        alert(`${k.title || 'KYC'} ${decision === 'approved' ? k.approvedKyc || 'approved' : k.rejectKyc || 'rejected'}.`);
        setReviewNotes('');
        setSelectedCustomer(null);
        router.refresh();
      } else {
        alert(data.error || k.failedToSubmit || 'Failed to submit review.');
      }
    } catch {
      alert(k.errorOccurred || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMethodLabel = (method: string) => {
    if (method === 'video_kyc') return k.videoKycMethod || 'Video KYC';
    if (method === 'aadhaar_otp') return k.aadhaarOtpMethod || 'Aadhaar OTP eKYC';
    return k.manualUpload || 'Manual Upload';
  };

  const getStatusBadge = (status: string) => {
    let bg = 'var(--warning-bg)';
    let fg = 'var(--warning)';
    let label = status;

    if (status === 'video_under_review') {
      bg = '#FEF3C7'; fg = '#D97706';
      label = k.videoUnderReview || 'Video Under Review';
    } else if (status === 'video_submitted') {
      bg = '#DBEAFE'; fg = '#2563EB';
      label = k.videoSubmitted || 'Video Submitted';
    } else if (status === 'otp_initiated') {
      bg = '#F3E8FF'; fg = '#7C3AED';
      label = k.otpInitiated || 'OTP Verification Sent';
    }

    return (
      <span style={{
        background: bg, color: fg,
        padding: '4px 10px', borderRadius: '12px',
        fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize'
      }}>
        {label}
      </span>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="header-content">
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            {k.title || 'KYC Review Queue'}
          </h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0' }}>
            {k.description || 'Verify pending automated and video KYC submissions from customers.'}
          </p>
        </div>
      </div>

      {!kycEnabled ? (
        <div style={{
          background: 'rgba(234, 179, 8, 0.05)',
          borderLeft: '4px solid var(--warning)',
          padding: '20px', borderRadius: '8px',
          display: 'flex', gap: '16px', alignItems: 'start'
        }}>
          <span className="material-icons-outlined" style={{ color: 'var(--warning)', fontSize: '32px' }}>workspace_premium</span>
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700 }}>
              {k.premiumRequired || 'Premium Add-on Required'}
            </h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {k.premiumDesc || 'The automated KYC Verification module is not enabled for your subscription.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div className="table-wrapper">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>{k.dateSubmitted || 'Date Submitted'}</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>{k.customerDetails || 'Customer Details'}</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>{k.assignedAgent || 'Assigned Agent'}</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>{k.kycMethod || 'KYC Method'}</th>
                  <th style={{ textAlign: 'left', padding: '16px 20px' }}>{k.status || 'Status'}</th>
                  <th style={{ textAlign: 'right', padding: '16px 20px' }}>{k.actions || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-light)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '48px', marginBottom: '12px', display: 'block' }}>check_circle</span>
                      <h3 style={{ margin: 0 }}>{k.queueEmpty || 'Review Queue is Empty'}</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>{k.queueEmptyDesc || 'All customer KYC submissions are verified.'}</p>
                    </td>
                  </tr>
                ) : (
                  customers.map((cust) => {
                    const latestSession = cust.kycSessions?.[0];
                    return (
                      <tr key={cust.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px 20px' }}>{formatDate(cust.updatedAt)}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <Link href={`/customers/${cust.customerCode}`} style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            {cust.name}
                          </Link>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                            {k.codeLabel || 'Code'}: {cust.customerCode}
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>{cust.agent?.name || '—'}</td>
                        <td style={{ padding: '16px 20px' }}>
                          {getMethodLabel(cust.kycMethod || latestSession?.method)}
                        </td>
                        <td style={{ padding: '16px 20px' }}>{getStatusBadge(cust.kycStatus)}</td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {latestSession?.method === 'video_kyc' ? (
                              <button className="btn btn-primary btn-sm" onClick={() => setSelectedCustomer(cust)}>
                                {k.reviewKyc || 'Review KYC'}
                              </button>
                            ) : (
                              <Link href={`/customers/${cust.customerCode}?tab=kyc`} className="btn btn-secondary btn-sm">
                                {k.viewProfile || 'View Profile'}
                              </Link>
                            )}
                          </div>
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

      {/* Video KYC Review Modal */}
      {selectedCustomer && (
        <Modal
          isOpen={!!selectedCustomer}
          onClose={() => { setSelectedCustomer(null); setReviewNotes(''); }}
          title={k.reviewVideoKyc || 'Review Video KYC'}
        >
          {(() => {
            const cust = selectedCustomer;
            const latestSession = cust.kycSessions?.[0];
            const responseData = latestSession?.responseData ? JSON.parse(latestSession.responseData) : null;
            const videoUrl = responseData?.video_url;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'var(--bg-alt)', padding: '14px', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <div><strong>{k.customerName || 'Customer Name'}:</strong> {cust.name}</div>
                  <div style={{ marginTop: '4px' }}><strong>{k.customerCode || 'Customer Code'}:</strong> {cust.customerCode}</div>
                  <div style={{ marginTop: '4px' }}><strong>{k.aadhaarNumber || 'Aadhaar Number'}:</strong> {cust.aadharNumber || '—'}</div>
                </div>

                {videoUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>{k.recordedVideo || 'Recorded KYC Video'}</label>
                    <video src={videoUrl} controls style={{ width: '100%', maxHeight: '240px', borderRadius: '6px', background: '#000' }} />
                    <a href={videoUrl} target="_blank" rel="noreferrer"
                      style={{ alignSelf: 'flex-start', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                      {k.openVideoNewTab || 'Open Video in New Tab'}
                    </a>
                  </div>
                ) : (
                  <div style={{ background: 'var(--bg-alt)', padding: '16px', borderRadius: '6px', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '32px', marginBottom: '4px', display: 'block' }}>warning</span>
                    <span>{k.noVideoFallback || 'No recorded video found in session.'}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>{k.reviewNotesLabel || 'Review Notes / Remarks'}</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder={k.reviewNotesPlaceholder || 'Enter details on physical face match, audio match, documents shown...'}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    disabled={loading}
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <button type="button" className="btn btn-ghost"
                    onClick={() => { setSelectedCustomer(null); setReviewNotes(''); }}>
                    {k.cancel || 'Cancel'}
                  </button>
                  <button type="button" className="btn btn-primary" disabled={loading}
                    onClick={() => handleReviewVideoKyc(latestSession.id, 'approved')}>
                    {loading ? (k.processing || 'Processing...') : (k.approveKyc || 'Approve KYC')}
                  </button>
                  <button type="button" className="btn btn-secondary"
                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                    disabled={loading}
                    onClick={() => handleReviewVideoKyc(latestSession.id, 'rejected')}>
                    {k.rejectKyc || 'Reject KYC'}
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
