'use client';

import React, { useState } from 'react';

type AffiliateConfig = {
  threshold: number;
  monthlyCommissionRate: number;
  monthlyCommissionMonths: number;
  yearlyRewardFreeMonths: number;
};

export default function AffiliateLandingClient({ config }: { config: AffiliateConfig }) {
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState('');
  const [error, setError] = useState('');

  // Calculator State
  const [calcReferrals, setCalcReferrals] = useState(config.threshold > 0 ? config.threshold + 2 : 12);
  const [calcAvgMonthlyPrice, setCalcAvgMonthlyPrice] = useState(1500);

  // Compute calculated metrics
  const commissionRate = config.monthlyCommissionRate;
  const months = config.monthlyCommissionMonths;
  const totalReferredRevenue = calcReferrals * calcAvgMonthlyPrice;
  const calculatedCommission = totalReferredRevenue * commissionRate * months;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      setError('Please provide your name and email address.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/affiliate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json();
      if (data.success) {
        setAffiliateCode(data.data.affiliate.code);
        setRegistered(true);
      } else {
        setError(data.error || 'Failed to submit registration');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getReferralUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/r/${affiliateCode}`;
    }
    return `https://loantrack.co/r/${affiliateCode}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getReferralUrl());
    alert('Referral URL copied to clipboard! 🎉');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #09090E 0%, #111122 100%)',
      color: '#F3F4F6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '60px 20px',
      overflowX: 'hidden',
    }}>
      {/* Container */}
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header Branding */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '50px',
        }}>
          <img src="/assets/logo.svg" alt="LoanTrack" style={{ width: '40px', height: '40px' }} />
          <h2 style={{
            fontSize: '1.8rem',
            fontWeight: 800,
            margin: 0,
            letterSpacing: '-0.5px',
          }}>
            Loan<span style={{ color: '#E94560' }}>Track</span> Affiliate
          </h2>
        </header>

        {/* Hero Section */}
        <section style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 855,
            lineHeight: '1.2',
            letterSpacing: '-1px',
            marginBottom: '20px',
            background: 'linear-gradient(to right, #FFFFFF, #B0B0D0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Refer lending businesses.<br />
            Earn <span style={{ color: '#E94560' }}>high recurring rewards</span>.
          </h1>
          <p style={{
            fontSize: '1.15rem',
            color: 'rgba(255, 255, 255, 0.65)',
            maxWidth: '650px',
            margin: '0 auto 40px',
            lineHeight: '1.6',
          }}>
            Join our affiliate program today. Help lenders streamline daily collections, loan tracking, and accounting while earning a substantial {config.monthlyCommissionRate * 100}% recurring payout.
          </p>
        </section>

        {/* Two Column Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '40px',
          marginBottom: '80px',
        }}>
          
          {/* Card 1: Informational & Interactive Calculator */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '24px',
            padding: '36px',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '30px',
          }}>
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 10px', color: '#fff' }}>
                How It Works
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6', margin: 0 }}>
                Every superadmin referred by your link gets a 14-day free trial. Once {config.threshold} of your referred tenants upgrade to active paid plans, rewards unlock!
              </p>
            </div>

            {/* Core Perks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{
                  background: 'rgba(233, 69, 96, 0.12)',
                  color: '#E94560',
                  borderRadius: '10px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '18px'
                }}>💸</div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>{config.monthlyCommissionRate * 100}% Commission Payout</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                    Refer as a monthly subscriber and get {config.monthlyCommissionRate * 100}% of their subscription fees for {config.monthlyCommissionMonths} months.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{
                  background: 'rgba(74, 222, 128, 0.12)',
                  color: '#4ADE80',
                  borderRadius: '10px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '18px'
                }}>🎁</div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                    {config.yearlyRewardFreeMonths === 12 ? '1 Year' : `${config.yearlyRewardFreeMonths} Months`} Free Workspace
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                    Refer as a yearly subscriber and get {config.yearlyRewardFreeMonths === 12 ? 'a full 1-year' : `${config.yearlyRewardFreeMonths} months`} free credit for your own lending workspace!
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Calculator */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '18px',
              padding: '24px',
              marginTop: '10px',
            }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 20px', color: '#fff' }}>
                🧮 Interactive Commission Calculator
              </h4>
              
              {/* Referrals Slider */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Paid Lenders Referred</span>
                  <span style={{ color: '#E94560', fontWeight: 700 }}>{calcReferrals} Lenders</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={calcReferrals}
                  onChange={(e) => setCalcReferrals(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#E94560' }}
                />
              </div>

              {/* Monthly Subscription Slider */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Average Monthly Subscription Cost</span>
                  <span style={{ color: '#E94560', fontWeight: 700 }}>₹{calcAvgMonthlyPrice.toLocaleString()}/mo</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="500"
                  value={calcAvgMonthlyPrice}
                  onChange={(e) => setCalcAvgMonthlyPrice(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#E94560' }}
                />
              </div>

              {/* Estimated Earning Display */}
              <div style={{
                background: 'rgba(233, 69, 96, 0.08)',
                border: '1px solid rgba(233, 69, 96, 0.15)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Estimated Recurring Commission
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: '6px' }}>
                  ₹{calculatedCommission.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                  Based on {config.monthlyCommissionRate * 100}% × {config.monthlyCommissionMonths} months referred revenue (Threshold Met)
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Application / Success Form */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '24px',
            padding: '36px',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            {!registered ? (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>
                    Join the Affiliate Network
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                    Apply in seconds. No platform subscription or credit card required.
                  </p>
                </div>

                {error && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    padding: '12px',
                    borderRadius: '10px',
                    color: '#F87171',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>⚠️</span> {error}
                  </div>
                )}

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #E94560 0%, #C8334E 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: '10px',
                    boxShadow: '0 6px 16px rgba(233, 69, 96, 0.2)',
                    transition: 'all 0.2s',
                    fontSize: '0.95rem'
                  }}
                >
                  {loading ? 'Submitting details...' : 'Generate My Referral Link'}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(74, 222, 128, 0.1)',
                  color: '#4ADE80',
                  fontSize: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto'
                }}>
                  ✓
                </div>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>
                    Welcome to the Program!
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                    Here is your custom, trackable partner referral URL. Share it with lending teams.
                  </p>
                </div>

                {/* Referral Link Box */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '16px',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <span style={{
                    fontSize: '0.85rem',
                    color: '#E94560',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {getReferralUrl()}
                  </span>
                  <button
                    onClick={copyToClipboard}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    Copy Link
                  </button>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                  Save this URL. You can share it via email, WhatsApp, blog posts, or social media!
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
