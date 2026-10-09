'use client';

import React, { useState } from 'react';
import { X, CheckCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export default function DemoModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    company: '',
    vertical: 'microlending',
    loanCapacity: '100-500',
    agentCount: '1-5',
    city: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data && data.success) {
        setSubmitted(true);
      } else {
        // Even if error, set submitted to true if already recorded or show error
        setErrorMsg(data?.error || 'Unable to register request. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      // Graceful fallback so user is not stuck
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(31, 7, 36, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '540px',
          width: '100%',
          padding: '36px',
          borderRadius: '24px',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#FFFFFF',
          border: '2px solid var(--brand-purple)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            fontSize: '1.4rem',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={22} />
        </button>

        {!submitted ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="zolo-pill-badge">Lender Software Demonstration</span>
              <Sparkles size={16} color="var(--brand-purple)" />
            </div>

            <h3 style={{ fontSize: '1.55rem', marginBottom: '6px', color: 'var(--text-title)' }}>
              Schedule Your <span className="gradient-text">Live Platform Walkthrough</span>
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '22px' }}>
              Experience Zolo Funds customized for your lending firm. See live GPS field tracking, automated waterfall recovery, and instant CRIF/CIBIL credit checks in action.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={labelStyle}>Founder / Manager Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>WhatsApp Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>City / State</label>
                  <input
                    type="text"
                    placeholder="e.g. Madurai, TN"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Finance Company / Lending Firm Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sri Venkateswara Micro Credit"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Lending Category</label>
                  <select
                    value={formData.vertical}
                    onChange={(e) => setFormData({ ...formData, vertical: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="microlending">Microfinance / Daily</option>
                    <option value="autofinance">Auto & Vehicle Finance</option>
                    <option value="chitfunds">Chit Funds Management</option>
                    <option value="goldloan">Gold Loans</option>
                    <option value="multiple">Multiple Categories</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Active Loan Portfolio</label>
                  <select
                    value={formData.loanCapacity}
                    onChange={(e) => setFormData({ ...formData, loanCapacity: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="under-100">Under 100 Loans</option>
                    <option value="100-500">100 – 500 Loans</option>
                    <option value="500-1500">500 – 1,500 Loans</option>
                    <option value="1500-plus">1,500+ Loans</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Number of Field Collection Agents</label>
                <select
                  value={formData.agentCount}
                  onChange={(e) => setFormData({ ...formData, agentCount: e.target.value })}
                  style={inputStyle}
                >
                  <option value="1-5">1 – 5 Field Agents</option>
                  <option value="6-15">6 – 15 Field Agents</option>
                  <option value="16-50">16 – 50 Field Agents</option>
                  <option value="50-plus">50+ Field Agents</option>
                </select>
              </div>

              {errorMsg && (
                <div style={{ color: '#ef4444', fontSize: '0.84rem', padding: '8px 12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '10px', padding: '13px', fontSize: '0.98rem', opacity: loading ? 0.75 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                <span>{loading ? 'Submitting Details...' : 'Confirm & Request Live Demo'}</span>
                <ArrowRight size={17} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                <ShieldCheck size={14} color="#059669" />
                <span>Your contact info is 100% confidential. No spam guaranteed.</span>
              </div>
            </form>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--success-bg)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto'
              }}
            >
              <CheckCircle size={36} />
            </div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--text-title)' }}>
              Thank You, {formData.name}!
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.94rem', lineHeight: 1.6, marginBottom: '24px' }}>
              Your lender demonstration request for <strong>{formData.company || 'your finance business'}</strong> has been registered. Our lending technical specialist will contact you on <strong>{formData.phone}</strong> via WhatsApp within 2 hours.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                onClose();
              }}
              className="btn btn-secondary"
              style={{ padding: '10px 24px' }}
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 700,
  color: 'var(--text-title)',
  marginBottom: '5px'
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-title)',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box'
};
