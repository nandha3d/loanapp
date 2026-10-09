'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { usePortalUrls } from '@/lib/portalUrl';

interface NavbarProps {
  onOpenDemo: () => void;
}

export default function Navbar({ onOpenDemo }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const portalUrls = usePortalUrls();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: isScrolled ? 'rgba(255, 255, 255, 0.96)' : 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: isScrolled ? '1.5px solid var(--border-color)' : '1px solid var(--border-subtle)',
        boxShadow: isScrolled ? 'var(--shadow-sm)' : 'none',
        transition: 'all var(--transition-normal)'
      }}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '80px' }}>
        {/* Brand Logo - Purple horizontal logo for light background */}
        <Link href="/zolofunds" className="brand-logo-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src="/assets/logo-horizontal-for-light-bg.png"
            alt="Zolo Funds Logo"
            style={{ height: '42px', width: 'auto', display: 'block' }}
          />
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px'
          }}
          className="desktop-nav"
        >
          <a href="#verticals" className="nav-link" style={navLinkStyle}>Verticals</a>
          <a href="#features" className="nav-link" style={navLinkStyle}>Features</a>
          <a href="#calculator" className="nav-link" style={navLinkStyle}>EMI Calculator</a>
          <a href="#mobile" className="nav-link" style={navLinkStyle}>Field App</a>
          <a href="#workflow" className="nav-link" style={navLinkStyle}>How It Works</a>
          <a href="#pricing" className="nav-link" style={navLinkStyle}>Pricing</a>
          <a href="#faq" className="nav-link" style={navLinkStyle}>FAQ</a>
        </nav>

        {/* Action Controls: Login, Register, Book Demo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Login to Portal Button */}
          <Link
            href={portalUrls.login}
            className="btn btn-secondary"
            id="nav-login-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              fontSize: '0.88rem',
              fontWeight: 700
            }}
          >
            <LogIn size={15} />
            <span>Login</span>
          </Link>

          {/* Register New Account Button */}
          <Link
            href={portalUrls.register}
            className="btn btn-accent"
            id="nav-register-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              fontSize: '0.88rem',
              fontWeight: 800
            }}
          >
            <UserPlus size={15} />
            <span>Register</span>
          </Link>

          {/* Book Live Demo Button */}
          <button
            onClick={onOpenDemo}
            className="btn btn-primary"
            id="nav-demo-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 20px',
              fontSize: '0.88rem'
            }}
          >
            <span>Book Demo</span>
            <ArrowRight size={15} />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-toggle"
            aria-label="Toggle navigation menu"
            style={{
              display: 'none',
              width: '40px',
              height: '40px',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-purple)'
            }}
          >
            {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            background: '#FFFFFF',
            borderBottom: '2px solid var(--brand-purple)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: 'var(--shadow-lg)'
          }}
          className="mobile-drawer"
        >
          <a href="#verticals" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>Lending Verticals</a>
          <a href="#features" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>Core Features</a>
          <a href="#calculator" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>Interactive Loan Calculator</a>
          <a href="#mobile" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>Field Mobile App</a>
          <a href="#workflow" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>How It Works</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>Pricing & Plans</a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>Frequently Asked Questions</a>

          {/* Mobile Portal Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
            <Link
              href={portalUrls.login}
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-secondary"
              id="mobile-nav-login-btn"
              style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
            >
              <LogIn size={16} />
              <span>Login to Portal</span>
            </Link>

            <Link
              href={portalUrls.register}
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-accent"
              id="mobile-nav-register-btn"
              style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
            >
              <UserPlus size={16} />
              <span>Register New Lender Account</span>
            </Link>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenDemo();
              }}
              className="btn btn-primary"
              id="mobile-nav-demo-btn"
              style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
            >
              <span>Request Demo Walkthrough</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        .nav-link {
          transition: all var(--transition-fast);
        }
        .nav-link:hover {
          color: var(--brand-purple) !important;
          transform: translateY(-1px);
        }
        @media (max-width: 1040px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-toggle {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: '0.94rem',
  fontWeight: 700,
  color: 'var(--text-body)',
  cursor: 'pointer'
};

const mobileNavLinkStyle: React.CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
  color: 'var(--text-title)',
  padding: '6px 0',
  borderBottom: '1px solid var(--border-subtle)'
};
