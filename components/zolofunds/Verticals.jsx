'use client';

import React, { useState } from 'react';
import { Users, Car, Coins, Check, ArrowRight } from 'lucide-react';
import { useScrollAnimation } from './hooks/useScrollAnimation';

export default function Verticals({ onOpenDemo }) {
  const [activeVertical, setActiveVertical] = useState('microfinance');
  const sectionRef = useScrollAnimation();

  const verticalsData = {
    microfinance: {
      title: 'For Microfinance & Moneylenders',
      tagline: 'Track daily collection routes and stop field agent cash leakage',
      icon: <Users size={26} />,
      badge: 'Daily & Weekly Lending',
      description:
        'Designed specifically for microfinance founders, NBFC-MFIs, and neighborhood moneylenders. Put an end to missing cash diaries. Assign field agents daily collection routes, track collections on live GPS maps, and automatically clear the oldest overdue interest first.',
      keyCapabilities: [
        'Disburse Daily, Weekly, Bi-Weekly, and Monthly instalment loans',
        'Smart waterfall recovery: collected money clears oldest overdue first',
        'Assign daily routes to collection agents with GPS geofence checks',
        'Verify borrower identity before disbursement with Aadhaar OTP & Video KYC',
        'End-of-day dual digital cash handover between collection boys and owner',
        'Automated midnight sweep flags missed collections and adds late fees'
      ]
    },
    autofinance: {
      title: 'For Auto & Commercial Vehicle Financiers',
      tagline: 'Protect vehicle-backed capital with RC document vaults and insurance tracking',
      icon: <Car size={26} />,
      badge: 'Asset-Backed Lending',
      description:
        'Full lifecycle management for financiers funding two-wheelers, auto-rickshaws, commercial trucks, and private cars. Safely vault RC papers, engine/chassis numbers, and insurance expiry dates directly on customer loan files.',
      keyCapabilities: [
        'Comprehensive vehicle registry: Make, Model, Year, Engine & Chassis numbers',
        'Digital RC (Registration Certificate) document vault and verification',
        'Automated insurance expiry tracking with WhatsApp renewal alerts to borrowers',
        'Default, repossession, and overdue recovery management workflows',
        'Track multiple guarantors and up to 5 post-dated security cheques (PDCs)',
        'Generate NOC and hypothecation release letters upon final loan settlement'
      ]
    },
    chitfunds: {
      title: 'For Chit Fund Foremen & Operators',
      tagline: 'Automate monthly auction bidding, foreman commissions, and dividend math',
      icon: <Coins size={26} />,
      badge: 'Chit Groups',
      description:
        'Bring total transparency and eliminate math errors in your chit fund operations. Set up chit groups, record monthly auction winners with one click, automatically deduct your foreman commission, and instantly redistribute member dividends.',
      keyCapabilities: [
        'Create chit groups: member count, monthly instalment, total pool & commission %',
        'Live auction recording: records winning bid discount and foreman charges automatically',
        'Instant dividend redistribution: calculates exact payouts for non-winning members',
        'Member contribution ledger tracking full, partial, and overdue instalments',
        'One-click Chit Group Statement PDF generation sent to members on WhatsApp',
        'Complete regulatory compliance with the Indian Chit Funds Act'
      ]
    },
    goldloan: {
      title: 'For Gold Loan Firms & Pawn Brokers',
      tagline: 'Manage gold valuations, purity grading, and safe vault custody',
      icon: <Coins size={26} />,
      badge: 'Collateral Custody',
      description:
        'Manage high-velocity collateral loans against gold ornaments. Calculate loan-to-value (LTV) against daily market gold rates, record karat purity and stone deductions, and maintain a secure vault storage ledger.',
      keyCapabilities: [
        'Real-time gold rate valuation calculator with customizable LTV limits',
        'Karat purity grading, gross vs net weight, and stone deduction formulas',
        'Tamper-evident packet sealing and safe vault barcode inventory tracking',
        'Periodic interest billing with bullet repayment or monthly EMI options',
        'Controlled collateral release protocol only upon full principal and interest clearance'
      ]
    }
  };

  const current = verticalsData[activeVertical];

  return (
    <section id="verticals" className="section section-alt" ref={sectionRef}>
      <div className="container">
        <div className="section-header animate-on-scroll">
          <div className="section-pill">Built For Lending Verticals</div>
          <h2 className="section-title">
            Tailored For Your Specific <span className="gradient-text">Lending Business</span>
          </h2>
          <p className="section-subtitle">
            Whether you operate door-to-door daily collection routes, finance commercial vehicles, or manage chit funds, Zolo Funds delivers the exact operational control your lending firm needs.
          </p>
        </div>

        {/* Vector Illustration Banner */}
        <div
          className="vector-illustration-frame"
          style={{
            maxWidth: '920px',
            margin: '0 auto 36px auto',
            padding: '12px',
            border: '2px solid var(--brand-purple-border)'
          }}
        >
          <img
            src="/assets/illustrations/verticals.jpg"
            alt="Small Business Microfinance, Auto Finance, and Chit Fund Operations"
            style={{
              width: '100%',
              maxHeight: '380px',
              objectFit: 'contain',
              borderRadius: '16px',
              display: 'block'
            }}
          />
        </div>

        {/* Vertical Tabs Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '36px'
          }}
        >
          {Object.keys(verticalsData).map((key) => {
            const item = verticalsData[key];
            const isActive = activeVertical === key;
            return (
              <button
                key={key}
                onClick={() => setActiveVertical(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: 'var(--radius-full)',
                  background: isActive ? 'var(--brand-purple)' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : 'var(--text-title)',
                  border: isActive ? '2px solid var(--brand-purple)' : '1.5px solid var(--border-color)',
                  boxShadow: isActive ? '0 4px 16px var(--brand-purple-glow)' : 'var(--shadow-sm)',
                  fontWeight: 800,
                  fontSize: '0.94rem'
                }}
              >
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>

        {/* Active Vertical Showcase Card */}
        <div
          className="glass-card"
          style={{
            maxWidth: '1080px',
            margin: '0 auto',
            padding: '40px',
            border: '2px solid var(--brand-purple-border)',
            background: '#FFFFFF'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '36px',
              alignItems: 'center'
            }}
          >
            {/* Left Content */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div className="icon-box" style={{ marginBottom: 0, width: '48px', height: '48px' }}>
                  {current.icon}
                </div>
                <span className="zolo-pill-badge">
                  {current.badge}
                </span>
              </div>

              <h3 style={{ fontSize: '1.75rem', marginBottom: '8px', color: 'var(--text-title)' }}>
                {current.title}
              </h3>
              <p
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--brand-purple)',
                  marginBottom: '16px'
                }}
              >
                {current.tagline}
              </p>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '28px' }}>
                {current.description}
              </p>

              <button
                onClick={onOpenDemo}
                className="btn btn-primary"
                style={{ gap: '8px' }}
              >
                <span>Schedule Lender Demo for {current.title.replace('For ', '')}</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {/* Right Capabilities List */}
            <div
              style={{
                background: 'var(--bg-subtle)',
                padding: '30px',
                borderRadius: '20px',
                border: '1.5px solid var(--border-color)'
              }}
            >
              <h4 style={{ fontSize: '1.1rem', marginBottom: '18px', color: 'var(--brand-purple)', fontWeight: 800 }}>
                How Your Firm Benefits:
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {current.keyCapabilities.map((cap, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: 'var(--brand-purple)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    >
                      <Check size={13} />
                    </div>
                    <span style={{ fontSize: '0.92rem', color: 'var(--text-body)', lineHeight: 1.5, fontWeight: 600 }}>
                      {cap}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

