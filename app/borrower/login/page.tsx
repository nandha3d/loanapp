'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BorrowerLoginPage() {
  const [loanCode, setLoanCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/borrower/auth', {
      method: 'POST',
      body: JSON.stringify({ loanCode, phone }),
    });

    if (res.ok) {
      router.push('/borrower/dashboard');
    } else {
      const data = await res.json();
      setError(data.error || 'Invalid credentials');
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
          <button type="submit" className="btn btn-primary" style={{width:'100%'}} disabled={loading}>
            {loading ? 'Logging in...' : 'View My Loan'}
          </button>
        </form>
      </div>
    </div>
  );
}
