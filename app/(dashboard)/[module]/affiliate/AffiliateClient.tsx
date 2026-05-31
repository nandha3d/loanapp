'use client';

import { useState } from 'react';

type AffiliateClientProps = {
  module: string;
  affiliate: {
    id: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
  };
  config: {
    threshold: number;
    monthlyCommissionRate: number;
    monthlyCommissionMonths: number;
    yearlyRewardFreeMonths: number;
  };
  stats: {
    totalReferrals: number;
    referredPaidCount: number;
    referredMonthlyRevenue: number;
    remainingToUnlock: number;
    unlocked: boolean;
  };
  rewards: {
    current: {
      unlocked: boolean;
      remainingToUnlock: number;
      type: string;
      affiliateValue: number;
      ourCost: number;
      detail: string;
    };
    comparison: {
      yearlyReward: { affiliateValue: number; ourCost: number; detail: string };
      monthlyReward: { affiliateValue: number; ourCost: number; detail: string };
      costlier: string;
    };
    granted: Array<{
      id: string;
      type: string;
      amount: number;
      status: string;
      createdAt: string;
      grantedAt: string | null;
    }>;
  };
  referrals: Array<{
    id: string;
    referredEmail: string;
    status: string;
    planTerm: string;
    monthlyPrice: number;
    subscribedAt: string | null;
    createdAt: string;
  }>;
};

export default function AffiliateClient({
  module,
  affiliate,
  config,
  stats,
  rewards,
  referrals,
}: AffiliateClientProps) {
  const [copied, setCopied] = useState(false);

  const getReferralUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/r/${affiliate.code}`;
    }
    return `https://loantrack.co/r/${affiliate.code}`;
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(getReferralUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progressPercent = Math.min((stats.referredPaidCount / config.threshold) * 100, 100);

  return (
    <div style={{ padding: '10px 0' }}>
      
      {/* Header and Subheader */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text)' }}>
          🤝 Affiliate Partner Network
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
          Promote LoanTrack to other lending professionals, grow the community, and unlock premium lifetime rewards.
        </p>
      </div>

      {/* Grid: Referral Link + Progress Indicator */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '24px',
        marginBottom: '32px',
      }}>
        
        {/* Card 1: Your Link */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 4px' }}>📢 Your Shareable Partner Link</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Share this link in emails, WhatsApp groups, or direct messages.
            </p>
          </div>

          <div style={{
            background: 'var(--bg-light)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--accent)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {getReferralUrl()}
            </span>
            <button
              onClick={copyUrl}
              className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                minWidth: '70px',
                flexShrink: 0
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div style={{
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--success)' }}>verified_user</span>
            <span>Cookie stays active for 30 days. Signups track automatically.</span>
          </div>
        </div>

        {/* Card 2: Progress Tracker */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 4px' }}>🎯 Reward Unlock Progress</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Rewards unlock at {config.threshold} active paid referrals.
            </p>
          </div>

          {/* Progress Gauge */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 600 }}>
              <span>{stats.referredPaidCount} / {config.threshold} Paid Subscribers</span>
              <span style={{ color: 'var(--accent)' }}>{Math.round(progressPercent)}%</span>
            </div>
            
            <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: progressPercent >= 100 ? 'var(--success)' : 'linear-gradient(to right, var(--accent), var(--primary))',
                width: `${progressPercent}%`,
                transition: 'width 0.5s ease-in-out'
              }} />
            </div>
          </div>

          {/* Active status or remaining count */}
          <div style={{
            fontSize: '0.82rem',
            background: stats.unlocked ? 'rgba(74, 222, 128, 0.1)' : 'var(--bg-light)',
            border: `1px solid ${stats.unlocked ? 'var(--success)' : 'var(--border)'}`,
            padding: '10px 14px',
            borderRadius: '8px',
            color: stats.unlocked ? 'var(--success)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
              {stats.unlocked ? 'emoji_events' : 'lock_open'}
            </span>
            <span>
              {stats.unlocked
                ? 'Congratulations! Payout Cohort Unlocked. Active rewards are listed below.'
                : `Need ${stats.remainingToUnlock} more paid subscriber referrals to unlock your cohort rewards.`}
            </span>
          </div>
        </div>
      </div>

      {/* Cost-Benefit Path Comparison (Interactive Visual Block) */}
      <div className="card" style={{ padding: '28px', marginBottom: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 6px' }}>📊 Intelligent Reward Cohort Comparison</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            Compare your reward path outputs based on your active referred client base.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
        }}>
          {/* Path A: Yearly Subscribers */}
          <div style={{
            background: rewards.comparison.costlier === 'yearly' ? 'rgba(233, 69, 96, 0.04)' : 'var(--bg-light)',
            border: `2px solid ${rewards.comparison.costlier === 'yearly' ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-success" style={{ textTransform: 'uppercase', fontSize: '0.68rem' }}>Yearly Affiliate Path</span>
              {rewards.comparison.costlier === 'yearly' && <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700 }}>⚡ COSTLIER PAYOUT</span>}
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>
                ₹{rewards.comparison.yearlyReward.affiliateValue.toLocaleString()}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Value of {config.yearlyRewardFreeMonths} Months Free Credit on your active workspace subscription.
              </p>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Details: {rewards.comparison.yearlyReward.detail}
            </div>
          </div>

          {/* Path B: Monthly Subscribers */}
          <div style={{
            background: rewards.comparison.costlier === 'monthly' ? 'rgba(233, 69, 96, 0.04)' : 'var(--bg-light)',
            border: `2px solid ${rewards.comparison.costlier === 'monthly' ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-primary" style={{ textTransform: 'uppercase', fontSize: '0.68rem' }}>Monthly Affiliate Path</span>
              {rewards.comparison.costlier === 'monthly' && <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700 }}>⚡ COSTLIER PAYOUT</span>}
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>
                ₹{rewards.comparison.monthlyReward.affiliateValue.toLocaleString()}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Cash payout from {config.monthlyCommissionRate * 100}% recurring revenue of referred paid lenders over {config.monthlyCommissionMonths} months.
              </p>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Details: {rewards.comparison.monthlyReward.detail}
            </div>
          </div>
        </div>

        <div style={{
          marginTop: '20px',
          background: 'rgba(233, 69, 96, 0.04)',
          border: '1px solid rgba(233, 69, 96, 0.1)',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span className="material-icons-outlined" style={{ color: 'var(--accent)', fontSize: '18px' }}>info</span>
          <span>
            {rewards.comparison.costlier === 'monthly'
              ? 'Our mathematics verify that the Monthly path yields more reward value. We strongly encourage Monthly workspace affiliates!'
              : 'Our mathematics verify that the Yearly path yields more reward value. We strongly encourage Yearly workspace affiliates!'}
          </span>
        </div>
      </div>

      {/* Cohort Breakdown & Payout List */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        
        {/* Referred Lenders Cohort */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>👥 Referred Lenders Cohort</h3>
          
          {referrals.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--border)', marginBottom: '12px' }}>group_off</span>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>No referrals tracked yet. Share your partner link to start earning!</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Term</th>
                    <th>Monthly Fee</th>
                    <th>Subscribed At</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((ref) => (
                    <tr key={ref.id}>
                      <td style={{ fontWeight: 600 }}>{ref.referredEmail}</td>
                      <td>
                        <span className={`badge ${
                          ref.status === 'subscribed'
                            ? 'badge-success'
                            : ref.status === 'churned'
                              ? 'badge-danger'
                              : 'badge-warning'
                        }`}>
                          {ref.status}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{ref.planTerm}</td>
                      <td>₹{ref.monthlyPrice ? ref.monthlyPrice.toLocaleString() : '0'}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {ref.subscribedAt ? new Date(ref.subscribedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Granted Rewards List */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>🏆 Granted Rewards</h3>
          
          {rewards.granted.length === 0 ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <span className="material-icons-outlined" style={{ fontSize: '32px', color: 'var(--border)', marginBottom: '8px' }}>workspace_premium</span>
              <p style={{ margin: 0, fontSize: '0.8rem' }}>No rewards generated yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rewards.granted.map((reward) => (
                <div
                  key={reward.id}
                  style={{
                    background: 'var(--bg-light)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize' }}>
                      {reward.type === 'free_year' ? 'Free Year' : 'Commission schedule'}
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
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent)' }}>
                    ₹{reward.amount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Generated on {new Date(reward.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
