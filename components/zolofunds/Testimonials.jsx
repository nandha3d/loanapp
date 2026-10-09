'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Star, ShieldCheck } from 'lucide-react';
import { useScrollAnimation } from './hooks/useScrollAnimation';

/* ── Animated Counter Hook ── */
function useAnimatedCounter(target, suffix = '', prefix = '', duration = 1800) {
  const [display, setDisplay] = useState(prefix + '0' + suffix);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

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
    const numericTarget = parseFloat(String(target).replace(/[^0-9.]/g, ''));
    if (isNaN(numericTarget)) { setDisplay(prefix + target + suffix); return; }

    let current = 0;
    const step = numericTarget / (duration / 16);
    const timer = setInterval(() => {
      current += step;
      if (current >= numericTarget) {
        setDisplay(prefix + target + suffix);
        clearInterval(timer);
      } else {
        setDisplay(prefix + Math.floor(current) + suffix);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [started, target, suffix, prefix, duration]);

  return { display, ref };
}

export default function Testimonials() {
  const sectionRef = useScrollAnimation();

  const stat1 = useAnimatedCounter('150+', ' Cr', '₹ ');
  const stat2 = useAnimatedCounter('99.9', '%');
  const stat3 = useAnimatedCounter('4x', '');
  const stat4 = useAnimatedCounter('0', '%');

  const reviews = [
    {
      name: 'M. Senthil Kumar',
      role: 'Managing Director',
      company: 'Sri Venkateswara Micro Credit (Madurai)',
      product: 'Microfinance Field Collections',
      rating: 5,
      text: 'Before Zolo Funds, our 24 field collection agents returned with paper diaries and daily calculation arguments every evening. GPS location tagging and automated oldest-overdue allocation stopped cash leakage 100%. Our daily collection efficiency reached 98% in just 60 days.',
      metrics: '₹1.8 Cr Monthly Collections · 24 Agents'
    },
    {
      name: 'Anand Vardhan Reddy',
      role: 'Founder & CEO',
      company: 'Kaveri Auto Financers (Bengaluru)',
      product: 'Auto Finance & Vehicle Vault',
      rating: 5,
      text: 'Managing 950 vehicle loans across separate Excel sheets and physical RC files was a huge risk. Zolo Funds gave us an organized RC document vault and automated WhatsApp payment reminders that reduced our 30-day defaults by nearly half.',
      metrics: '950 Vehicle Loans · 100% RC Vaulted'
    },
    {
      name: 'Rajendra Joshi',
      role: 'Managing Foreman',
      company: 'Navbharat Chit Funds (Secunderabad)',
      product: 'Chit Funds Management',
      rating: 5,
      text: 'Calculating auction bid discounts, foreman commission, and member dividend redistribution for 12 rotating chit groups used to take our accountants entire weekends. With Zolo Funds, we select the auction winner and all statements are calculated and sent to WhatsApp in seconds.',
      metrics: '12 Active Chit Groups · Zero Math Errors'
    }
  ];

  const stats = [
    { ref: stat1.ref, display: stat1.display, label: 'Loan Portfolios Managed' },
    { ref: stat2.ref, display: stat2.display, label: 'GPS Field Accuracy' },
    { ref: stat3.ref, display: stat3.display, label: 'Faster Daily Reconciliation' },
    { ref: stat4.ref, display: stat4.display, label: 'Math & Dividend Errors' }
  ];

  return (
    <section className="section" ref={sectionRef}>
      <div className="container">
        <div className="section-header animate-on-scroll">
          <div className="section-pill">Real Customer Feedback</div>
          <h2 className="section-title">
            Trusted By <span className="gradient-text">Indian Lending Operations</span>
          </h2>
          <p className="section-subtitle">
            See how lenders across Tamil Nadu, Karnataka, Andhra Pradesh, Telangana, and Maharashtra transformed their field collections.
          </p>
        </div>

        {/* Animated Stats Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '40px'
          }}
        >
          {stats.map((s, idx) => (
            <div
              key={idx}
              ref={s.ref}
              className={`animate-on-scroll delay-${idx + 1}`}
              style={{
                background: '#FFFFFF',
                padding: '24px',
                borderRadius: '18px',
                textAlign: 'center',
                border: '2px solid var(--brand-purple-border)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-purple)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            >
              <div style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--brand-purple)', marginBottom: '4px' }}>
                {s.display}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px'
          }}
        >
          {reviews.map((r, idx) => (
            <div
              key={idx}
              className={`glass-card animate-on-scroll slide-up delay-${idx + 2}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '32px 28px',
                border: '1.5px solid var(--border-color)',
                background: '#FFFFFF',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = 'var(--shadow-purple)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[...Array(r.rating)].map((_, i) => (
                      <Star key={i} size={16} fill="#F59E0B" color="#F59E0B" style={{ animation: `starPop 0.3s ease ${i * 0.1}s both` }} />
                    ))}
                  </div>
                  <span className="zolo-pill-badge" style={{ fontSize: '0.72rem' }}>
                    {r.product}
                  </span>
                </div>

                <p
                  style={{
                    fontSize: '0.94rem',
                    color: 'var(--text-body)',
                    lineHeight: 1.65,
                    fontStyle: 'italic',
                    marginBottom: '20px'
                  }}
                >
                  "{r.text}"
                </p>
              </div>

              <div style={{ paddingTop: '16px', borderTop: '1.5px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                  {r.name}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--brand-purple)', fontWeight: 700, marginTop: '2px' }}>
                  {r.role} · {r.company}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {r.metrics}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes starPop {
          from { opacity: 0; transform: scale(0) rotate(-45deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </section>
  );
}

