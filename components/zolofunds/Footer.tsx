'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Mail, Phone, LogIn, UserPlus } from 'lucide-react';
import { usePortalUrls } from '@/lib/portalUrl';

interface FooterProps {
  onOpenDemo: () => void;
}

export default function Footer({ onOpenDemo }: FooterProps) {
  const portalUrls = usePortalUrls();
  return (
    <footer
      style={{
        background: '#FAF1FB',
        color: '#4A324E',
        padding: '70px 0 36px 0',
        borderTop: '3px solid var(--brand-purple)',
        position: 'relative'
      }}
    >
      <div className="container">
        {/* Main Footer Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '36px',
            marginBottom: '48px'
          }}
        >
          {/* Brand Info Column */}
          <div style={{ maxWidth: '320px' }}>
            <div style={{ marginBottom: '18px' }}>
              <Link href="/zolofunds">
                <img
                  src="/assets/logo-horizontal-for-light-bg.png"
                  alt="Zolo Funds Logo"
                  style={{ height: '42px', width: 'auto', display: 'block' }}
                />
              </Link>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '18px' }}>
              The unified lending and field collection management operating system for Indian Microfinance, Auto Finance, and Chit Fund operations.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#059669', fontWeight: 700 }}>
              <ShieldCheck size={16} />
              <span>RBI NPA Norms Aligned · AES-256 Encrypted</span>
            </div>
          </div>

          {/* Lending Verticals */}
          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--brand-purple)', marginBottom: '16px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              LENDING VERTICALS
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
              <a href="#verticals" style={footerLinkStyle}>Microfinance & Daily Collections</a>
              <a href="#verticals" style={footerLinkStyle}>Auto & Vehicle Financing</a>
              <a href="#verticals" style={footerLinkStyle}>Chit Fund Operations & Auctions</a>
              <a href="#verticals" style={footerLinkStyle}>Gold Loans & Collateral Vault</a>
            </div>
          </div>

          {/* Core Modules */}
          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--brand-purple)', marginBottom: '16px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              CORE PLATFORM
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
              <a href="#features" style={footerLinkStyle}>Customer KYC & Aadhaar OTP</a>
              <a href="#features" style={footerLinkStyle}>Smart Waterfall Collections</a>
              <a href="#features" style={footerLinkStyle}>GPS Geofence Route Tracking</a>
              <a href="#features" style={footerLinkStyle}>Single-Use QR Payment Proof</a>
              <a href="#features" style={footerLinkStyle}>CRIF & CIBIL Bureau Checks</a>
              <a href="#features" style={footerLinkStyle}>Automated RBI NPA Buckets</a>
            </div>
          </div>

          {/* Quick Portal Access */}
          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--brand-purple)', marginBottom: '16px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              PORTAL ACCESS
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
              <Link href={portalUrls.login} style={{ ...footerLinkStyle, display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--brand-purple)', fontWeight: 700 }}>
                <LogIn size={14} />
                <span>Login to Staff Portal</span>
              </Link>
              <Link href={portalUrls.register} style={{ ...footerLinkStyle, display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--brand-purple)', fontWeight: 700 }}>
                <UserPlus size={14} />
                <span>Register New Company</span>
              </Link>
              <Link href="/borrower" style={footerLinkStyle}>
                Borrower Self-Service
              </Link>
              <button
                onClick={onOpenDemo}
                style={{
                  ...footerLinkStyle,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--brand-purple)'
                }}
              >
                Book Live Walkthrough →
              </button>
            </div>
          </div>

          {/* Regional Support & Contact */}
          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--brand-purple)', marginBottom: '16px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              REGIONAL SUPPORT
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' }}>
              {['English', 'हिंदी', 'தமிழ்', 'తెలుగు', 'ಕನ್ನಡ', 'മലയാളം'].map((lang, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#FFFFFF',
                    border: '1px solid var(--brand-purple-border)',
                    color: 'var(--brand-purple)'
                  }}
                >
                  {lang}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem', color: 'var(--text-body)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={15} color="var(--brand-purple)" />
                <span style={{ fontWeight: 600 }}>+91 98400 12345 (Sales & Demo)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={15} color="var(--brand-purple)" />
                <span style={{ fontWeight: 600 }}>contact@zolofunds.com</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            paddingTop: '24px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}
        >
          <div>
            © {new Date().getFullYear()} Zolo Funds (India) Technologies Private Limited. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '18px' }}>
            <Link href={portalUrls.login} style={{ color: 'inherit' }}>Portal Login</Link>
            <Link href={portalUrls.register} style={{ color: 'inherit' }}>Sign Up</Link>
            <a href="#pricing" style={{ color: 'inherit' }}>Pricing</a>
            <a href="#faq" style={{ color: 'inherit' }}>RBI Guidelines</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

const footerLinkStyle: React.CSSProperties = {
  color: 'var(--text-body)',
  fontWeight: 600,
  transition: 'color 0.2s',
  textDecoration: 'none'
};
