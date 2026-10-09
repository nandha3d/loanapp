'use client';

import React, { useState } from 'react';
import { UserCheck, Smartphone, ShieldAlert, Users, ArrowRight } from 'lucide-react';
import { useScrollAnimation } from './hooks/useScrollAnimation';

export default function WorkflowExplorer({ onOpenDemo }) {
  const [activeRole, setActiveRole] = useState('owner');
  const sectionRef = useScrollAnimation();

  const roles = {
    owner: {
      id: 'owner',
      title: 'Finance Company Owner / MD',
      subtitle: 'Complete executive visibility and command over deployed capital',
      icon: <UserCheck size={24} />,
      badge: 'Executive Command',
      steps: [
        {
          num: '01',
          title: 'Daily Executive Briefing',
          desc: 'Monitor real-time portfolio balance, total capital deployed, today’s expected field collections, and overdue delinquency alerts.'
        },
        {
          num: '02',
          title: 'Live Agent Tracking & Route Monitoring',
          desc: 'Watch field collection boys moving across assigned daily routes on a live GPS map with collection milestones and battery levels.'
        },
        {
          num: '03',
          title: 'Maker-Checker Approval Queue',
          desc: 'Review and approve customer onboardings, profile modifications with before/after diffs, and loan sanction requests.'
        },
        {
          num: '04',
          title: 'Evening Cash Handover & Audit Lock',
          desc: 'Digitally confirm physical cash received from field agents and lock daily accounting ledgers to prevent backdated tampering.'
        }
      ],
      quote: '"Zolo Funds gave me back complete control over my money. I no longer have to chase agents on phone calls to know who paid."'
    },
    manager: {
      id: 'manager',
      title: 'Branch Manager & Credit Officer',
      subtitle: 'Maker-checker risk gatekeeping and loan sanctioning',
      icon: <ShieldAlert size={24} />,
      badge: 'Credit & Approvals',
      steps: [
        {
          num: '01',
          title: 'Applicant KYC Verification',
          desc: 'Review Aadhaar OTP verification, remote Video KYC recordings, guarantors, and security cheques (PDCs) before approving a borrower.'
        },
        {
          num: '02',
          title: 'Instant Credit Bureau Appraisal',
          desc: 'Pull CRIF or CIBIL credit bureau reports to check active MFI loans, overdue accounts, and default history before sanctioning.'
        },
        {
          num: '03',
          title: 'Loan Structuring & Code Generation',
          desc: 'Set interest rate, repayment frequency (daily/weekly/monthly), and generate unique loan codes (e.g. DL0001).'
        },
        {
          num: '04',
          title: 'Daily Cash Settlement',
          desc: 'Receive collected cash from route agents, verify receipts against system totals, and sign off the digital handover.'
        }
      ],
      quote: '"We cut our credit appraisal time from 2 days to 15 minutes while maintaining strict risk checks."'
    },
    agent: {
      id: 'agent',
      title: 'Field Collection Agent',
      subtitle: 'Fast, foolproof mobile app designed for high-stress outdoor routes',
      icon: <Smartphone size={24} />,
      badge: 'Mobile Field App',
      steps: [
        {
          num: '01',
          title: 'Instant Biometric Login',
          desc: 'Open the Android/iOS app with fingerprint or Face ID. Assigned daily route sequence loads automatically.'
        },
        {
          num: '02',
          title: '1-Tap Collection & GPS Tagging',
          desc: 'Arrive at the borrower’s shop or home. Tap collect — the app automatically stamps exact GPS coordinates and applies payment to oldest overdue.'
        },
        {
          num: '03',
          title: 'Instant QR / Photo Verification',
          desc: 'Scan the customer’s dynamic portal QR code or upload a payment receipt photo for zero-dispute proof.'
        },
        {
          num: '04',
          title: 'Bluetooth Thermal Print & Digital Handover',
          desc: 'Print an on-the-spot physical receipt or trigger WhatsApp slip. Hand over cash digitally to the manager at day end.'
        }
      ],
      quote: '"Even when I have zero network in narrow village gullies, the app saves my collections and syncs the moment I get signal."'
    },
    accountant: {
      id: 'accountant',
      title: 'Accounts & Audit Officer',
      subtitle: 'Double-entry precision, bank reconciliation, and RBI compliance',
      icon: <Users size={24} />,
      badge: 'Audit & Books',
      steps: [
        {
          num: '01',
          title: 'Automated Cashbook & Ledgers',
          desc: 'Every disbursement, collection, and penalty automatically posts double-entry debit/credit ledger vouchers.'
        },
        {
          num: '02',
          title: 'Financial Statements on Demand',
          desc: 'Generate real-time Profit & Loss (P&L), Balance Sheet, Trial Balance, and Cash Flow Statements.'
        },
        {
          num: '03',
          title: 'Automated RBI NPA Provisioning',
          desc: 'Inspect SMA-0 through Loss asset classification buckets with auto-calculated statutory provisioning.'
        },
        {
          num: '04',
          title: 'Quarterly Period Locking',
          desc: 'Lock audited periods to permanently prevent backdated entries or tampering.'
        }
      ],
      quote: '"Our statutory audit used to take 3 weeks of spreadsheet reconciliation. With Zolo Funds, it took 2 days."'
    }
  };

  const current = roles[activeRole];

  return (
    <section id="workflow" className="section" ref={sectionRef}>
      <div className="container">
        <div className="section-header animate-on-scroll">
          <div className="section-pill">Lending Operations Workflow</div>
          <h2 className="section-title">
            How Lending Firms Run <span className="gradient-text">On Zolo Funds</span>
          </h2>
          <p className="section-subtitle">
            Synchronize your owners, branch managers, collection boys, and accountants in an airtight, audited operational workflow.
          </p>
        </div>

        {/* Role Selectors */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
            marginBottom: '36px'
          }}
        >
          {Object.keys(roles).map((key) => {
            const role = roles[key];
            const isActive = activeRole === key;
            return (
              <button
                key={key}
                onClick={() => setActiveRole(key)}
                className="glass-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  textAlign: 'left',
                  border: isActive ? '2.5px solid var(--brand-purple)' : '1.5px solid var(--border-color)',
                  background: isActive ? 'var(--brand-purple-light)' : '#FFFFFF'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: isActive ? 'var(--brand-purple)' : 'var(--brand-purple-tint)',
                    color: isActive ? '#FFFFFF' : 'var(--brand-purple)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {role.icon}
                </div>
                <div>
                  <div style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-title)' }}>
                    {role.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--brand-purple)', fontWeight: 600 }}>
                    {role.badge}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Role Workflow Steps Container */}
        <div
          className="glass-card"
          style={{
            padding: '40px',
            border: '2px solid var(--brand-purple-border)',
            background: '#FFFFFF'
          }}
        >
          <div style={{ marginBottom: '28px' }}>
            <span className="zolo-pill-badge">
              {current.badge} Workflow
            </span>
            <h3 style={{ fontSize: '1.75rem', marginTop: '10px', marginBottom: '4px', color: 'var(--text-title)' }}>
              {current.title}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.02rem' }}>
              {current.subtitle}
            </p>
          </div>

          {/* 4 Steps Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '20px',
              marginBottom: '32px'
            }}
          >
            {current.steps.map((st, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-subtle)',
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1.5px solid var(--border-color)',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    fontSize: '1.7rem',
                    fontWeight: 900,
                    color: 'var(--brand-purple)',
                    lineHeight: 1,
                    marginBottom: '12px'
                  }}
                >
                  {st.num}
                </div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-title)' }}>
                  {st.title}
                </h4>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  {st.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Quote & CTA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              paddingTop: '20px',
              borderTop: '1.5px solid var(--border-subtle)'
            }}
          >
            <div style={{ fontStyle: 'italic', color: 'var(--text-body)', fontSize: '0.92rem', maxWidth: '650px' }}>
              {current.quote}
            </div>
            <button
              onClick={onOpenDemo}
              className="btn btn-primary"
              style={{ gap: '8px' }}
            >
              <span>See {current.title.split(' ')[0]} Screen In Demo</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

