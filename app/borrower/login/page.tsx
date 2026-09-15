'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PasswordInput from '@/components/ui/PasswordInput';

interface TestAccount {
  loanCode: string;
  phone: string;
  name: string;
}

type LoginStep = 'phone' | 'password' | 'setup' | 'forgot';

export default function BorrowerLoginPage() {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([]);
  const [showTester, setShowTester] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

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
        setShowTester(false);
      });
  }, []);

  // 1. Phone number identifier check
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 8) {
      setError('Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/borrower/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.passwordExists) {
          setStep('password');
        } else {
          // If no password exists, automatically trigger OTP dispatch for first-time setup
          await triggerOtpDispatch('setup');
        }
      } else {
        setError(data.error || 'Account not found. Please contact support.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Trigger OTP challenge
  const triggerOtpDispatch = async (nextStep: 'setup' | 'forgot') => {
    setError('');
    setDevOtp(null);
    try {
      const res = await fetch('/api/borrower/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), requestOtp: true }),
      });

      const data = await res.json();

      if (res.ok && data.otpRequired) {
        setStep(nextStep);
        if (data.testOtp) {
          setDevOtp(data.testOtp);
          setOtp(data.testOtp); // Auto-fill in dev mode
        }
      } else {
        setError(data.error || 'Failed to dispatch verification code.');
      }
    } catch (err) {
      setError('Failed to reach authentication services.');
    }
  };

  // 3. Password-based authentication
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/borrower/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/borrower/dashboard');
      } else {
        setError(data.error || 'Invalid credentials.');
      }
    } catch (err) {
      setError('Connection failed. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Complete password registration / recovery
  const handlePasswordRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/borrower/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          otp,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/borrower/dashboard');
      } else {
        setError(data.error || 'Setup failed. Please check the code.');
      }
    } catch (err) {
      setError('Network handshake error. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  // Automated 1-click login helper for local dev testing
  const handleQuickLogin = async (account: TestAccount) => {
    setLoading(true);
    setError('');
    
    // Set standard states in case they toggle back
    setPhone(account.phone);
    setStep('phone');

    try {
      const res = await fetch('/api/borrower/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: account.phone,
          bypass: true,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/borrower/dashboard');
      } else {
        setError(data.error || 'Quick login failed.');
        setLoading(false);
      }
    } catch (err) {
      setError('Quick login failed due to network error.');
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('phone');
    setPassword('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setDevOtp(null);
  };

  return (
    <div className="login-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px', justifyContent: 'center', alignItems: 'center', background: 'radial-gradient(circle at top right, #111827, #030712)' }}>
      <div className="login-card" style={{ width: '100%', maxWidth: '440px', padding: '40px 32px', background: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <div className="login-logo" style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
            <span className="material-icons-outlined" style={{ fontSize: '28px', color: '#fff' }}>account_balance_wallet</span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '-0.5px' }}>
              Loan<span style={{ color: 'var(--primary)' }}>Track</span>
            </h1>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px' }}>Borrower Self-Service</p>
          </div>
        </div>

        {error && (
          <div className="login-error" style={{ fontSize: '0.8rem', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '10px', animation: 'shake 0.4s ease-in-out' }}>
            <span className="material-icons-outlined" style={{ fontSize: '20px', flexShrink: 0 }}>error_outline</span>
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: ENTER PHONE NUMBER */}
        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit}>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '8px', display: 'block', fontSize: '0.84rem' }}>Phone Number</label>
              <div style={{ position: 'relative' }}>
                <span className="material-icons-outlined" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  phone_iphone
                </span>
                <input
                  type="tel"
                  className="form-control"
                  style={{ paddingLeft: '44px', height: '48px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', color: '#fff', fontSize: '0.94rem', width: '100%', outline: 'none', transition: 'border-color 0.2s' }}
                  placeholder="Enter registered mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', height: '48px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', fontWeight: 600, fontSize: '0.94rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="material-icons-outlined" style={{ animation: 'spin 1s linear infinite' }}>autorenew</span>
                  <span>Verifying account...</span>
                </>
              ) : (
                <>
                  <span>Next Step</span>
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: PASSWORD ENTRY */}
        {step === 'password' && (
          <form onSubmit={handlePasswordLogin}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.04)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '18px' }}>check_circle</span>
              <div style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                Logging in as <strong style={{ color: '#fff' }}>{phone}</strong>
              </div>
              <button type="button" onClick={resetFlow} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}>Change</button>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', margin: 0, fontSize: '0.84rem' }}>Password</label>
                <button
                  type="button"
                  onClick={() => triggerOtpDispatch('forgot')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <span className="material-icons-outlined" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  lock
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  style={{ paddingLeft: '44px', paddingRight: '44px', height: '48px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', color: '#fff', fontSize: '0.94rem', width: '100%', outline: 'none' }}
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', height: '48px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', fontWeight: 600, fontSize: '0.94rem' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="material-icons-outlined" style={{ animation: 'spin 1s linear infinite' }}>autorenew</span>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>login</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 3 & 4: PASSWORD SETUP & RECOVERY (OTP + SET PASSWORD) */}
        {(step === 'setup' || step === 'forgot') && (
          <form onSubmit={handlePasswordRegistration}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>
                  {step === 'setup' ? 'rocket_launch' : 'lock_reset'}
                </span>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  {step === 'setup' ? 'First-Time Portal Setup' : 'Reset Portal Password'}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Enter the verification code sent to <strong style={{ color: '#fff' }}>{phone}</strong> and define your portal credentials.
              </p>
            </div>

            {devOtp && (
              <div style={{ padding: '8px 12px', background: 'rgba(99, 102, 241, 0.1)', border: '1px dashed rgba(99, 102, 241, 0.3)', borderRadius: '8px', color: '#a5b4fc', fontSize: '0.78rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>bolt</span>
                <span>Testing OTP code generated: <strong>{devOtp}</strong></span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '6px', display: 'block', fontSize: '0.84rem' }}>6-Digit Code</label>
              <div style={{ position: 'relative' }}>
                <span className="material-icons-outlined" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  password
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="form-control"
                  style={{ paddingLeft: '44px', height: '44px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', color: '#fff', fontSize: '1rem', letterSpacing: '4px', fontWeight: 700 }}
                  placeholder="------"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '6px', display: 'block', fontSize: '0.84rem' }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <span className="material-icons-outlined" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  vpn_key
                </span>
                <input
                  type={showNewPassword ? "text" : "password"}
                  className="form-control"
                  style={{ paddingLeft: '44px', paddingRight: '44px', height: '44px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem' }}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
                    {showNewPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '6px', display: 'block', fontSize: '0.84rem' }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <span className="material-icons-outlined" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  lock_outline
                </span>
                <PasswordInput
                  className="form-control"
                  style={{ paddingLeft: '44px', paddingRight: '44px', height: '44px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem' }}
                  toggleStyle={{ color: 'rgba(255,255,255,0.4)' }}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetFlow}
                style={{ flex: 1, height: '44px', borderRadius: '10px', fontWeight: 600, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                disabled={loading}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, height: '44px', borderRadius: '10px', fontWeight: 600 }}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Save & Login'}
              </button>
            </div>
          </form>
        )}
      </div>

      {showTester && testAccounts.length > 0 && (
        <div className="fade-up" style={{ width: '100%', maxWidth: '440px', background: 'rgba(17, 24, 39, 0.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '20px 24px', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', transition: 'all 0.3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px' }}>
            <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '22px' }}>insights</span>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, letterSpacing: '0.5px' }}>Developer Testing Assistant</h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '14px', lineHeight: 1.4 }}>
            Click a customer below to automatically authenticate via a development-only **auto-login bypass** in <strong>1-click</strong>:
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
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  fontSize: '0.8rem',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{account.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px', fontFamily: 'monospace' }}>
                    {account.phone} (Loan Code: {account.loanCode})
                  </div>
                </div>
                <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>
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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .login-card input::placeholder {
          color: rgba(255, 255, 255, 0.3) !important;
        }
        .login-card input:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2) !important;
          background: rgba(255, 255, 255, 0.08) !important;
        }
      `}</style>
    </div>
  );
}
