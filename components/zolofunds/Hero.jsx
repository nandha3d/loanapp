'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, MapPin, CheckCircle2, TrendingUp, Smartphone, Users, Zap, Wifi, Bell, BarChart3, LogIn, UserPlus } from 'lucide-react';
import { usePortalUrls } from '@/lib/portalUrl';

/* ─── Animated Counter Hook ─── */
function useCounter(target, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!startOnView) { setStarted(true); }
  }, [startOnView]);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, target, duration]);

  return { count, ref };
}

export default function Hero({ onOpenDemo }) {
  const portalUrls = usePortalUrls();
  const [visibleCards, setVisibleCards] = useState([]);
  const [gpsPulse, setGpsPulse] = useState(false);
  const heroRef = useRef(null);

  const recoveryCounter = useCounter(98, 1800);
  const agentCounter = useCounter(12, 1200);
  const collectionCounter = useCounter(847, 2200);

  // Stagger in floating cards
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const delays = [300, 700, 1100, 1600, 2100, 2600];
          delays.forEach((d, i) => {
            setTimeout(() => setVisibleCards(prev => [...prev, i]), d);
          });
          setGpsPulse(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (heroRef.current) obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      style={{
        position: 'relative',
        paddingTop: '135px',
        paddingBottom: '85px',
        background: 'radial-gradient(circle at 65% 15%, #F9EDFA 0%, #FFFFFF 65%)',
        overflow: 'hidden'
      }}
    >
      {/* Subtle animated background particles */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none', overflow: 'hidden', zIndex: 0
      }}>
        <div className="hero-particle p1" />
        <div className="hero-particle p2" />
        <div className="hero-particle p3" />
      </div>

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '48px',
            alignItems: 'center'
          }}
        >
          {/* Left Column: Focused 100% on the Lender */}
          <div>
            {/* Top Pill Badge */}
            <div
              className="section-pill hero-badge-anim"
              style={{
                marginBottom: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span className="hero-live-dot" />
              <span>Lending Operations Software</span>
              <span
                className="zolo-pill-badge"
                style={{ padding: '2px 8px', fontSize: '0.72rem', marginLeft: '4px' }}
              >
                For Lenders
              </span>
            </div>

            {/* Main Headline for Lenders */}
            <h1
              style={{
                fontSize: 'clamp(2.3rem, 4.2vw, 3.4rem)',
                fontWeight: 900,
                lineHeight: 1.18,
                marginBottom: '20px',
                color: 'var(--text-title)'
              }}
            >
              The Operating System Built For Indian <span className="gradient-text">Lenders & Financiers</span>
            </h1>

            {/* Subtitle - Lender Focused */}
            <p
              style={{
                fontSize: 'clamp(1.05rem, 1.6vw, 1.18rem)',
                color: 'var(--text-muted)',
                lineHeight: 1.68,
                marginBottom: '32px'
              }}
            >
              Stop field agent cash theft, eliminate messy paper ledgers, and automate your daily recovery routes. <strong>Zolo Funds</strong> gives finance business owners complete visibility over capital deployed, GPS-verified agent collections, instant CRIF/CIBIL bureau checks, and automated RBI NPA tracking.
            </p>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                flexWrap: 'wrap',
                marginBottom: '20px'
              }}
            >
              <button
                onClick={onOpenDemo}
                className="btn btn-primary hero-btn-pulse"
                style={{ padding: '14px 28px', fontSize: '1rem', gap: '8px' }}
              >
                <span>Book Live Demo</span>
                <ArrowRight size={17} />
              </button>

              <Link
                href={portalUrls.register}
                className="btn btn-accent"
                style={{ padding: '14px 26px', fontSize: '1rem', gap: '8px' }}
              >
                <UserPlus size={17} />
                <span>Register Account</span>
              </Link>

              <Link
                href={portalUrls.login}
                className="btn btn-secondary"
                style={{ padding: '14px 22px', fontSize: '1rem', gap: '8px' }}
              >
                <LogIn size={17} color="var(--brand-purple)" />
                <span>Login to Portal</span>
              </Link>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', fontSize: '0.9rem' }}>
              <a
                href="#calculator"
                style={{ color: 'var(--brand-purple)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <TrendingUp size={15} />
                <span>Try interactive EMI calculator below ↓</span>
              </a>
            </div>

            {/* Key Value Propositions For Lenders */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                paddingTop: '20px',
                borderTop: '1.5px solid var(--border-color)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: 'var(--text-body)', fontWeight: 700 }}>
                <CheckCircle2 size={18} color="var(--brand-purple)" />
                <span>Stop Agent Cash Theft & Leakage</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: 'var(--text-body)', fontWeight: 700 }}>
                <CheckCircle2 size={18} color="var(--brand-purple)" />
                <span>Instant CRIF & CIBIL Bureau Checks</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: 'var(--text-body)', fontWeight: 700 }}>
                <CheckCircle2 size={18} color="var(--brand-purple)" />
                <span>GPS Location-Stamped Collections</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: 'var(--text-body)', fontWeight: 700 }}>
                <CheckCircle2 size={18} color="var(--brand-purple)" />
                <span>Automated Nightly RBI NPA Buckets</span>
              </div>
            </div>
          </div>

          {/* Right Column: Animated Infographic Illustration */}
          <div ref={heroRef} style={{ position: 'relative' }}>

            {/* Main Image Container with Infographic Overlays */}
            <div
              className="hero-illustration-container"
              style={{
                position: 'relative',
                borderRadius: '28px',
                overflow: 'visible',
                marginBottom: '20px'
              }}
            >
              {/* The original image with subtle float animation */}
              <div
                className="vector-illustration-frame hero-img-float"
                style={{
                  border: '2px solid var(--border-color)',
                  padding: '12px',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                <img
                  src="/assets/illustrations/hero.jpg"
                  alt="Zolo Funds Lending Dashboard for Finance Business Owners"
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: '16px',
                    display: 'block'
                  }}
                />
              </div>

              {/* ─── FLOATING INFOGRAPHIC OVERLAYS ─── */}

              {/* 1. GPS Pulse Ring — top right of image */}
              <div
                className={`hero-float-card ${visibleCards.includes(0) ? 'visible' : ''}`}
                style={{
                  position: 'absolute',
                  top: '-12px',
                  right: '-8px',
                  zIndex: 10
                }}
              >
                <div className="hero-gps-badge">
                  <div className={`hero-gps-pulse-ring ${gpsPulse ? 'active' : ''}`} />
                  <div className={`hero-gps-pulse-ring ring2 ${gpsPulse ? 'active' : ''}`} />
                  <div className="hero-gps-dot">
                    <MapPin size={14} color="#fff" />
                  </div>
                  <span className="hero-gps-label">GPS Active</span>
                </div>
              </div>

              {/* 2. Collection Verified Notification — left side */}
              <div
                className={`hero-float-card ${visibleCards.includes(1) ? 'visible' : ''}`}
                style={{
                  position: 'absolute',
                  top: '18%',
                  left: '-30px',
                  zIndex: 10
                }}
              >
                <div className="hero-notif-card">
                  <div className="hero-notif-icon success">
                    <CheckCircle2 size={16} color="#fff" />
                  </div>
                  <div>
                    <div className="hero-notif-title">Collection Verified</div>
                    <div className="hero-notif-sub">₹2,450 · GPS Matched ✓</div>
                  </div>
                </div>
              </div>

              {/* 3. Animated Mini Bar Chart — bottom left */}
              <div
                className={`hero-float-card ${visibleCards.includes(2) ? 'visible' : ''}`}
                style={{
                  position: 'absolute',
                  bottom: '8%',
                  left: '-24px',
                  zIndex: 10
                }}
              >
                <div className="hero-chart-card">
                  <div className="hero-chart-header">
                    <BarChart3 size={14} color="var(--brand-purple)" />
                    <span>Weekly Recovery</span>
                  </div>
                  <div className="hero-mini-bars">
                    <div className="hero-bar" style={{ '--bar-h': '45%', '--bar-delay': '0.1s' }} />
                    <div className="hero-bar" style={{ '--bar-h': '70%', '--bar-delay': '0.2s' }} />
                    <div className="hero-bar" style={{ '--bar-h': '55%', '--bar-delay': '0.3s' }} />
                    <div className="hero-bar accent" style={{ '--bar-h': '90%', '--bar-delay': '0.4s' }} />
                    <div className="hero-bar" style={{ '--bar-h': '75%', '--bar-delay': '0.5s' }} />
                    <div className="hero-bar" style={{ '--bar-h': '60%', '--bar-delay': '0.6s' }} />
                    <div className="hero-bar accent" style={{ '--bar-h': '95%', '--bar-delay': '0.7s' }} />
                  </div>
                  <div className="hero-chart-footer">
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                  </div>
                </div>
              </div>

              {/* 4. Live Agent Tracker — right side mid */}
              <div
                className={`hero-float-card ${visibleCards.includes(3) ? 'visible' : ''}`}
                style={{
                  position: 'absolute',
                  top: '55%',
                  right: '-20px',
                  zIndex: 10
                }}
              >
                <div className="hero-agent-card">
                  <div className="hero-agent-header">
                    <div className="hero-agent-avatar">
                      <Smartphone size={13} color="#fff" />
                    </div>
                    <div>
                      <div className="hero-agent-name">Agent Suresh K.</div>
                      <div className="hero-agent-route">Route: Jayanagar 4th Block</div>
                    </div>
                  </div>
                  <div className="hero-agent-progress">
                    <div className="hero-agent-progress-bar">
                      <div className="hero-agent-progress-fill" />
                    </div>
                    <span className="hero-agent-progress-text">8/12 Stops</span>
                  </div>
                </div>
              </div>

              {/* 5. NPA Alert Badge — top left */}
              <div
                className={`hero-float-card ${visibleCards.includes(4) ? 'visible' : ''}`}
                style={{
                  position: 'absolute',
                  top: '42%',
                  left: '-18px',
                  zIndex: 10
                }}
              >
                <div className="hero-npa-badge">
                  <ShieldCheck size={15} color="#059669" />
                  <div>
                    <div className="hero-npa-title">NPA Classification</div>
                    <div className="hero-npa-val">Standard ✓</div>
                  </div>
                </div>
              </div>

              {/* 6. Animated Ring/Donut Chart — bottom right */}
              <div
                className={`hero-float-card ${visibleCards.includes(5) ? 'visible' : ''}`}
                style={{
                  position: 'absolute',
                  bottom: '-10px',
                  right: '-16px',
                  zIndex: 10
                }}
              >
                <div className="hero-donut-card">
                  <svg viewBox="0 0 60 60" className="hero-donut-svg">
                    <circle cx="30" cy="30" r="24" fill="none" stroke="var(--brand-purple-tint)" strokeWidth="6" />
                    <circle
                      cx="30" cy="30" r="24" fill="none"
                      stroke="var(--brand-purple)" strokeWidth="6"
                      strokeDasharray="150.8"
                      strokeDashoffset="150.8"
                      strokeLinecap="round"
                      className="hero-donut-progress"
                      transform="rotate(-90 30 30)"
                    />
                    <text x="30" y="33" textAnchor="middle" fontSize="11" fontWeight="900" fill="var(--brand-purple)">
                      {recoveryCounter.count}%
                    </text>
                  </svg>
                  <div className="hero-donut-label">Hit Rate</div>
                </div>
              </div>
            </div>

            {/* Real-time Lender Command Card — kept but enhanced */}
            <div
              className="glass-card hero-command-card"
              ref={recoveryCounter.ref}
              style={{
                padding: '20px 24px',
                border: '2px solid var(--brand-purple-border)',
                background: 'rgba(255, 255, 255, 0.95)',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="hero-live-dot" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--brand-purple)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Lender Executive Command Center
                  </span>
                </div>
                <span className="zolo-pill-badge" style={{ fontSize: '0.72rem' }}>
                  Owner Dashboard
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Daily Recovery Hit-Rate</div>
                  <div ref={recoveryCounter.ref} style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-purple)' }}>
                    {recoveryCounter.count}.2%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>Zero Cash Discrepancy</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Field Route Agents</div>
                  <div ref={agentCounter.ref} style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-title)' }}>
                    {agentCounter.count} Active
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>GPS Geofence Verified</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Today's Collections</div>
                  <div ref={collectionCounter.ref} style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-purple)' }}>
                    ₹{collectionCounter.count.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>
                    <span className="hero-counter-tick">↑</span> 12% vs Yesterday
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scoped Animation Styles */}
      <style>{`
        /* ── Background Particles ── */
        .hero-particle {
          position: absolute;
          border-radius: 50%;
          opacity: 0.15;
          pointer-events: none;
        }
        .hero-particle.p1 {
          width: 320px; height: 320px;
          background: radial-gradient(circle, var(--brand-purple) 0%, transparent 70%);
          top: -80px; right: 10%;
          animation: heroParticleFloat 8s ease-in-out infinite;
        }
        .hero-particle.p2 {
          width: 200px; height: 200px;
          background: radial-gradient(circle, #F59E0B 0%, transparent 70%);
          bottom: 20%; left: 5%;
          animation: heroParticleFloat 10s ease-in-out 2s infinite;
        }
        .hero-particle.p3 {
          width: 160px; height: 160px;
          background: radial-gradient(circle, var(--brand-purple) 0%, transparent 70%);
          top: 50%; right: 30%;
          animation: heroParticleFloat 12s ease-in-out 4s infinite;
        }
        @keyframes heroParticleFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 15px) scale(0.9); }
        }

        /* ── Badge Animation ── */
        .hero-badge-anim {
          animation: heroBadgePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
        }
        @keyframes heroBadgePop {
          from { opacity: 0; transform: translateY(-10px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Live Pulsing Dot ── */
        .hero-live-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #10B981;
          position: relative;
          animation: heroDotPulse 2s ease-in-out infinite;
        }
        .hero-live-dot::after {
          content: '';
          position: absolute;
          top: -3px; left: -3px;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.3);
          animation: heroDotRing 2s ease-in-out infinite;
        }
        @keyframes heroDotPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes heroDotRing {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.6); opacity: 0; }
        }

        /* ── Button Pulse ── */
        .hero-btn-pulse {
          position: relative;
          overflow: visible;
        }
        .hero-btn-pulse::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: inherit;
          background: transparent;
          border: 2px solid var(--brand-purple);
          opacity: 0;
          animation: heroBtnPulse 2.5s ease-in-out infinite 1s;
        }
        @keyframes heroBtnPulse {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.08); opacity: 0; }
        }

        /* ── Image Float ── */
        .hero-img-float {
          animation: heroImgFloat 6s ease-in-out infinite;
        }
        @keyframes heroImgFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        /* ── Floating Card Base ── */
        .hero-float-card {
          opacity: 0;
          transform: translateY(20px) scale(0.9);
          transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
          filter: drop-shadow(0 8px 24px rgba(125, 40, 126, 0.15));
        }
        .hero-float-card.visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        /* ── GPS Pulse Badge ── */
        .hero-gps-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          padding: 8px 14px;
          border-radius: 30px;
          border: 2px solid var(--brand-purple);
          position: relative;
          box-shadow: 0 4px 16px rgba(125, 40, 126, 0.18);
        }
        .hero-gps-dot {
          width: 26px; height: 26px;
          border-radius: 50%;
          background: var(--brand-purple);
          display: flex; align-items: center; justify-content: center;
          position: relative;
          z-index: 2;
        }
        .hero-gps-pulse-ring {
          position: absolute;
          top: 50%; left: 13px;
          width: 26px; height: 26px;
          border-radius: 50%;
          border: 2px solid var(--brand-purple);
          transform: translate(-50%, -50%) scale(1);
          opacity: 0;
        }
        .hero-gps-pulse-ring.active {
          animation: gpsPulseRing 2s ease-out infinite;
        }
        .hero-gps-pulse-ring.ring2.active {
          animation: gpsPulseRing 2s ease-out 0.6s infinite;
        }
        @keyframes gpsPulseRing {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
          100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
        }
        .hero-gps-label {
          font-size: 0.78rem;
          font-weight: 800;
          color: var(--brand-purple);
          letter-spacing: 0.02em;
        }

        /* ── Notification Card ── */
        .hero-notif-card {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff;
          padding: 10px 16px;
          border-radius: 14px;
          border: 1.5px solid var(--border-color);
          min-width: 195px;
          animation: heroNotifBounce 3s ease-in-out 2s infinite;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        @keyframes heroNotifBounce {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-4px); }
        }
        .hero-notif-icon {
          width: 30px; height: 30px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .hero-notif-icon.success { background: #059669; }
        .hero-notif-title {
          font-size: 0.78rem;
          font-weight: 800;
          color: var(--text-title);
          line-height: 1.2;
        }
        .hero-notif-sub {
          font-size: 0.68rem;
          color: #059669;
          font-weight: 700;
        }

        /* ── Mini Bar Chart ── */
        .hero-chart-card {
          background: #fff;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1.5px solid var(--border-color);
          min-width: 180px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        .hero-chart-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
          font-size: 0.72rem;
          font-weight: 800;
          color: var(--brand-purple);
        }
        .hero-mini-bars {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 42px;
        }
        .hero-bar {
          flex: 1;
          background: var(--brand-purple-tint);
          border-radius: 3px 3px 0 0;
          height: 0%;
          animation: heroBarGrow 1s ease-out var(--bar-delay, 0s) forwards;
        }
        .hero-bar.accent {
          background: var(--brand-purple);
        }
        @keyframes heroBarGrow {
          from { height: 0%; }
          to { height: var(--bar-h, 50%); }
        }
        .hero-chart-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          font-size: 0.55rem;
          color: var(--text-dim);
          font-weight: 600;
        }

        /* ── Agent Tracker Card ── */
        .hero-agent-card {
          background: #fff;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1.5px solid var(--border-color);
          min-width: 185px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        .hero-agent-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .hero-agent-avatar {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: var(--brand-purple);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .hero-agent-name {
          font-size: 0.76rem;
          font-weight: 800;
          color: var(--text-title);
          line-height: 1.2;
        }
        .hero-agent-route {
          font-size: 0.62rem;
          color: var(--text-dim);
          font-weight: 600;
        }
        .hero-agent-progress {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hero-agent-progress-bar {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: var(--brand-purple-tint);
          overflow: hidden;
        }
        .hero-agent-progress-fill {
          height: 100%;
          width: 0%;
          border-radius: 3px;
          background: linear-gradient(90deg, var(--brand-purple) 0%, #A232A4 100%);
          animation: heroProgressFill 2s ease-out 1.8s forwards;
        }
        @keyframes heroProgressFill {
          from { width: 0%; }
          to { width: 67%; }
        }
        .hero-agent-progress-text {
          font-size: 0.65rem;
          font-weight: 800;
          color: var(--brand-purple);
          white-space: nowrap;
        }

        /* ── NPA Badge ── */
        .hero-npa-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1.5px solid #D1FAE5;
          box-shadow: 0 4px 16px rgba(5, 150, 105, 0.1);
          animation: heroNpaBounce 4s ease-in-out 3s infinite;
        }
        @keyframes heroNpaBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .hero-npa-title {
          font-size: 0.65rem;
          color: var(--text-dim);
          font-weight: 700;
        }
        .hero-npa-val {
          font-size: 0.78rem;
          font-weight: 900;
          color: #059669;
        }

        /* ── Donut Chart ── */
        .hero-donut-card {
          background: #fff;
          padding: 10px;
          border-radius: 14px;
          border: 1.5px solid var(--border-color);
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          width: 82px;
        }
        .hero-donut-svg {
          width: 58px;
          height: 58px;
        }
        .hero-donut-progress {
          animation: heroDonutFill 2s ease-out 2.5s forwards;
        }
        @keyframes heroDonutFill {
          from { stroke-dashoffset: 150.8; }
          to { stroke-dashoffset: 3; }
        }
        .hero-donut-label {
          font-size: 0.62rem;
          font-weight: 800;
          color: var(--brand-purple);
          margin-top: 2px;
        }

        /* ── Command Card Entrance ── */
        .hero-command-card {
          animation: heroCardSlideUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both;
        }
        @keyframes heroCardSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Counter Tick ── */
        .hero-counter-tick {
          display: inline-block;
          animation: heroTickBounce 1s ease-in-out infinite;
          color: #059669;
        }
        @keyframes heroTickBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        /* ── Responsive Adjustments ── */
        @media (max-width: 768px) {
          .hero-float-card {
            transform: translateY(15px) scale(0.85) !important;
          }
          .hero-float-card.visible {
            transform: translateY(0) scale(0.85) !important;
          }
          .hero-notif-card { min-width: 160px; }
          .hero-chart-card { min-width: 150px; }
          .hero-agent-card { min-width: 155px; }
          .hero-npa-badge { padding: 8px 10px; }
        }
        @media (max-width: 500px) {
          .hero-float-card:nth-child(n+4) {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
