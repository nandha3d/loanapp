'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BorrowerLoginPage() {
  const [loanCode, setLoanCode] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/borrower/auth', {
      method: 'POST',
      body: JSON.stringify({ loanCode, phone, ...(otpRequired ? { otp } : {}) }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.otpRequired) {
        setOtpRequired(true);
        setLoading(false);
        return;
      }
      router.push('/borrower/dashboard');
    } else {
      const data = await res.json();
      if (data.otpRequired) {
        setOtpRequired(true);
        setError(data.message || 'Enter the OTP sent to your registered phone');
      } else {
        setError(data.error || 'Invalid credentials');
      }
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo">
          <h1>Loan<span>Track</span></h1>
          <p>Borrower Self-Service</p>
        </div>
        
        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Loan Code</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="LT-XXXXX" 
              value={loanCode} 
              onChange={e => setLoanCode(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input 
              type="tel" 
              className="form-control" 
              placeholder="Enter registered phone" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              required 
            />
          </div>
          {otpRequired && (
            <div className="form-group">
              <label className="form-label">OTP</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-control"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                required
              />
            </div>
          )}
          <button type="submit" className="btn btn-primary" style={{width:'100%'}} disabled={loading}>
            {loading ? 'Please wait...' : otpRequired ? 'Verify OTP' : 'Send OTP'}
          </button>
        </form>
      </div>
    </div>
  );
}
