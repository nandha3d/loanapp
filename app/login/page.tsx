'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { getSupabaseBrowser, isSupabaseAuthEnabled } from '@/lib/supabase/browser';
import { currentOriginWithBasePath, withBasePath } from '@/lib/public-path';
import { normalizeLocalCallbackUrl } from '@/lib/auth/callback-url';
import PasswordInput from '@/components/ui/PasswordInput';
import AppLogo from '@/components/ui/AppLogo';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = normalizeLocalCallbackUrl(searchParams.get('callbackUrl'));

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Registration is hidden on a client's standalone domain.
  const [registerAllowed, setRegisterAllowed] = useState(true);
  const [standaloneDomain, setStandaloneDomain] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const [authMethod, setAuthMethod] = useState<'password' | 'whatsapp'>('password');
  const [waPhone, setWaPhone] = useState('');
  const [waOtp, setWaOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState('');

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  useEffect(() => {
    fetch('/api/host/registration')
      .then((r) => r.json())
      .then((d) => {
        setRegisterAllowed(d?.allowed !== false);
        setStandaloneDomain(Boolean(d?.standalone));
      })
      .catch(() => {});
  }, []);

  const registerPending = !!searchParams.get('registerPending');
  const emailSent = searchParams.get('emailSent') !== '0';
  const pendingEmail = searchParams.get('email') || '';
  const notice = registerPending
      ? (emailSent
          ? 'Account created! Check your email and click the activation link before signing in.'
          : 'Account created — but we could not send the verification email. Use “Resend verification email” below.')
    : searchParams.get('verified')
      ? 'Email verified — you can sign in now.'
    : searchParams.get('reset')
      ? 'Password updated — sign in with your new password.'
    : '';
  const verifyError = searchParams.get('verifyError') || '';

  const handleSendWhatsAppOtp = async () => {
    setError('');
    setOtpSuccessMsg('');
    const cleanPhone = waPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit registered mobile number.');
      return;
    }
    setOtpSending(true);
    try {
      const res = await fetch('/api/v1/auth/whatsapp/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, purpose: 'login' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to send WhatsApp verification code.');
        setOtpSending(false);
        return;
      }
      setChallengeToken(data.data?.challengeToken || '');
      setOtpSent(true);
      setOtpCooldown(60);
      setOtpSuccessMsg(data.data?.message || 'Verification code sent to your WhatsApp!');
    } catch {
      setError('Could not reach the authentication server. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    const target = pendingEmail || window.prompt('Enter the email you registered with:')?.trim();
    if (!target) return;
    setResending(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json().catch(() => ({}));
      setResendMsg(data?.message || 'If an unverified account exists for that email, a new verification link has been sent.');
    } catch {
      setResendMsg('Could not reach the server. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result: any = await signIn('credentials', {
        ...(authMethod === 'whatsapp'
          ? {
              username: waPhone.replace(/\D/g, '').slice(-10),
              whatsappOtp: waOtp.trim(),
              challengeToken,
            }
          : {
              username,
              password,
            }),
        rememberMe: String(rememberMe),
        redirect: false,
      });

      if (result?.error) {
        // NextAuth surfaces the authorize() failure on `code` or `error`
        // depending on the path taken, so check both.
        const reason = `${(result as { code?: string }).code ?? ''} ${result.error}`;
        setError(
          reason.includes('LOGIN_WINDOW_CLOSED')
            ? 'Your account is outside its allowed login hours. Contact your administrator if you need access now.'
            : authMethod === 'whatsapp'
              ? 'Invalid WhatsApp OTP code. Please request a new code.'
              : 'Invalid credentials. If you just registered, verify your email using the activation link we sent before signing in.',
        );
        setLoading(false);
        return;
      }

      // Fetch the active session to retrieve the user's tenantSlug
      const sessionRes = await fetch('/api/auth/session');
      const session = await sessionRes.json();
      const tenantSlug = session?.user?.tenantSlug;

       const hostname = window.location.hostname;
       const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost';
       const rootHost = rootDomain.split(':')[0];
       const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
       const supportsSubdomains = rootDomain && !rootDomain.includes('localhost');

       // If we are currently on the root domain and the tenant has a slug, redirect to their subdomain (if supported)
       if (tenantSlug && tenantSlug !== 'default' && (hostname === rootHost) && !isLocalhost && supportsSubdomains) {
         const protocol = window.location.protocol;
         const port = window.location.port ? `:${window.location.port}` : '';
         const targetUrl = `${protocol}//${tenantSlug}.${hostname}${port}${callbackUrl === '/' ? '/portal' : callbackUrl}`;
         window.location.href = targetUrl;
       } else {
         router.push(callbackUrl);
         router.refresh();
       }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${currentOriginWithBasePath()}/auth/callback?intent=login` },
      });
      if (error) setError(error.message || 'Google sign-in failed.');
    } catch (e: any) {
      setError(e?.message || 'Google sign-in is not configured.');
    }
  };

  const setDemoCredentials = (role: 'admin' | 'agent') => {
    if (role === 'admin') {
      setUsername('admin');
      setPassword('admin123');
    } else {
      setUsername('karthik');
      setPassword('agent123');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo" style={{ justifyContent: 'center', marginBottom: '16px' }}>
          <AppLogo variant="horizontal" theme="light" height={48} />
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.85rem', marginBottom: '28px' }}>
          Micro-Lending Management System
        </p>

        {notice && (
          <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '.82rem' }}>
            {notice}
          </div>
        )}
        {registerPending && (
          <div style={{ textAlign: 'center', marginBottom: '14px', fontSize: '.8rem' }}>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: resending ? 'default' : 'pointer', fontWeight: 600, textDecoration: 'underline' }}
            >
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
            {resendMsg && (
              <div style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>{resendMsg}</div>
            )}
          </div>
        )}
        {(error || verifyError) && (
          <div className="login-error">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>error</span>
            {error || verifyError}
          </div>
        )}

        {!standaloneDomain && (
          <div style={{ display: 'flex', background: 'var(--bg-muted, #f1f5f9)', padding: '4px', borderRadius: '10px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => { setAuthMethod('password'); setError(''); setOtpSuccessMsg(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: authMethod === 'password' ? '#fff' : 'transparent',
                color: authMethod === 'password' ? 'var(--primary, #d97706)' : 'var(--text-secondary, #64748b)',
                boxShadow: authMethod === 'password' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>lock</span>
              Password
            </button>
            <button
              type="button"
              onClick={() => { setAuthMethod('whatsapp'); setError(''); setOtpSuccessMsg(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: authMethod === 'whatsapp' ? '#fff' : 'transparent',
                color: authMethod === 'whatsapp' ? '#16a34a' : 'var(--text-secondary, #64748b)',
                boxShadow: authMethod === 'whatsapp' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#25D366' }}>chat</span>
              WhatsApp OTP
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {authMethod === 'whatsapp' ? (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="waPhone">Registered Mobile Number</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="tel"
                    id="waPhone"
                    className="form-control"
                    placeholder="Enter 10-digit mobile number"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    maxLength={15}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSendWhatsAppOtp}
                    disabled={otpSending || otpCooldown > 0}
                    className="btn"
                    style={{
                      background: otpCooldown > 0 ? '#e2e8f0' : '#25D366',
                      color: otpCooldown > 0 ? '#64748b' : '#fff',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                      fontSize: '.82rem',
                      padding: '0 14px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: otpSending || otpCooldown > 0 ? 'default' : 'pointer',
                    }}
                  >
                    {otpSending ? 'Sending…' : otpCooldown > 0 ? `${otpCooldown}s` : (otpSent ? 'Resend' : 'Get OTP')}
                  </button>
                </div>
              </div>

              {otpSuccessMsg && (
                <div style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#047857', padding: '8px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '.8rem' }}>
                  {otpSuccessMsg}
                </div>
              )}

              {otpSent && (
                <div className="form-group">
                  <label className="form-label" htmlFor="waOtp">6-Digit WhatsApp Code</label>
                  <input
                    type="text"
                    id="waOtp"
                    className="form-control"
                    placeholder="123456"
                    value={waOtp}
                    onChange={(e) => setWaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    autoFocus
                    style={{ fontSize: '1.1rem', letterSpacing: '3px', textAlign: 'center' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  /> Remember me
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '.95rem', background: '#25D366', borderColor: '#25D366' }}
                disabled={loading || !otpSent || waOtp.length !== 6}
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>login</span>
                {loading ? 'Signing in...' : 'Sign In with WhatsApp'}
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="username">Username / Phone / Email</label>
                <input
                  type="text"
                  id="username"
                  className="form-control"
                  placeholder="Enter username, phone, or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <PasswordInput
                  id="password"
                  className="form-control"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  /> Remember me
                </label>
                <a href={withBasePath('/forgot-password')} style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '.82rem' }}>
                  Forgot password?
                </a>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '.95rem' }}
                disabled={loading}
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>login</span>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </>
          )}
        </form>

        {isSupabaseAuthEnabled() && !standaloneDomain && (<>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>
        <button
          type="button"
          onClick={handleGoogle}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '11px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: '#3c4043', fontWeight: 600, fontSize: '.9rem', cursor: 'pointer' }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>
        </>)}

        {registerAllowed && (
          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
            New to ZoloFund? <a href={withBasePath('/register')} style={{ color: 'var(--primary)', fontWeight: 600 }}>Register Business</a>
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-wrapper">
        <div className="login-card">
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
