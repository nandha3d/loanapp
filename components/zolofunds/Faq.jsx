'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useScrollAnimation } from './hooks/useScrollAnimation';

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0);
  const sectionRef = useScrollAnimation();

  const faqs = [
    {
      q: 'How does Zolo Funds prevent field collection agents from pocketing collected cash?',
      a: 'Zolo Funds uses a 3-layer anti-theft system: 1) Every collection requires GPS verification within the borrower\'s home radius; 2) The customer generates a dynamic single-use QR code or receives an instant WhatsApp confirmation slip; 3) At the end of the day, the agent must complete a digital cash handover on the app, which the manager verifies and accepts before the agent\'s route is closed.'
    },
    {
      q: 'Can we import our existing borrower ledgers and active loans from Excel?',
      a: 'Yes. Zolo Funds provides one-click CSV and Excel import templates for customer KYC, active loan balances, and payment schedules. Our dedicated technical team assists your firm in importing and reconciling your historical loan book within 24 to 48 hours.'
    },
    {
      q: 'How does GPS geofencing stop collection boys from faking customer visits?',
      a: 'When an agent taps "Collect", the mobile app automatically captures the smartphone\'s satellite coordinates and timestamp. If an agent tries to record a payment while sitting in a tea stall or at home, the system immediately flags the collection as "Off-Route / Geofence Discrepancy" on the owner dashboard.'
    },
    {
      q: 'How do direct CRIF & CIBIL bureau checks help us before loan disbursement?',
      a: 'With one click, your credit officer can pull an applicant\'s official credit history. The report shows active loans with other MFIs, overdue amounts, write-offs, and past defaults. You can perform a "Soft Check" (which does not affect the applicant\'s credit score) or a formal "Hard Pull".'
    },
    {
      q: 'How does the platform ensure our firm stays compliant with RBI NPA norms?',
      a: 'Every night at 00:00, Zolo Funds automatically scans your active portfolio and buckets accounts into Standard, SMA-0 (1–30 days overdue), SMA-1 (31–60 days), SMA-2 (61–90 days), Sub-Standard, Doubtful, and Loss. It also calculates required statutory provisioning based on RBI Master Directions for NBFCs.'
    },
    {
      q: 'Can I control which staff members can disburse loans, edit rates, or waive penalties?',
      a: 'Yes. Zolo Funds features strict Role-Based Access Control (RBAC) and maker-checker approval workflows. Field agents can only collect and register customer leads. Only authorized managers or superadmins can approve loans, alter interest rates, or grant penalty waivers (with mandatory reason tracking in the audit log).'
    },
    {
      q: 'What hardware do our field collection boys need to carry?',
      a: 'Any standard Android smartphone (Android 8.0+) or iPhone. The app is lightweight and works offline. If your borrowers demand physical paper receipts, the phone connects via Bluetooth to standard 2-inch or 3-inch ESC/POS portable thermal printers.'
    },
    {
      q: 'Is my lending firm\'s customer data and loan book isolated from other lenders?',
      a: 'Yes, 100%. Zolo Funds uses strict multi-tenant database row-level isolation and AES-256 bank-grade field-level encryption for all sensitive PII (Aadhaar, PAN, bureau records). Your loan book is completely private and accessible only by your authenticated users.'
    }
  ];

  return (
    <section id="faq" className="section" ref={sectionRef}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <div className="section-header animate-on-scroll">
          <div className="section-pill">Lender FAQs</div>
          <h2 className="section-title">
            Frequently Asked <span className="gradient-text">Lender Questions</span>
          </h2>
          <p className="section-subtitle">
            Get clear, direct answers about field agent oversight, compliance, data migration, and cash handover controls.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className={`glass-card animate-on-scroll delay-${Math.min(idx + 1, 6)}`}
                style={{
                  padding: '22px 26px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  border: isOpen ? '2px solid var(--brand-purple)' : '1.5px solid var(--border-color)',
                  background: '#FFFFFF',
                  transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                }}
                onClick={() => setOpenIndex(isOpen ? -1 : idx)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px'
                  }}
                >
                  <h3
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: isOpen ? 'var(--brand-purple)' : 'var(--text-title)',
                      lineHeight: 1.4,
                      transition: 'color 0.3s ease'
                    }}
                  >
                    {faq.q}
                  </h3>
                  <div
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      color: 'var(--brand-purple)',
                      flexShrink: 0
                    }}
                  >
                    <ChevronDown size={20} />
                  </div>
                </div>

                {/* Smooth accordion animation */}
                <div
                  style={{
                    maxHeight: isOpen ? '300px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
                    opacity: isOpen ? 1 : 0
                  }}
                >
                  <p
                    style={{
                      marginTop: '14px',
                      color: 'var(--text-muted)',
                      fontSize: '0.92rem',
                      lineHeight: 1.65,
                      borderTop: '1.5px solid var(--border-subtle)',
                      paddingTop: '14px'
                    }}
                  >
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

