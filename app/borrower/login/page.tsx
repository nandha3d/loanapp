'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface TestAccount {
  loanCode: string;
  phone: string;
  name: string;
}

export default function BorrowerLoginPage() {
  const [loanCode, setLoanCode] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([]);
  const [showTester, setShowTester] = useState(false);
  
  const router = useRouter();

  // Fetch test accounts in development mode
  useEffect(() => {
    fetch('/api/borrower/test-accounts')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        if (data.success && data.accounts) {
          setTestAccounts(data.accounts);
          setShowTester(true);
        }
      })
      .catch(() => {
        // Silently fail in production or if server blocks test accounts
        setShowTester(false);
      });
  }, []);

  const handleLogin = async (e: React.FormEvent, customOtp?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    const activeOtp = customOtp || otp;

    try {
      const res = await fetch('/api/borrower/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanCode,
          phone,
          ...(otpRequired || customOtp ? { otp: activeOtp } : {}),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.otpRequired) {
          setOtpRequired(true);
          setLoading(false);
          // If the server returned a test OTP (dev mode), prefill it
          if (data.testOtp) {
            setOtp(data.testOtp);
          }
          return;
        }
        // Success login
        router.push('/borrower/dashboard');
      } else {
        setError(data.error || 'Invalid credentials');
        setLoading(false);
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  // Automated 1-click login helper for testers
  const handleQuickLogin = async (account: TestAccount) => {
    setLoading(true);
    setError('');
    setOtpRequired(false);
    setOtp('');
    setLoanCode(account.loanCode);
    setPhone(account.phone);

    try {
      // Step 1: Send OTP request
      const otpRes = await fetch('/api/borrower/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanCode: account.loanCode,
          phone: account.phone,
        }),
      });

      const otpData = await otpRes.json();

      if (otpRes.ok && otpData.otpRequired && otpData.testOtp) {
        setOtpRequired(true);
        setOtp(otpData.testOtp);

        // Step 2: Instant automatic verification in dev mode
        const authRes = await fetch('/api/borrower/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loanCode: account.loanCode,
            phone: account.phone,
            otp: otpData.testOtp,
          }),
        });

        if (authRes.ok) {
          router.push('/borrower/dashboard');
        } else {
          const authData = await authRes.json();
          setError(authData.error || 'Failed to authenticate auto-generated OTP.');
          setLoading(false);
        }
      } else {
        setError(otpData.error || 'Failed to request quick login OTP.');
        setLoading(false);
      }
    } catch (err) {
      setError('Quick login failed due to network error.');
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px' }}>
      <div className="login-card" style={{ width: '100%', maxWidth: '440px', padding: '40px 32px' }}>
        <div className="login-logo" style={{ marginBottom: '24px' }}>
          <span className="material-icons-outlined" style={{ fontSize: '36px', color: 'var(--primary)' }}>account_balance_wallet</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              Loan<span style={{ color: 'var(--primary)' }}>Track</span>
            </h1>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Borrower Self-Service Portal</p>
          </div>
        </div>

        {error && (
          <div className="login-error" style={{ fontSize: '0.8rem', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>error_outline</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => handleLogin(e)}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Loan Code</label>
            <div style={{ position: 'relative' }}>
              <span className="material-icons-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--text-light)' }}>
                receipt_long
              </span>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '38px', height: '44px' }}
                placeholder="LT-XXXXX"
                value={loanCode}
                onChange={(e) => setLoanCode(e.target.value.toUpperCase())}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Phone Number</label>
            <div style={{ position: 'relative' }}>
              <span className="material-icons-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--text-light)' }}>
                phone_iphone
              </span>
              <input
                type="tel"
                className="form-control"
                style={{ paddingLeft: '38px', height: '44px' }}
                placeholder="Registered phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          {otpRequired && (
            <div className="form-group fade-in">
              <label className="form-label" style={{ fontWeight: 600 }}>Enter 6-Digit OTP</label>
              <div style={{ position: 'relative' }}>
                <span className="material-icons-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--text-light)' }}>
                  password
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="form-control"
                  style={{ paddingLeft: '38px', letterSpacing: '4px', fontSize: '1.1rem', height: '44px' }}
                  placeholder="------"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: '44px', justifyContent: 'center', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-outlined" style={{ animation: 'spin 1s linear infinite' }}>autorenew</span>
                <span>Authenticating...</span>
              </span>
            ) : otpRequired ? (
              'Verify OTP & Login'
            ) : (
              'Send OTP Verification'
            )}
          </button>
        </form>
      </div>

      {showTester && testAccounts.length > 0 && (
        <div className="fade-up" style={{ width: '100%', maxWidth: '440px', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px 24px', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '8px' }}>
            <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>insights</span>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, margin: 0 }}>Developer Testing Assistant</h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: '12px', lineHeight: 1.4 }}>
            Click an active loan below to automatically trigger mock credentials and authenticate in <strong>1-click</strong>:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {testAccounts.map((account, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickLogin(account)}
                disabled={loading}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  fontSize: '0.8rem',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{account.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                    {account.loanCode} • {account.phone}
                  </div>
                </div>
                <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>
                  bolt
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
