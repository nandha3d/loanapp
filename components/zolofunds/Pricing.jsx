'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, ArrowRight, Plus, Sparkles } from 'lucide-react';
import { useScrollAnimation } from './hooks/useScrollAnimation';

export default function Pricing({ onOpenDemo }) {
  const sectionRef = useScrollAnimation();
  /**
   * ─── AUTHORITATIVE PRICING CATALOG ──────────────────────────────────────────
   * Source: loanapp/prisma/seed-pricing.ts + lib/plans.ts + subscription page
   *
   * Pricing model: Per-vertical subscription.
   * - Customer picks ONE plan (Free → Enterprise).
   * - Plan price applies per VERTICAL (lending module).
   * - Each additional vertical costs the same plan price again.
   * - Add-ons are billed separately on top.
   * - Enterprise plan includes all add-ons free.
   * ─────────────────────────────────────────────────────────────────────────────
   */
  const plans = [
    {
      id: 'free',
      plan: 'free',
      name: 'Free',
      price: '₹0',
      period: 'forever',
      description: 'Perfect for individuals — always free, no credit card required',
      branches: '1 branch',
      agents: '1 agent',
      loans: '25 active loans',
      features: [
        'Single branch',
        '1 agent',
        '25 active loans',
        'Basic reporting'
      ],
      cta: 'Start Free',
      popular: false
    },
    {
      id: 'collector',
      plan: 'collector',
      name: 'Collector',
      price: '₹699',
      period: '/mo + GST',
      description: 'Unlimited field agents for a single-product collection business',
      branches: 'Single branch',
      agents: 'Unlimited agents',
      loans: '500 active loans',
      features: [
        'Unlimited agents',
        'Single branch',
        '500 active loans',
        'Any one lending vertical',
        'Voice entry & offline collection',
        'GPS collection & receipts'
      ],
      cta: 'Choose Collector',
      popular: false
    },
    {
      id: 'basic',
      plan: 'basic',
      name: 'Basic',
      price: '₹999',
      period: '/mo + GST',
      description: 'Small NBFC or personal lender — essential tools to get started',
      branches: 'Up to 2 branches',
      agents: 'Up to 15 agents',
      loans: '500 active loans',
      features: [
        'Up to 2 branches',
        'Up to 15 agents',
        '500 active loans',
        'Two lending verticals',
        'Standard reporting',
        'WhatsApp notifications',
        'Basic accounting'
      ],
      cta: 'Choose Basic',
      popular: false
    },
    {
      id: 'business',
      plan: 'business',
      name: 'Business',
      price: '₹2,999',
      period: '/mo + GST',
      description: 'Growing microfinance operation with advanced capabilities',
      branches: 'Up to 6 branches',
      agents: 'Up to 60 agents',
      loans: '1,500 active loans',
      features: [
        'Up to 6 branches',
        'Up to 60 agents',
        '1500 active loans',
        'All lending verticals',
        'Premium accounting & KYC',
        'Advanced reporting',
        'Priority support',
        'Custom branding'
      ],
      cta: 'Choose Business',
      popular: true
    },
    {
      id: 'enterprise',
      plan: 'enterprise',
      name: 'Enterprise',
      price: '₹7,999',
      period: '/mo + GST',
      description: 'Unlimited scale for large-scale financial institutions & NBFCs',
      branches: 'Unlimited branches',
      agents: 'Unlimited agents',
      loans: 'Unlimited loans',
      features: [
        'Unlimited branches',
        'Unlimited agents',
        'Unlimited loans',
        'Credit bureau & NPA engine',
        '24/7 Dedicated Support',
        'Custom integrations',
        'MFA enforcement',
        'Dedicated server options'
      ],
      cta: 'Talk to Sales',
      popular: false,
      trial: '15-Day Free Trial'
    }
  ];

  /**
   * ─── VERTICAL MODULES ──────────────────────────────────────────────────────
   * Source: loanapp/lib/pricing.ts STANDARD_VERTICAL_BASES + seed-pricing.ts
   *
   * Verticals are NOT add-ons — they are the lending modules the customer
   * picks. Plan price × number of verticals = vertical subscription cost.
   * ─────────────────────────────────────────────────────────────────────────────
   */
  const verticalModules = [
    { name: 'Micro Lending', desc: 'Manage micro loans, daily collections, routes, and agents' },
    { name: 'Auto Finance', desc: 'Vehicle financing, hire purchase, collateral tracking, and hypothecation' },
    { name: 'Chit Funds', desc: 'Organize chit groups, auctions, dividend distribution, and member entries' },
    { name: 'Gold Loan', desc: 'Gold-backed lending, valuation, LTV, packets, pledges, and release tracking' },
    { name: 'Property Loan', desc: 'Property-backed lending, mortgage documents, valuation, and release tracking' },
    { name: 'Product Finance', desc: 'Consumer-durable and product financing with dealer and EMI tracking' }
  ];

  /**
   * ─── PREMIUM ADD-ONS ───────────────────────────────────────────────────────
   * Source: loanapp/prisma/seed-pricing.ts (5 priced add-ons) +
   *         loanapp/app/(dashboard)/[module]/subscription/page.tsx (8 total)
   *
   * The subscription dashboard shows 8 add-on capabilities. The 5 in the
   * seed catalog have explicit monthly pricing. The remaining 3 (Receipt PDF,
   * NPA Engine, Foreclosure) are toggled by the developer without separate
   * monthly billing. All add-ons are included free on Enterprise plan.
   * ─────────────────────────────────────────────────────────────────────────────
   */
  const premiumAddons = [
    {
      name: 'WhatsApp & SMS Alerts',
      price: '₹299/mo',
      desc: 'Automated payment reminders, OTPs, and customer alerts via MSG91'
    },
    {
      name: 'Digital Aadhaar & Video KYC',
      price: '₹399/mo',
      desc: 'Instant verification of customer identity with photo matching and OTP'
    },
    {
      name: 'Agent Route GPS Tracking',
      price: '₹199/mo',
      desc: 'Real-time GPS coordinates verification for collection entries'
    },
    {
      name: 'Premium Accounting & GST',
      price: '₹599/mo',
      desc: 'Full double-entry general ledger, P&L, Balance Sheet, GST summaries, and budget tracking'
    },
    {
      name: 'Credit Bureau Integration',
      price: '₹199/mo',
      desc: 'Query CRIF/CIBIL credit history directly for applicants before disbursement'
    },
    {
      name: 'NPA Classification Engine',
      price: 'Included',
      desc: 'Automated NPA classification, provisioning tracking, and regulatory compliance'
    },
    {
      name: 'Receipt PDF Downloads',
      price: 'Included',
      desc: 'Export and print professional collection receipts, loan statements, and summaries'
    },
    {
      name: 'Preclose & Early Settlement',
      price: 'Included',
      desc: 'Calculate precise early closing amounts, apply discretionary waivers, and generate settlement PDFs'
    }
  ];

  return (
    <section id="pricing" className="section section-alt" ref={sectionRef}>
      <div className="container">
        <div className="section-header animate-on-scroll">
          <div className="section-pill">Lender Subscription Plans</div>
          <h2 className="section-title">
            Simple, Transparent <span className="gradient-text">Pricing for Lenders</span>
          </h2>
          <p className="section-subtitle">
            Start free and upgrade only when you need to. No setup fees, no lock-in — just transparent monthly plans. Price applies per lending vertical you enable.
          </p>
        </div>

        {/* 5 Plans Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            alignItems: 'stretch',
            marginBottom: '36px'
          }}
        >
          {plans.map((p, pi) => (
            <div
              key={p.id}
              className={`glass-card animate-on-scroll delay-${pi + 1}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '30px 22px',
                border: p.popular
                  ? '3px solid var(--brand-purple)'
                  : '1.5px solid var(--border-color)',
                position: 'relative',
                background: '#FFFFFF',
                boxShadow: p.popular ? 'var(--shadow-purple)' : 'var(--shadow-sm)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = 'var(--shadow-purple)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = p.popular ? 'var(--shadow-purple)' : 'var(--shadow-sm)'; }}
            >
              {p.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '14px',
                    padding: '3px 10px',
                    borderRadius: '10px',
                    background: 'var(--brand-purple)',
                    color: '#FFFFFF',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    letterSpacing: '0.04em'
                  }}
                >
                  MOST POPULAR
                </div>
              )}

              {p.trial && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '14px',
                    padding: '3px 10px',
                    borderRadius: '10px',
                    background: 'var(--brand-gold)',
                    color: 'var(--brand-gold-text)',
                    fontSize: '0.7rem',
                    fontWeight: 900
                  }}
                >
                  {p.trial}
                </div>
              )}

              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--brand-purple)', marginBottom: '4px' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minHeight: '36px', lineHeight: 1.35, marginBottom: '16px' }}>
                  {p.description}
                </div>

                {/* Exact Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '18px' }}>
                  <span style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--text-title)', lineHeight: 1 }}>
                    {p.price}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                    {p.period}
                  </span>
                </div>

                <div style={{ height: '1.5px', background: 'var(--border-subtle)', marginBottom: '18px' }} />

                {/* Features List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                  {p.features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: 'var(--brand-purple-tint)',
                          color: 'var(--brand-purple)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          flexShrink: 0,
                          marginTop: '2px'
                        }}
                      >
                        <Check size={11} />
                      </div>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-body)', lineHeight: 1.4, fontWeight: 500 }}>
                        {feat}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {p.id === 'enterprise' ? (
                <button
                  onClick={onOpenDemo}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '11px', fontSize: '0.88rem' }}
                >
                  <span>{p.cta}</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <Link
                  href={`/register?plan=${p.plan}`}
                  className={p.popular ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ width: '100%', padding: '11px', fontSize: '0.88rem', justifyContent: 'center' }}
                >
                  <span>{p.cta}</span>
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Pricing Model Explainer */}
        <div
          style={{
            background: 'var(--brand-purple-light)',
            border: '2px solid var(--brand-purple-border)',
            borderRadius: '18px',
            padding: '24px 28px',
            marginBottom: '36px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--brand-purple)', marginBottom: '6px' }}>
            📐 Per-Vertical Pricing Model
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-body)', lineHeight: 1.6, maxWidth: '780px', margin: '0 auto' }}>
            Your subscription plan price applies <strong>per lending vertical</strong> you enable. For example, if you choose the Business plan (₹2,999/mo) and enable both Micro Lending and Auto Finance, your vertical subscription is ₹2,999 × 2 = ₹5,998/mo. Add-ons are billed separately on top.
          </p>
        </div>

        {/* GST Transparency Banner */}
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '44px' }}>
          All paid plans billed in INR + 18% GST. Billing is monthly via Razorpay. Cancel anytime.
        </p>

        {/* 6 Lending Verticals Section */}
        <div
          className="glass-card"
          style={{
            padding: '36px',
            border: '2px solid var(--brand-purple-border)',
            background: '#FFFFFF',
            borderRadius: '24px',
            marginBottom: '28px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="zolo-pill-badge">6 Lending Verticals</span>
          </div>
          <h3 style={{ fontSize: '1.45rem', marginBottom: '6px', color: 'var(--text-title)' }}>
            Choose Your Lending Modules
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '24px' }}>
            Each vertical is included under your chosen subscription plan. Enable or disable modules per branch at any time as your business changes.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '14px'
            }}
          >
            {verticalModules.map((mod, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-subtle)',
                  padding: '16px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'var(--brand-purple)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    flexShrink: 0,
                    marginTop: '3px'
                  }}
                >
                  <Check size={10} />
                </div>
                <div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '2px' }}>
                    {mod.name}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
                    {mod.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Premium Add-ons Section */}
        <div
          className="glass-card"
          style={{
            padding: '36px',
            border: '2px solid var(--brand-purple-border)',
            background: '#FFFFFF',
            borderRadius: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="zolo-pill-badge">Premium Add-ons & Integrations</span>
            <Sparkles size={16} color="var(--brand-purple)" />
          </div>
          <h3 style={{ fontSize: '1.45rem', marginBottom: '6px', color: 'var(--text-title)' }}>
            Unlock Advanced Lending Capabilities
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '24px' }}>
            Enable or disable add-ons as your finance business grows. All premium add-ons are included free on the Enterprise plan.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px'
            }}
          >
            {premiumAddons.map((addon, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-subtle)',
                  padding: '18px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-title)' }}>
                      {addon.name}
                    </div>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 900,
                        color: addon.price === 'Included' ? '#059669' : 'var(--brand-purple)',
                        background: addon.price === 'Included' ? 'var(--success-bg)' : '#FFFFFF',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: addon.price === 'Included'
                          ? '1px solid #D1FAE5'
                          : '1px solid var(--brand-purple-border)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {addon.price}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {addon.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
