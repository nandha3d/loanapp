'use client';

import React, { useState } from 'react';

type Affiliate = {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  userId: string | null;
  tenantId: string | null;
  status: string;
  createdAt: string;
};

type Referral = {
  id: string;
  affiliateId: string;
  referredTenantId: string | null;
  referredEmail: string;
  status: string;
  planTerm: string;
  monthlyPrice: number;
  subscribedAt: string | null;
  createdAt: string;
};

type Reward = {
  id: string;
  affiliateId: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
  grantedAt: string | null;
};

type Config = {
  threshold: number;
  monthlyCommissionRate: number;
  monthlyCommissionMonths: number;
  yearlyRewardFreeMonths: number;
};

type Visit = {
  id: string;
  affiliateId: string;
  ipAddress: string | null;
  userAgent: string | null;
  referrerUrl: string | null;
  createdAt: string;
};

type Lead = {
  id: string;
  affiliateId: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  lastStepReached: string;
  status: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
};

type AffiliatesClientProps = {
  initialAffiliates: Affiliate[];
  initialReferrals: Referral[];
  initialRewards: Reward[];
  initialConfig: Config;
  initialVisits?: Visit[];
  initialLeads?: Lead[];
};

export default function AffiliatesClient({
  initialAffiliates,
  initialReferrals,
  initialRewards,
  initialConfig,
  initialVisits = [],
  initialLeads = [],
}: AffiliatesClientProps) {
  const [affiliates, setAffiliates] = useState<Affiliate[]>(initialAffiliates);
  const [referrals, setReferrals] = useState<Referral[]>(initialReferrals);
  const [rewards, setRewards] = useState<Reward[]>(initialRewards);
  const [config, setConfig] = useState<Config>(initialConfig);
  const [visits] = useState<Visit[]>(initialVisits);
  const [leads] = useState<Lead[]>(initialLeads);

  // Form State
  const [threshold, setThreshold] = useState(config.threshold);
  const [commissionRate, setCommissionRate] = useState(config.monthlyCommissionRate);
  const [commissionMonths, setCommissionMonths] = useState(config.monthlyCommissionMonths);
  const [yearlyFreeMonths, setYearlyFreeMonths] = useState(config.yearlyRewardFreeMonths);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Selected Affiliate for Drill Down
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(null);

  // Action State
  const [updatingRewardId, setUpdatingRewardId] = useState<string | null>(null);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  const getPartnerReferrals = (partnerId: string) => {
    return referrals.filter((r) => r.affiliateId === partnerId);
  };

  const getPartnerPaidCount = (partnerId: string) => {
    return getPartnerReferrals(partnerId).filter((r) => r.status === 'subscribed').length;
  };

  const getPartnerRewards = (partnerId: string) => {
    return rewards.filter((rw) => rw.affiliateId === partnerId);
  };

  const getPartnerVisitsCount = (partnerId: string) => {
    return visits.filter((v) => v.affiliateId === partnerId).length;
  };

  const getPartnerLeads = (partnerId: string) => {
    return leads.filter((l) => l.affiliateId === partnerId);
  };

  const handleSyncStatus = async () => {
    setSyncing(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/cron/affiliate-sync');
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Synchronization complete! ${data.data.conversionsDetected} conversions processed, ${data.data.rewardsGenerated} rewards generated. 🎉`);
        // Refresh local data
        window.location.reload();
      } else {
        setErrorMsg(data.error || 'Failed to sync statuses');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingConfig(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/developer/affiliate/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threshold,
          monthlyCommissionRate: commissionRate,
          monthlyCommissionMonths: commissionMonths,
          yearlyRewardFreeMonths: yearlyFreeMonths,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Affiliate system configuration settings updated successfully! ⚙️');
        setConfig({
          threshold,
          monthlyCommissionRate: commissionRate,
          monthlyCommissionMonths: commissionMonths,
          yearlyRewardFreeMonths: yearlyFreeMonths,
        });
      } else {
        setErrorMsg(data.error || 'Failed to update configuration settings');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleUpdateRewardStatus = async (rewardId: string, newStatus: string) => {
    setUpdatingRewardId(rewardId);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/developer/affiliate/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Reward payout marked as "${newStatus}"!`);
        // Update local rewards state
        setRewards(
          rewards.map((rw) =>
            rw.id === rewardId ? { ...rw, status: newStatus, grantedAt: newStatus === 'paid' ? new Date().toISOString() : rw.grantedAt } : rw
          )
        );
      } else {
        setErrorMsg(data.error || 'Failed to update reward status');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setUpdatingRewardId(null);
    }
  };

  // Aggregated System Stats
  const totalPartners = affiliates.length;
  const totalSubscribers = referrals.filter((r) => r.status === 'subscribed').length;
  const totalSignups = referrals.length;
  const pendingPayoutsAmount = rewards
    .filter((rw) => rw.status === 'pending')
    .reduce((sum, rw) => sum + rw.amount, 0);

  const selectedAffiliate = affiliates.find((a) => a.id === selectedAffiliateId);
  const selectedPartnerReferrals = selectedAffiliateId ? getPartnerReferrals(selectedAffiliateId) : [];
  const selectedPartnerRewards = selectedAffiliateId ? getPartnerRewards(selectedAffiliateId) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Page Title & Sync Controller */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 6px' }}>💼 Affiliate Partner Network</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Manage affiliate integrations, configure global reward settings, run cohort syncs, and pay out commissions.
          </p>
        </div>
        <button
          onClick={handleSyncStatus}
          disabled={syncing}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
            sync
          </span>
          {syncing ? 'Synchronizing Cohorts...' : 'Sync Conversions Now'}
        </button>
      </div>

      {/* Action Messages */}
      {successMsg && (
        <div style={{
          background: 'rgba(74, 222, 128, 0.1)',
          border: '1px solid var(--success)',
          padding: '16px',
          borderRadius: '12px',
          color: 'var(--success)',
          fontSize: '0.88rem',
          fontWeight: 500
        }}>
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--accent)',
          padding: '16px',
          borderRadius: '12px',
          color: '#F87171',
          fontSize: '0.88rem',
          fontWeight: 500
        }}>
          {errorMsg}
        </div>
      )}

      {/* Grid: Overview Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '24px',
      }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Partners</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px' }}>{totalPartners} Partners</div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Referred Signups</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px' }}>{totalSignups} Accounts</div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Subscribers</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px' }}>{totalSubscribers} Lenders</div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Payouts Value</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px', color: 'var(--accent)' }}>₹{pendingPayoutsAmount.toLocaleString()}</div>
        </div>
      </div>

      {/* Form Panel: Configuration Settings & partners List */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '28px',
        alignItems: 'start'
      }}>
        
        {/* Card 1: Configuration Settings */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>⚙️ Affiliate System Config</h3>
          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Referral Payout Threshold (paid counts)
              </label>
              <input
                type="number"
                className="form-control"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                required
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Commission Payout Rate (%)
              </label>
              <input
                type="number"
                step="0.05"
                className="form-control"
                value={commissionRate}
                onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
                required
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Commission Duration (months)
              </label>
              <input
                type="number"
                className="form-control"
                value={commissionMonths}
                onChange={(e) => setCommissionMonths(parseInt(e.target.value, 10))}
                required
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Free Yearly subscription Reward (months free)
              </label>
              <input
                type="number"
                className="form-control"
                value={yearlyFreeMonths}
                onChange={(e) => setYearlyFreeMonths(parseInt(e.target.value, 10))}
                required
              />
            </div>

            <button
              type="submit"
              disabled={updatingConfig}
              className="btn btn-primary"
              style={{ fontWeight: 700, padding: '12px 16px', marginTop: '10px' }}
            >
              {updatingConfig ? 'Updating settings...' : 'Save Configuration'}
            </button>
          </form>
        </div>

        {/* Card 2: Partners List */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>👥 Active Affiliate Partners</h3>
          
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Partner Name</th>
                  <th>Ref Code</th>
                  <th>Type</th>
                  <th>Referrals</th>
                  <th>Paid</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map((aff) => {
                  const total = getPartnerReferrals(aff.id).length;
                  const paid = getPartnerPaidCount(aff.id);
                  return (
                    <tr key={aff.id} style={{
                      background: selectedAffiliateId === aff.id ? 'var(--bg-light)' : 'transparent',
                      transition: 'background 0.2s'
                    }}>
                      <td style={{ fontWeight: 600 }}>
                        <div>{aff.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{aff.email}</div>
                      </td>
                      <td>
                        <code style={{ color: 'var(--accent)', fontWeight: 600 }}>{aff.code}</code>
                      </td>
                      <td>
                        <span className={`badge ${aff.userId ? 'badge-primary' : 'badge-ghost'}`}>
                          {aff.userId ? 'Tenant' : 'Outsider'}
                        </span>
                      </td>
                      <td>
                        <div>{total} signups</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{getPartnerVisitsCount(aff.id)} clicks</div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{paid} paid</td>
                      <td>
                        <button
                          onClick={() => setSelectedAffiliateId(selectedAffiliateId === aff.id ? null : aff.id)}
                          className="btn btn-ghost"
                          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        >
                          {selectedAffiliateId === aff.id ? 'Close' : 'Drill Down'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drill Down Cohort & Rewards Details */}
      {selectedAffiliateId && selectedAffiliate && (
        <div className="card" style={{ padding: '28px', border: '2px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>🔍 Cohort Breakdown: {selectedAffiliate.name}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Affiliate code: <code>{selectedAffiliate.code}</code> • Status: <strong>{selectedAffiliate.status}</strong>
              </p>
            </div>
            <button
              onClick={() => setSelectedAffiliateId(null)}
              className="btn btn-ghost"
              style={{ padding: '6px 12px' }}
            >
              Close Panel
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '24px',
            alignItems: 'start'
          }}>
            {/* Cohort Referrals Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '14px' }}>Converted Signups</h4>
              
              {selectedPartnerReferrals.length === 0 ? (
                <p style={{ padding: '20px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No referred lenders yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Term</th>
                        <th>Subscribed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPartnerReferrals.map((r) => (
                        <tr key={r.id}>
                          <td>{r.referredEmail}</td>
                          <td>
                            <span className={`badge ${
                              r.status === 'subscribed'
                                ? 'badge-success'
                                : r.status === 'churned'
                                  ? 'badge-danger'
                                  : 'badge-warning'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{r.planTerm}</td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {r.subscribedAt ? new Date(r.subscribedAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </div>

              {/* Incomplete Leads Table */}
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '14px' }}>Registration Drop-offs (Leads)</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '12px' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>privacy_tip</span>
                  Contact details are partially masked per privacy policy for incomplete registrations.
                </p>
                {getPartnerLeads(selectedAffiliateId).length === 0 ? (
                  <p style={{ padding: '20px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No incomplete registrations tracked.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Business/Owner</th>
                          <th>Contact</th>
                          <th>Status</th>
                          <th>Started At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPartnerLeads(selectedAffiliateId).map((l) => (
                          <React.Fragment key={l.id}>
                            <tr 
                              style={{ cursor: 'pointer', background: expandedLeadId === l.id ? 'var(--bg-light)' : 'transparent', transition: 'background 0.2s' }}
                              onClick={() => setExpandedLeadId(expandedLeadId === l.id ? null : l.id)}
                            >
                              <td style={{ fontWeight: 600 }}>
                                <div>{l.businessName || 'N/A'}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{l.ownerName || 'N/A'}</div>
                              </td>
                              <td style={{ fontSize: '0.8rem' }}>
                                <div>{l.email && l.email !== 'N/A' ? l.email.replace(/(.{2})(.*)(?=@)/, '$1***') : 'N/A'}</div>
                                <div style={{ color: 'var(--text-secondary)' }}>
                                  {l.phone && l.phone !== 'N/A' ? l.phone.slice(0, 3) + '****' + l.phone.slice(-3) : 'N/A'}
                                </div>
                              </td>
                              <td>
                                {l.status === 'completed' ? (
                                  <span className="badge badge-success">Completed</span>
                                ) : (
                                  <span className="badge badge-warning" style={{ textTransform: 'capitalize' }}>
                                    Incomplete at {l.lastStepReached.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                {new Date(l.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                            {expandedLeadId === l.id && (
                              <tr style={{ background: 'var(--bg-light)' }}>
                                <td colSpan={4} style={{ padding: '16px 24px' }}>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <strong style={{ fontSize: '0.9rem' }}>Wizard Summary</strong>
                                    {!l.metadata ? (
                                      <span style={{ color: 'var(--text-secondary)' }}>No configuration details captured yet.</span>
                                    ) : (
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                        <div>
                                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Plan Chosen</div>
                                          <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{(l.metadata as any)?.plan || 'None selected'}</div>
                                        </div>
                                        <div>
                                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Modules</div>
                                          <div>
                                            {(l.metadata as any)?.modules?.length > 0 
                                              ? ((l.metadata as any).modules as string[]).map(m => <div key={m} style={{ textTransform: 'capitalize' }}>• {m}</div>)
                                              : 'None'}
                                          </div>
                                        </div>
                                        <div>
                                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Add-ons</div>
                                          <div>
                                            {(l.metadata as any)?.addons?.length > 0 
                                              ? ((l.metadata as any).addons as string[]).map(a => <div key={a} style={{ textTransform: 'capitalize' }}>• {a.replace('_', ' ')}</div>)
                                              : 'None'}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* cohort rewards panel */}
            <div>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '14px' }}>cohort rewards history</h4>
              
              {selectedPartnerRewards.length === 0 ? (
                <p style={{ padding: '20px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No rewards generated for this affiliate.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedPartnerRewards.map((reward) => (
                    <div
                      key={reward.id}
                      style={{
                        background: 'var(--bg-light)',
                        border: '1px solid var(--border)',
                        padding: '16px',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize' }}>
                          {reward.type === 'free_year' ? 'Free Year' : 'Commission payout'}
                        </span>
                        <span className={`badge ${
                          reward.status === 'paid'
                            ? 'badge-success'
                            : reward.status === 'granted'
                              ? 'badge-primary'
                              : 'badge-warning'
                        }`} style={{ fontSize: '0.65rem' }}>
                          {reward.status}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent)' }}>
                        ₹{reward.amount.toLocaleString()}
                      </div>

                      {reward.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button
                            onClick={() => handleUpdateRewardStatus(reward.id, 'granted')}
                            disabled={updatingRewardId === reward.id}
                            className="btn btn-ghost"
                            style={{ flex: 1, padding: '4px 8px', fontSize: '0.72rem' }}
                          >
                            Approve Grant
                          </button>
                          <button
                            onClick={() => handleUpdateRewardStatus(reward.id, 'paid')}
                            disabled={updatingRewardId === reward.id}
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '4px 8px', fontSize: '0.72rem' }}
                          >
                            Mark Paid
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
