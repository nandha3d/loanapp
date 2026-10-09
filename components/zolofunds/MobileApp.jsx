'use client';

import React from 'react';
import { Smartphone, WifiOff, Camera, Printer, Fingerprint, MapPin, QrCode, ArrowRight } from 'lucide-react';
import { useScrollAnimation } from './hooks/useScrollAnimation';

export default function MobileApp({ onOpenDemo }) {
  const sectionRef = useScrollAnimation();
  const mobileFeatures = [
    {
      icon: <Fingerprint size={22} />,
      title: 'Biometric Agent Login',
      desc: 'Ensure only your authorized collection agent can access assigned borrower records using fingerprint or Face ID.'
    },
    {
      icon: <WifiOff size={22} />,
      title: 'Offline Collection Storage',
      desc: 'Agents can collect payments in remote villages with zero cellular reception. Data syncs automatically once reconnected.'
    },
    {
      icon: <Camera size={22} />,
      title: 'Spot Camera KYC Capture',
      desc: 'Agents take borrower photos, Aadhaar cards, vehicle RC books, and collateral directly from the camera into your secure cloud.'
    },
    {
      icon: <Printer size={22} />,
      title: 'Bluetooth Thermal Printing',
      desc: 'Connect to standard 2-inch and 3-inch ESC/POS portable printers to issue official paper receipts on the spot.'
    },
    {
      icon: <MapPin size={22} />,
      title: 'GPS Background Geocoding',
      desc: 'Automatic location stamps verify where the collection happened, alerting you immediately on any off-route payments.'
    },
    {
      icon: <QrCode size={22} />,
      title: 'Payment QR Code Verification',
      desc: 'Scan borrower portal dynamic QR codes or display your company UPI QR on screen for instant payment verification.'
    }
  ];

  return (
    <section id="mobile" className="section section-alt" ref={sectionRef}>
      <div className="container">
        <div className="section-header animate-on-scroll">
          <div className="section-pill">Field Force Control</div>
          <h2 className="section-title">
            Equip Your Field Agents With An <span className="gradient-text">Offline Collection App</span>
          </h2>
          <p className="section-subtitle">
            Control your collection routes, stop agent cash leakage, and monitor live stops from your central office. Designed specifically for outdoor high-speed recovery operations.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '40px',
            alignItems: 'center'
          }}
        >
          {/* Left: Vector Illustration Frame */}
          <div
            className="vector-illustration-frame"
            style={{
              padding: '16px',
              border: '2px solid var(--brand-purple-border)'
            }}
          >
            <img
              src="/assets/illustrations/field_agent.jpg"
              alt="Field Collection Agent with QR payment and GPS route"
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '16px',
                display: 'block'
              }}
            />
          </div>

          {/* Right: Feature Highlights & CTA */}
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '18px',
                marginBottom: '32px'
              }}
            >
              {mobileFeatures.map((feat, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    background: '#FFFFFF',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1.5px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'var(--brand-purple-tint)',
                      color: 'var(--brand-purple)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {feat.icon}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.94rem', fontWeight: 800, marginBottom: '4px', color: 'var(--text-title)' }}>
                      {feat.title}
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                      {feat.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={onOpenDemo}
                className="btn btn-primary"
                style={{ gap: '8px' }}
              >
                <span>Request Agent App Demo APK</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

