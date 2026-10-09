'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Smartphone, Satellite, CheckCircle2, Bell, Shield, Navigation, Wifi, Clock, ArrowRight } from 'lucide-react';
import { useScrollAnimation } from './hooks/useScrollAnimation';

const STEPS = [
  {
    id: 'start',
    num: '01',
    icon: <Smartphone size={22} />,
    title: 'Agent Opens App & Starts Route',
    desc: 'The collection agent opens the Zolo Funds mobile app with biometric login. The app loads today\'s assigned route sequence automatically.',
    detail: 'Fingerprint or Face ID ensures only your authorized agent can access borrower records.'
  },
  {
    id: 'gps',
    num: '02',
    icon: <Satellite size={22} />,
    title: 'GPS Lock Acquired',
    desc: 'The smartphone acquires a satellite GPS lock and begins continuous background tracking of the agent\'s live coordinates.',
    detail: 'Works even in low-signal areas — coordinates are cached and synced when connectivity restores.'
  },
  {
    id: 'arrive',
    num: '03',
    icon: <Navigation size={22} />,
    title: 'Agent Arrives at Borrower Location',
    desc: 'As the agent approaches the borrower\'s registered address, the geofence radius activates. The system checks if the agent is within the allowed proximity.',
    detail: 'If the agent tries to collect from an off-route location, the system flags it immediately.'
  },
  {
    id: 'collect',
    num: '04',
    icon: <CheckCircle2 size={22} />,
    title: 'Collection GPS-Stamped & Verified',
    desc: 'The agent taps "Collect" — exact latitude, longitude, timestamp, and address are permanently watermarked onto the payment record.',
    detail: 'Payment is automatically applied to the oldest overdue instalment via smart waterfall distribution.'
  },
  {
    id: 'alert',
    num: '05',
    icon: <Bell size={22} />,
    title: 'Owner Gets Live Confirmation',
    desc: 'The finance company owner\'s dashboard instantly shows the confirmed collection with a verified GPS pin, amount, and agent ID.',
    detail: 'Borrower also receives an instant WhatsApp receipt. Zero disputes, zero cash leakage.'
  }
];

export default function GpsExplainer({ onOpenDemo }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const sectionRef = useScrollAnimation(0.2);
  const timerRef = useRef(null);

  // Start auto-play when section enters viewport
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
          setIsAutoPlaying(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(section);
    return () => obs.disconnect();
  }, [hasStarted]);

  // Auto-advance timer
  useEffect(() => {
    if (!isAutoPlaying) return;
    timerRef.current = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [isAutoPlaying]);

  const handleStepClick = (idx) => {
    setActiveStep(idx);
    setIsAutoPlaying(false);
    clearInterval(timerRef.current);
    // Resume auto-play after 8s of inactivity
    setTimeout(() => setIsAutoPlaying(true), 8000);
  };

  const currentStep = STEPS[activeStep];

  return (
    <section id="gps-explainer" className="section" ref={sectionRef}>
      <div className="container">
        <div className="section-header animate-on-scroll">
          <div className="section-pill">GPS Collection Verification</div>
          <h2 className="section-title">
            How GPS-Verified <span className="gradient-text">Collections Work</span>
          </h2>
          <p className="section-subtitle">
            Every field collection is timestamped, geocoded, and verified with automatic address proximity checks. See the complete 5-step process below.
          </p>
        </div>

        <div
          className="animate-on-scroll delay-2"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.3fr',
            gap: '40px',
            alignItems: 'center'
          }}
        >
          {/* Left: Animated Map Illustration */}
          <div style={{ position: 'relative' }}>
            <div className="gps-map-container">
              {/* SVG Map with animated elements */}
              <svg viewBox="0 0 400 400" className="gps-map-svg">
                {/* Grid lines */}
                {[...Array(9)].map((_, i) => (
                  <React.Fragment key={i}>
                    <line x1={45 * (i + 1)} y1="0" x2={45 * (i + 1)} y2="400" stroke="var(--brand-purple-border)" strokeWidth="0.5" opacity="0.3" />
                    <line x1="0" y1={45 * (i + 1)} x2="400" y2={45 * (i + 1)} stroke="var(--brand-purple-border)" strokeWidth="0.5" opacity="0.3" />
                  </React.Fragment>
                ))}

                {/* Roads */}
                <path d="M 50 200 Q 150 180 200 120 Q 250 60 350 80" fill="none" stroke="var(--brand-purple-tint)" strokeWidth="18" strokeLinecap="round" />
                <path d="M 80 350 Q 160 300 200 250 Q 240 200 200 120" fill="none" stroke="var(--brand-purple-tint)" strokeWidth="14" strokeLinecap="round" />
                <path d="M 200 120 Q 260 160 320 220 Q 340 260 350 320" fill="none" stroke="var(--brand-purple-tint)" strokeWidth="14" strokeLinecap="round" />

                {/* Animated route trail */}
                <path
                  d="M 80 350 Q 160 300 200 250 Q 240 200 200 120 Q 260 160 320 220 Q 340 260 350 320"
                  fill="none"
                  stroke="var(--brand-purple)"
                  strokeWidth="3"
                  strokeDasharray="8 6"
                  className={`gps-route-trail ${hasStarted ? 'animate' : ''}`}
                  strokeLinecap="round"
                />

                {/* Borrower Location Pins */}
                {[
                  { cx: 200, cy: 250, label: 'B1', active: activeStep >= 2 },
                  { cx: 200, cy: 120, label: 'B2', active: false },
                  { cx: 320, cy: 220, label: 'B3', active: false },
                  { cx: 350, cy: 320, label: 'B4', active: false },
                ].map((pin, i) => (
                  <g key={i}>
                    {/* Geofence radius circle */}
                    <circle
                      cx={pin.cx} cy={pin.cy} r={pin.active ? 30 : 20}
                      fill={pin.active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(125, 40, 126, 0.06)'}
                      stroke={pin.active ? '#10B981' : 'var(--brand-purple-border)'}
                      strokeWidth="1.5"
                      strokeDasharray={pin.active ? 'none' : '4 3'}
                      className={pin.active ? 'gps-geofence-pulse' : ''}
                    />
                    {/* Pin dot */}
                    <circle cx={pin.cx} cy={pin.cy} r="8" fill={pin.active ? '#10B981' : 'var(--brand-purple-tint)'} stroke={pin.active ? '#059669' : 'var(--brand-purple)'} strokeWidth="2" />
                    <text x={pin.cx} y={pin.cy + 3.5} textAnchor="middle" fontSize="7" fontWeight="900" fill={pin.active ? '#fff' : 'var(--brand-purple)'}>
                      {pin.label}
                    </text>
                  </g>
                ))}

                {/* Agent dot — position changes based on active step */}
                <g className="gps-agent-dot" style={{ '--agent-x': getAgentPos(activeStep).x + 'px', '--agent-y': getAgentPos(activeStep).y + 'px' }}>
                  <circle cx="0" cy="0" r="16" fill="var(--brand-purple)" opacity="0.15" className="gps-agent-ring" />
                  <circle cx="0" cy="0" r="9" fill="var(--brand-purple)" stroke="#fff" strokeWidth="2.5" />
                  <circle cx="0" cy="0" r="3" fill="#fff" />
                </g>

                {/* GPS signal waves on step 1-2 */}
                {(activeStep <= 1) && (
                  <g className="gps-signal-waves">
                    <circle cx={getAgentPos(activeStep).x} cy={getAgentPos(activeStep).y - 20} r="6" fill="none" stroke="var(--brand-purple)" strokeWidth="1.5" className="gps-wave w1" />
                    <circle cx={getAgentPos(activeStep).x} cy={getAgentPos(activeStep).y - 20} r="6" fill="none" stroke="var(--brand-purple)" strokeWidth="1.5" className="gps-wave w2" />
                    <circle cx={getAgentPos(activeStep).x} cy={getAgentPos(activeStep).y - 20} r="6" fill="none" stroke="var(--brand-purple)" strokeWidth="1.5" className="gps-wave w3" />
                  </g>
                )}

                {/* Verification stamp + Money Collected on step 3-4 */}
                {activeStep >= 3 && (
                  <g className="gps-stamp-appear">
                    {/* GPS Verified badge */}
                    <rect x="100" y="195" width="110" height="30" rx="6" fill="#fff" stroke="#10B981" strokeWidth="2" />
                    <text x="155" y="207" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#10B981">✓ GPS VERIFIED</text>
                    <text x="155" y="218" textAnchor="middle" fontSize="6" fill="var(--text-dim)">12.9716°N, 77.5946°E</text>

                    {/* Money Collected Receipt Stamp — prominent */}
                    <rect x="85" y="270" width="150" height="55" rx="10" fill="#fff" stroke="var(--brand-purple)" strokeWidth="2.5" filter="url(#gps-shadow)" />
                    <rect x="85" y="270" width="150" height="18" rx="10" ry="0" fill="var(--brand-purple)" />
                    <text x="160" y="283" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff">💰 MONEY COLLECTED</text>
                    <text x="160" y="302" textAnchor="middle" fontSize="14" fontWeight="900" fill="var(--brand-purple)">₹2,450</text>
                    <text x="160" y="316" textAnchor="middle" fontSize="6.5" fill="#059669" fontWeight="700">Cash · Borrower B1 · 10:42 AM</text>
                  </g>
                )}

                {/* Dashboard notification on step 5 */}
                {activeStep >= 4 && (
                  <g className="gps-notif-appear">
                    <rect x="250" y="40" width="140" height="62" rx="10" fill="#fff" stroke="var(--brand-purple)" strokeWidth="2" filter="url(#gps-shadow)" />
                    <rect x="250" y="40" width="140" height="16" rx="10" ry="0" fill="var(--brand-purple)" opacity="0.1" />
                    <text x="320" y="52" textAnchor="middle" fontSize="7" fontWeight="800" fill="var(--brand-purple)">📊 OWNER DASHBOARD</text>
                    <text x="270" y="68" fontSize="7.5" fontWeight="800" fill="var(--text-title)">Collection Alert</text>
                    <text x="270" y="80" fontSize="11" fontWeight="900" fill="var(--brand-purple)">₹2,450 ✓</text>
                    <text x="270" y="94" fontSize="6" fill="#059669" fontWeight="700">GPS Match · Zero Discrepancy</text>
                  </g>
                )}

                {/* Shadow filter */}
                <defs>
                  <filter id="gps-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(125,40,126,0.15)" />
                  </filter>
                </defs>
              </svg>

              {/* Bottom legend */}
              <div className="gps-map-legend">
                <div className="gps-legend-item">
                  <div className="gps-legend-dot" style={{ background: 'var(--brand-purple)' }} />
                  <span>Agent Location</span>
                </div>
                <div className="gps-legend-item">
                  <div className="gps-legend-dot" style={{ background: 'var(--brand-purple-tint)', border: '1.5px solid var(--brand-purple)' }} />
                  <span>Borrower Stops</span>
                </div>
                <div className="gps-legend-item">
                  <div className="gps-legend-dot" style={{ background: 'rgba(16,185,129,0.2)', border: '1.5px solid #10B981' }} />
                  <span>Geofence Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Step Timeline */}
          <div>
            <div className="gps-steps-timeline">
              {STEPS.map((step, idx) => {
                const isActive = activeStep === idx;
                const isCompleted = activeStep > idx;
                return (
                  <div
                    key={step.id}
                    className={`gps-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                    onClick={() => handleStepClick(idx)}
                  >
                    {/* Connector line */}
                    {idx < STEPS.length - 1 && (
                      <div className={`gps-step-connector ${isCompleted ? 'filled' : ''}`} />
                    )}

                    {/* Step icon circle */}
                    <div className={`gps-step-icon ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                      {isCompleted ? <CheckCircle2 size={18} color="#fff" /> : step.icon}
                    </div>

                    {/* Step content */}
                    <div className="gps-step-content">
                      <div className="gps-step-num">{step.num}</div>
                      <h4 className="gps-step-title">{step.title}</h4>
                      <div className={`gps-step-body ${isActive ? 'expanded' : ''}`}>
                        <p className="gps-step-desc">{step.desc}</p>
                        <div className="gps-step-detail">
                          <Shield size={13} color="#059669" />
                          <span>{step.detail}</span>
                        </div>
                      </div>
                      {/* Auto-play progress bar on active step */}
                      {isActive && isAutoPlaying && (
                        <div className="gps-step-progress">
                          <div className="gps-step-progress-fill" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <div style={{ marginTop: '28px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <button onClick={onOpenDemo} className="btn btn-primary" style={{ gap: '8px' }}>
                <span>See GPS Tracking Live in Demo</span>
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '10px 18px' }}
              >
                {isAutoPlaying ? '⏸ Pause' : '▶ Auto-play'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Map Container ── */
        .gps-map-container {
          background: var(--bg-surface);
          border: 2px solid var(--brand-purple-border);
          border-radius: 24px;
          padding: 16px;
          box-shadow: var(--shadow-lg);
          position: relative;
          overflow: hidden;
        }
        .gps-map-svg {
          width: 100%;
          height: auto;
          display: block;
        }

        /* ── Route Trail Animation ── */
        .gps-route-trail {
          stroke-dashoffset: 600;
        }
        .gps-route-trail.animate {
          animation: gpsTrailDraw 3s ease-out forwards;
        }
        @keyframes gpsTrailDraw {
          to { stroke-dashoffset: 0; }
        }

        /* ── Agent Dot ── */
        .gps-agent-dot {
          transform: translate(var(--agent-x), var(--agent-y));
          transition: transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .gps-agent-ring {
          animation: gpsAgentPulse 2s ease-in-out infinite;
        }
        @keyframes gpsAgentPulse {
          0%, 100% { r: 16; opacity: 0.15; }
          50% { r: 22; opacity: 0.05; }
        }

        /* ── GPS Signal Waves ── */
        .gps-wave {
          animation: gpsWaveExpand 2s ease-out infinite;
        }
        .gps-wave.w2 { animation-delay: 0.5s; }
        .gps-wave.w3 { animation-delay: 1s; }
        @keyframes gpsWaveExpand {
          0% { r: 6; opacity: 0.6; }
          100% { r: 28; opacity: 0; }
        }

        /* ── Geofence Pulse ── */
        .gps-geofence-pulse {
          animation: gpsGeofencePulse 2s ease-in-out infinite;
        }
        @keyframes gpsGeofencePulse {
          0%, 100% { r: 30; opacity: 1; }
          50% { r: 35; opacity: 0.7; }
        }

        /* ── Stamp / Notification Appear ── */
        .gps-stamp-appear, .gps-notif-appear {
          animation: gpsStampPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes gpsStampPop {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }

        /* ── Map Legend ── */
        .gps-map-legend {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-subtle);
        }
        .gps-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-dim);
        }
        .gps-legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* ── Step Timeline ── */
        .gps-steps-timeline {
          display: flex;
          flex-direction: column;
          gap: 0;
          position: relative;
        }
        .gps-step {
          display: flex;
          gap: 16px;
          padding: 14px 0;
          cursor: pointer;
          position: relative;
          transition: all 0.3s ease;
        }
        .gps-step:hover .gps-step-title {
          color: var(--brand-purple);
        }

        /* ── Connector Line ── */
        .gps-step-connector {
          position: absolute;
          left: 19px;
          top: 52px;
          width: 2px;
          height: calc(100% - 36px);
          background: var(--border-color);
          transition: background 0.5s ease;
        }
        .gps-step-connector.filled {
          background: var(--brand-purple);
        }

        /* ── Step Icon ── */
        .gps-step-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: var(--brand-purple-tint);
          color: var(--brand-purple);
          border: 2px solid var(--brand-purple-border);
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          z-index: 2;
        }
        .gps-step-icon.active {
          background: var(--brand-purple);
          color: #fff;
          border-color: var(--brand-purple);
          transform: scale(1.15);
          box-shadow: 0 0 0 6px rgba(125, 40, 126, 0.15);
        }
        .gps-step-icon.completed {
          background: #059669;
          color: #fff;
          border-color: #059669;
        }

        /* ── Step Content ── */
        .gps-step-content {
          flex: 1;
          min-width: 0;
        }
        .gps-step-num {
          font-size: 0.68rem;
          font-weight: 900;
          color: var(--brand-purple);
          letter-spacing: 0.05em;
          margin-bottom: 2px;
        }
        .gps-step-title {
          font-size: 1rem;
          font-weight: 800;
          color: var(--text-title);
          transition: color 0.2s;
          margin: 0;
          line-height: 1.3;
        }
        .gps-step.active .gps-step-title {
          color: var(--brand-purple);
        }

        /* ── Step Body (expandable) ── */
        .gps-step-body {
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          transition: max-height 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                      opacity 0.4s ease,
                      margin 0.4s ease;
          margin-top: 0;
        }
        .gps-step-body.expanded {
          max-height: 200px;
          opacity: 1;
          margin-top: 8px;
        }
        .gps-step-desc {
          font-size: 0.86rem;
          color: var(--text-muted);
          line-height: 1.55;
          margin: 0 0 8px 0;
        }
        .gps-step-detail {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          font-size: 0.78rem;
          color: #059669;
          font-weight: 600;
          background: var(--success-bg);
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #D1FAE5;
        }
        .gps-step-detail span {
          line-height: 1.4;
        }

        /* ── Auto-play Progress Bar ── */
        .gps-step-progress {
          height: 3px;
          background: var(--brand-purple-tint);
          border-radius: 2px;
          margin-top: 10px;
          overflow: hidden;
        }
        .gps-step-progress-fill {
          height: 100%;
          background: var(--brand-purple);
          border-radius: 2px;
          animation: gpsProgressFill 4s linear forwards;
        }
        @keyframes gpsProgressFill {
          from { width: 0%; }
          to { width: 100%; }
        }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          #gps-explainer .animate-on-scroll.delay-2 {
            grid-template-columns: 1fr !important;
          }
          .gps-map-container {
            max-width: 400px;
            margin: 0 auto 24px;
          }
        }
      `}</style>
    </section>
  );
}

/* Helper: get agent position based on step */
function getAgentPos(step) {
  const positions = [
    { x: 80, y: 350 },   // Start
    { x: 140, y: 310 },  // GPS lock
    { x: 200, y: 250 },  // Arrive at B1
    { x: 200, y: 250 },  // Collect at B1
    { x: 200, y: 250 },  // Owner notified
  ];
  return positions[step] || positions[0];
}

