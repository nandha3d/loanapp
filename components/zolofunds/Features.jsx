'use client';

import React, { useState } from 'react';
import { useScrollAnimation } from './hooks/useScrollAnimation';
import {
  UserCheck,
  Calculator,
  Compass,
  MapPin,
  QrCode,
  AlertOctagon,
  FileCheck,
  CreditCard,
  Building2,
  BookOpen,
  MessageSquare,
  Smartphone,
  Globe2,
  Lock,
  Share2,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';

export default function Features({ onOpenDemo }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedFeature, setSelectedFeature] = useState(null);
  const sectionRef = useScrollAnimation();

  const categories = [
    { id: 'all', label: 'All 16 Lender Modules' },
    { id: 'onboarding', label: 'KYC & Risk Appraisal' },
    { id: 'lending', label: 'Loans & Field Recovery' },
    { id: 'control', label: 'GPS & Fraud Guard' },
    { id: 'finance', label: 'Bureau & Compliance' },
    { id: 'platform', label: 'Mobile & Operations' }
  ];

  const features = [
    {
      id: 'kyc-management',
      category: 'onboarding',
      icon: <UserCheck size={26} />,
      title: 'Borrower KYC & Aadhaar Verification',
      badge: 'Capital Protection',
      summary: 'Protect your capital before disbursing. Complete digital profiling with instant Aadhaar OTP and Video KYC.',
      details: [
        'Instant Aadhaar OTP verification prevents fake identity fraud',
        'Remote Video KYC for contactless borrower verification',
        'Attach multiple guarantors with photos, ID proofs, and contact details',
        'Security cheques vault: track up to 5 Post-Dated Cheques (PDCs) per borrower',
        'Internal credit rating (300–850) calculated automatically from past repayment discipline',
        'Automated status monitoring: Active, Overdue, Closed, or Blacklisted'
      ]
    },
    {
      id: 'loan-engine',
      category: 'lending',
      icon: <Calculator size={26} />,
      title: '4-Model Flexible Loan Engine',
      badge: 'Margin Control',
      summary: 'Structure loans your way. Choose Flat Upfront, Upfront %, Flat EMI, or Reducing Balance interest models.',
      details: [
        '4 interest models: Flat Upfront, Upfront %, Flat EMI, Reducing Balance',
        '4 repayment schedules: Daily, Weekly, Bi-weekly, and Monthly cycles',
        'Unique automated loan codes (e.g. DL0001 for daily, ML0001 for monthly)',
        'Loan restructuring: spread overdue arrears across future instalments smoothly without loss',
        'Closing options: Normal closure, Renewal top-up, Pre-closure, and Foreclosure settlement',
        'One-click downloadable PDF loan statements & printable branded collection receipts'
      ]
    },
    {
      id: 'collections-waterfall',
      category: 'lending',
      icon: <Compass size={26} />,
      title: 'Waterfall Collections & Routes',
      badge: 'Zero Recovery Leakage',
      summary: 'Eliminate revenue loss. Payments automatically clear oldest overdue instalments before touching principal.',
      details: [
        'Daily route collection lists generated automatically for each field agent',
        'Smart waterfall distribution: clears oldest overdue interest and penalties first',
        'Multi-mode collection support: Cash, UPI QR, Cheques, and Bank Transfer',
        'End-of-day cash handover: agents hand over cash to manager with dual app sign-off',
        'Anti-duplicate payment guard prevents double recording in poor cellular reception zones',
        'Automated midnight sweep flags missed instalments with zero human effort'
      ]
    },
    {
      id: 'gps-geofence',
      category: 'control',
      icon: <MapPin size={26} />,
      title: 'GPS Tracking & Address Geofencing',
      badge: 'Field Oversight',
      summary: 'Every field collection is timestamped and geocoded with automatic address proximity checks.',
      details: [
        'Precise latitude & longitude stamped on every payment transaction',
        'Address proximity check flags suspicious collections made away from borrower home',
        'Live agent tracking map: see all your collection agents moving across routes in real-time',
        'Route progress monitor tracks completed stops vs remaining targets',
        'Agent location audit history prevents ghost collections and route manipulation'
      ]
    },
    {
      id: 'fraud-payment-proof',
      category: 'control',
      icon: <QrCode size={26} />,
      title: 'Dual-Mode Payment Verification',
      badge: 'Non-Repudiable',
      summary: 'Eliminate disputes of "I gave cash to your agent". Two foolproof verification modes.',
      details: [
        'Mode A (Single-Use Dynamic QR): Borrower generates instant QR on self-service portal; agent scans to verify payment',
        'Mode B (Photo Proof with Sign-off): Agent uploads photo; borrower approves/rejects on portal before posting to ledger',
        'Eliminates borrower disputes and agent theft completely',
        'Cryptographic HMAC signature ensures zero tampering of collection slips',
        'Instant WhatsApp confirmation triggered to borrower immediately after verification'
      ]
    },
    {
      id: 'penalty-engine',
      category: 'lending',
      icon: <AlertOctagon size={26} />,
      title: 'Automated Penalties & Waivers',
      badge: 'Yield Protection',
      summary: 'Automate late fees after customizable grace periods. Admin waivers require mandatory audit reasons.',
      details: [
        'Automated daily late fee accruals calculated immediately after grace period expires',
        'Configurable rules: grace period days, daily penalty fee, and maximum cap',
        'Supports partial or full settlement of penalties during collections',
        'Admin waiver workflow requires mandatory justification notes tracked in audit logs',
        'Complete chronological penalty history with timestamps'
      ]
    },
    {
      id: 'maker-checker',
      category: 'control',
      icon: <FileCheck size={26} />,
      title: 'Maker-Checker Approval Workflows',
      badge: 'Dual Control',
      summary: 'Prevent unauthorized loan disbursements with structured two-party approval controls.',
      details: [
        'Agent-created borrower registrations require manager review before loan disbursement',
        'Customer modifications feature side-by-side before/after comparison diffs',
        'Loan edits, collection corrections, and branch creations require admin approval',
        'Cash handovers must be accepted by the manager on their app',
        'Centralized pending approvals dashboard with one-click review and notes'
      ]
    },
    {
      id: 'credit-bureau',
      category: 'finance',
      icon: <CreditCard size={26} />,
      title: 'Direct CRIF & CIBIL Bureau Checks',
      badge: 'Risk Appraisal',
      summary: 'Check borrower credit history, active MFI loans, and overdue accounts directly before lending.',
      details: [
        'Direct API integration with India’s leading credit bureaus: CRIF & CIBIL',
        'Soft bureau check: evaluate creditworthiness with zero impact on borrower score',
        'Hard bureau pull for formal credit appraisal with inquiry logging',
        'Full credit report view: active MFI loans, overdue amounts, write-offs, and defaults',
        'Digital consent recording: captured via OTP or written form'
      ]
    },
    {
      id: 'rbi-npa-engine',
      category: 'finance',
      icon: <Building2 size={26} />,
      title: 'RBI-Compliant NPA Classification',
      badge: 'Automated Nightly',
      summary: 'Automated nightly classification across all 7 RBI asset buckets with built-in statutory provisioning.',
      details: [
        'Automated daily classification: Standard, SMA-0 (1-30d), SMA-1 (31-60d), SMA-2 (61-90d)',
        'NPA classification: Sub-Standard (91d-1yr), Doubtful (1-3yr), and Loss',
        'Built-in provisioning calculation according to RBI Master Directions for NBFCs',
        'Full asset upgrade/downgrade historical audit trail',
        'NPA aging report exportable to Excel and PDF for statutory compliance audits'
      ]
    },
    {
      id: 'double-entry-accounting',
      category: 'finance',
      icon: <BookOpen size={26} />,
      title: 'Double-Entry Accounting & Ledger',
      badge: 'P&L & Balance Sheet',
      summary: 'Replace external accounting software with automated loan cashbooks and real-time financial statements.',
      details: [
        'Standard Cashbook: automatically records every disbursement, collection, and penalty fee',
        'Premium Chart of Accounts with hierarchical general ledger codes',
        'Manual Journal Vouchers (JVs) for contra entries, expenses, and asset purchases',
        'Financial Statements: Profit & Loss (P&L), Balance Sheet, Trial Balance, and Cash Flow',
        'Bank Reconciliation module to match bank statements against ledger entries',
        'Period Locking: lock closed financial quarters to prevent backdated modifications'
      ]
    },
    {
      id: 'omnichannel-alerts',
      category: 'platform',
      icon: <MessageSquare size={26} />,
      title: 'SMS, WhatsApp & Push Alerts',
      badge: 'Automated Follow-ups',
      summary: 'Reduce field follow-up costs with automated payment due reminders and digital WhatsApp receipts.',
      details: [
        'Payment confirmation receipts sent immediately via WhatsApp and SMS (via MSG91)',
        'Upcoming payment due reminders (1-2 days in advance) sent automatically',
        'Overdue alerts and late fee notices triggered automatically',
        'Daily morning collection target and route summary sent to field agents',
        'Loan sanction letter and foreclosure settlement certificates delivered via WhatsApp'
      ]
    },
    {
      id: 'mobile-app-features',
      category: 'platform',
      icon: <Smartphone size={26} />,
      title: 'Native Mobile App For Field Staff',
      badge: 'Android & iOS',
      summary: 'Equip your collection boys with an offline-capable app with biometric lock and Bluetooth printing.',
      details: [
        'Biometric authentication with Fingerprint and Face ID support',
        'Offline storage: view routes and record collections even in zero-reception areas',
        'Direct camera capture for KYC documents, customer photos, and collateral inspection',
        'Integrated QR scanner for instant payment proof and UPI receipt verification',
        'Bluetooth thermal printer connectivity for printing spot receipts in the field'
      ]
    },
    {
      id: 'borrower-portal',
      category: 'platform',
      icon: <Globe2 size={26} />,
      title: 'Borrower Transparency Portal',
      badge: 'Reduced Calls',
      summary: 'Give your borrowers a private self-service portal to view balances and generate verification QRs.',
      details: [
        'Private customer login with mobile OTP verification',
        'Borrowers view repayment schedule, upcoming dues, and interest breakdown',
        'Download official loan statement PDFs and payment receipts anytime without calling staff',
        'Approve or reject collection photo proofs submitted by field agents',
        'Generate single-use verification QR code for field agent collections'
      ]
    },
    {
      id: 'multi-language',
      category: 'platform',
      icon: <Globe2 size={26} />,
      title: '6 Indian Languages Localization',
      badge: 'Field Adoption',
      summary: 'Empower your field agents in their local mother tongue across India.',
      details: [
        'Available in English, Hindi (हिंदी), Tamil (தமிழ்), Telugu (తెలుగు), Kannada (ಕನ್ನಡ), and Malayalam (മലയാളം)',
        'Field agent mobile app translates completely with one tap for effortless staff adoption',
        'Receipts and WhatsApp notifications dispatched in the borrower’s preferred language',
        'Configurable per-tenant default language for regional branch networks'
      ]
    },
    {
      id: 'tenant-security',
      category: 'control',
      icon: <Lock size={26} />,
      title: 'Enterprise Multi-Tenancy & Security',
      badge: 'Bank-Grade Isolation',
      summary: 'Strict data isolation ensures your loan book, borrower lists, and collections remain 100% confidential.',
      details: [
        'Row-level tenant isolation: strict separation between different finance companies',
        'Sensitive PII (Aadhaar, PAN, bureau records) encrypted with AES-256 encryption',
        'Role-Based Access Control (RBAC): Superadmin, Branch Admin, Field Agent, and Auditor',
        'Immutable audit logs record every single add, update, delete, and approval',
        'Cloud backups automated daily with 99.99% infrastructure uptime SLA'
      ]
    },
    {
      id: 'affiliate-program',
      category: 'platform',
      icon: <Share2 size={26} />,
      title: 'DSA & Referral Partner Engine',
      badge: 'Portfolio Growth',
      summary: 'Grow your lending firm by tracking DSA referral partners and commission payouts automatically.',
      details: [
        'Every referral partner or agent gets a unique tracking link',
        'Partner dashboard to monitor referred borrowers, conversions, and accrued commissions',
        'Automated commission tracking and payout ledgers directly linked to your accounting',
        'Helps finance firms expand loan origination through local networks'
      ]
    }
  ];

  const filteredFeatures =
    activeCategory === 'all'
      ? features
      : features.filter((f) => f.category === activeCategory);

  return (
    <section id="features" className="section section-alt" ref={sectionRef}>
      <div className="container">
        <div className="section-header animate-on-scroll">
          <div className="section-pill">16 Operational Modules</div>
          <h2 className="section-title">
            Complete Lending Capabilities for <span className="gradient-text">Indian Lenders</span>
          </h2>
          <p className="section-subtitle">
            Official catalog of features directly from our lending platform engine. Start free with 25 loans or scale to unlimited agents with zero hidden transaction percentages.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '40px'
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '9px 20px',
                borderRadius: 'var(--radius-full)',
                background: activeCategory === cat.id ? 'var(--brand-purple)' : '#FFFFFF',
                color: activeCategory === cat.id ? '#FFFFFF' : 'var(--text-title)',
                border: activeCategory === cat.id ? '2px solid var(--brand-purple)' : '1.5px solid var(--border-color)',
                fontSize: '0.88rem',
                fontWeight: 800,
                boxShadow: activeCategory === cat.id ? '0 4px 14px var(--brand-purple-glow)' : 'var(--shadow-sm)'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Feature Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '24px'
          }}
        >
          {filteredFeatures.map((feat, fi) => (
            <div
              key={feat.id}
              className={`glass-card animate-on-scroll delay-${Math.min((fi % 4) + 1, 6)}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '28px',
                border: '1.5px solid var(--border-color)',
                background: '#FFFFFF',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = 'var(--shadow-purple)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px'
                  }}
                >
                  <div className="icon-box" style={{ marginBottom: 0 }}>
                    {feat.icon}
                  </div>
                  <span className="zolo-pill-badge" style={{ fontSize: '0.74rem' }}>
                    {feat.badge}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text-title)' }}>
                  {feat.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '18px' }}>
                  {feat.summary}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {feat.details.slice(0, 3).map((d, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.84rem' }}>
                      <CheckCircle2 size={15} color="var(--brand-purple)" style={{ flexShrink: 0, marginTop: '3px' }} />
                      <span style={{ color: 'var(--text-body)', fontWeight: 500 }}>{d}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSelectedFeature(feat)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--brand-purple)',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--border-subtle)',
                  cursor: 'pointer'
                }}
              >
                <span>Read Full Specifications</span>
                <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Feature Detail Modal */}
        {selectedFeature && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(31, 7, 36, 0.7)',
              backdropFilter: 'blur(8px)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setSelectedFeature(null)}
          >
            <div
              className="glass-card"
              style={{
                maxWidth: '620px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '36px',
                position: 'relative',
                background: '#FFFFFF',
                border: '2px solid var(--brand-purple)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="icon-box" style={{ marginBottom: 0 }}>
                    {selectedFeature.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.35rem', color: 'var(--text-title)' }}>{selectedFeature.title}</h3>
                    <span className="zolo-pill-badge" style={{ fontSize: '0.72rem', marginTop: '4px' }}>
                      {selectedFeature.badge}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFeature(null)}
                  style={{
                    fontSize: '1.4rem',
                    color: 'var(--text-muted)',
                    padding: '8px',
                    lineHeight: 1,
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.96rem', lineHeight: 1.6, marginBottom: '22px' }}>
                {selectedFeature.summary}
              </p>

              <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px', color: 'var(--brand-purple)' }}>
                System Capabilities:
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                {selectedFeature.details.map((point, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'var(--brand-purple)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    >
                      ✓
                    </div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-body)', lineHeight: 1.5, fontWeight: 500 }}>
                      {point}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSelectedFeature(null)}
                  className="btn btn-secondary"
                  style={{ padding: '9px 18px', fontSize: '0.88rem' }}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setSelectedFeature(null);
                    onOpenDemo();
                  }}
                  className="btn btn-primary"
                  style={{ padding: '9px 20px', fontSize: '0.88rem' }}
                >
                  Schedule Demo For This Module
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

