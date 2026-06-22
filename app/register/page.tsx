'use client';

import { useState, useEffect, Suspense } from 'react';
import { validateIndianMobile, validateEmail } from '@/lib/validation/contact';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { calculateVerticalSubscriptionPricing } from '@/lib/pricing';
import { getSupabaseBrowser, isSupabaseAuthEnabled } from '@/lib/supabase/browser';
import PasswordInput from '@/components/ui/PasswordInput';

type AvailabilityFieldState = {
  checking: boolean;
  available: boolean | null;
  message: string;
};

type AvailabilityState = Record<'username' | 'phone' | 'email', AvailabilityFieldState>;

const emptyAvailabilityField: AvailabilityFieldState = {
  checking: false,
  available: null,
  message: '',
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Host registration policy. simpleMode = client's own domain → Details-only
  // signup that claims it as the lifetime owner. allowed:false → already claimed.
  const [simpleMode, setSimpleMode] = useState(false);
  useEffect(() => {
    fetch('/api/host/registration')
      .then((r) => r.json())
      .then((d) => {
        if (d?.allowed === false) router.replace('/login');
        else if (d?.simpleMode) setSimpleMode(true);
      })
      .catch(() => {});
  }, [router]);

  // Pre-fill parameters if redirected from Google
  const googleEmail = searchParams.get('google_email') || '';
  const googleName = searchParams.get('google_name') || '';
  const googleId = searchParams.get('google_id') || '';
  // Supabase-brokered Google onboarding lands here with google_email (no Google
  // `sub`); legacy NextAuth Google flow lands with google_id. Either means the
  // owner identity is already email-verified and password-less.
  const isGoogleRegister = !!googleId || !!googleEmail;

  // Form state
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState(googleName || '');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState(googleEmail || '');
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [availability, setAvailability] = useState<AvailabilityState>({
    username: emptyAvailabilityField,
    phone: emptyAvailabilityField,
    email: emptyAvailabilityField,
  });
  const [selectedPlan, setSelectedPlan] = useState('basic');
  const [selectedModules, setSelectedModules] = useState(['microlending']);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [catalog, setCatalog] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');

  // Extract referral code on mount and track visit
  useEffect(() => {
    let code = searchParams.get('ref') || '';
    if (!code) {
      const match = document.cookie.match(/(?:^|; )ref_code=([^;]*)/);
      code = match ? match[1] : '';
      if (!code) {
        code = localStorage.getItem('ref_code') || '';
      }
    }
    
    if (code) {
      setReferralCode(code);
      // Track visit
      fetch('/api/affiliate/track-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, referrer: document.referrer })
      }).catch(err => console.error('Error tracking visit', err));
    }
  }, [searchParams]);

  // Fetch public pricing catalog
  useEffect(() => {
    async function fetchPricing() {
      try {
        const res = await fetch('/api/pricing');
        const data = await res.json();
        if (data.success) {
          setCatalog(data);
          // Set default plan to first active plan in catalog
          if (data.plans?.length > 0) {
            setSelectedPlan(data.plans[0].plan);
          }
        } else {
          setError('Failed to load pricing information');
        }
      } catch (err) {
        setError('Failed to fetch pricing information');
      } finally {
        setCatalogLoading(false);
      }
    }
    fetchPricing();
  }, []);

  useEffect(() => {
    // Phone number doubles as the default login username, so check both.
    const phoneResult = validateIndianMobile(ownerPhone);
    const phone = phoneResult.ok ? phoneResult.value : ownerPhone.trim();
    const username = phone;
    const email = (googleEmail || ownerEmail).trim();
    const params = new URLSearchParams();
    if (username) params.set('username', username);
    if (phone) params.set('phone', phone);
    if (email) params.set('email', email);

    if (!params.toString()) {
      setAvailability({
        username: emptyAvailabilityField,
        phone: emptyAvailabilityField,
        email: emptyAvailabilityField,
      });
      return;
    }

    const controller = new AbortController();
    setAvailability((prev) => ({
      username: username ? { ...prev.username, checking: true, message: '' } : emptyAvailabilityField,
      phone: phone ? { ...prev.phone, checking: true, message: '' } : emptyAvailabilityField,
      email: email ? { ...prev.email, checking: true, message: '' } : emptyAvailabilityField,
    }));

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/availability?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!data?.success) throw new Error('Availability check failed');
        setAvailability({
          username: data.fields.username.checked
            ? { checking: false, available: data.fields.username.available, message: data.fields.username.message || '' }
            : emptyAvailabilityField,
          phone: data.fields.phone.checked
            ? { checking: false, available: data.fields.phone.available, message: data.fields.phone.message || '' }
            : emptyAvailabilityField,
          email: data.fields.email.checked
            ? { checking: false, available: data.fields.email.available, message: data.fields.email.message || '' }
            : emptyAvailabilityField,
        });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setAvailability((prev) => ({
          username: { ...prev.username, checking: false },
          phone: { ...prev.phone, checking: false },
          email: { ...prev.email, checking: false },
        }));
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [googleEmail, ownerEmail, ownerPhone]);

  const handleModuleToggle = (moduleKey: string) => {
    if (selectedModules.includes(moduleKey)) {
      if (selectedModules.length === 1) return;
      setSelectedModules(selectedModules.filter(m => m !== moduleKey));
    } else {
      setSelectedModules([...selectedModules, moduleKey]);
    }
  };

  const handleAddonToggle = (addonKey: string) => {
    if (selectedAddons.includes(addonKey)) {
      setSelectedAddons(selectedAddons.filter(a => a !== addonKey));
    } else {
      setSelectedAddons([...selectedAddons, addonKey]);
    }
  };

  // Pricing calculations
  const getPricingQuote = () => {
    if (!catalog) return { base: 0, modules: 0, addons: 0, total: 0, planPrice: 0, verticalCount: 1 };
    
    const plan = catalog.plans.find((p: any) => p.plan === selectedPlan);
    const planPrice = plan ? plan.monthlyPrice : 0;

    const addons = catalog.addons
      .filter((a: any) => selectedAddons.includes(a.addon))
      .reduce((sum: number, a: any) => sum + a.monthlyPrice, 0);
    const verticalPricing = calculateVerticalSubscriptionPricing(planPrice, selectedModules, addons);

    return {
      base: verticalPricing.basePlanPrice,
      modules: verticalPricing.modulesPrice,
      addons,
      total: verticalPricing.totalMonthlyPrice,
      planPrice,
      verticalCount: verticalPricing.verticalCount
    };
  };

  const quote = getPricingQuote();

  const handleNext = () => {
    if (step === 1) {
      if (!businessName || !ownerName || !ownerPhone || (!isGoogleRegister && !ownerPassword)) {
        setError('Please fill in all owner and business details.');
        return;
      }
      if (!isGoogleRegister) {
        const ec = validateEmail(ownerEmail);
        if (!ec.ok) { setError(ec.error); return; }
        const pc = validateIndianMobile(ownerPhone);
        if (!pc.ok) { setError(pc.error); return; }
      }
      const duplicate = [availability.username, availability.phone, availability.email].find((item) => item.available === false);
      if (duplicate) { setError(duplicate.message); return; }
      if ([availability.username, availability.phone, availability.email].some((item) => item.checking)) {
        setError('Checking username, phone and email availability. Please try again in a moment.');
        return;
      }
      setError('');
      // Standalone (client domain) registration is a single Details step.
      if (simpleMode) { handleSubmit(); return; }
    }

    setError('');

    // Track step progression if we have a referral code
    if (referralCode) {
      let stepName = `step_${step + 1}`;
      if (step === 1) stepName = 'step_2_modules';
      else if (step === 2) stepName = 'step_3_plans';
      else if (step === 3) stepName = 'step_4_addons';
      else if (step === 4) stepName = 'step_5_review';
      
      fetch('/api/affiliate/track-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: referralCode,
          businessName,
          ownerName,
          phone: ownerPhone,
          email: googleEmail || '',
          step: stepName,
          plan: selectedPlan,
          modules: selectedModules,
          addons: selectedAddons
        })
      }).catch(err => console.error('Error tracking step', err));
    }
    
    setStep(prev => prev + 1);
  };

  const handlePrev = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!termsAccepted && !simpleMode) {
      setError('You must accept the Terms and Conditions to register.');
      return;
    }
    setError('');

    if (!isGoogleRegister) {
      const ec = validateEmail(ownerEmail);
      if (!ec.ok) { setError(ec.error); return; }
      const pc = validateIndianMobile(ownerPhone);
      if (!pc.ok) { setError(pc.error); return; }
    }
    const duplicate = [availability.username, availability.phone, availability.email].find((item) => item.available === false);
    if (duplicate) { setError(duplicate.message); return; }
    if ([availability.username, availability.phone, availability.email].some((item) => item.checking)) {
      setError('Checking username, phone and email availability. Please try again in a moment.');
      return;
    }

    setLoading(true);

    // For Supabase-brokered Google onboarding, capture the live session token so
    // the server can verify the email and the client can bridge into the session.
    let supabaseAccessToken: string | null = null;
    if (isGoogleRegister && isSupabaseAuthEnabled()) {
      try {
        const { data } = await getSupabaseBrowser().auth.getSession();
        supabaseAccessToken = data.session?.access_token ?? null;
      } catch { /* fall back to legacy googleId path */ }
    }

    try {
      const endpoint = isGoogleRegister ? '/api/register/google' : '/api/register/email';
      const payload = isGoogleRegister
        ? {
            googleId,
            supabaseAccessToken,
            ownerEmail: googleEmail,
            ownerName,
            businessName,
            ownerPhone,
            selectedPlan,
            selectedModules,
            selectedAddons,
            referralCode
          }
        : {
            businessName,
            ownerName,
            ownerPhone,
            ownerEmail,
            ownerPassword,
            selectedPlan,
            selectedModules,
            selectedAddons,
            referralCode
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      
      if (!data.success) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Track completion if we have a referral code
      if (referralCode) {
        fetch('/api/affiliate/track-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: referralCode,
            businessName,
            ownerName,
            phone: ownerPhone,
            email: googleEmail || '',
            step: 'step_5_review',
            status: 'completed',
            plan: selectedPlan,
            modules: selectedModules,
            addons: selectedAddons
          })
        }).catch(err => console.error('Error tracking completion', err));
      }

      // Successfully registered.
      if (isGoogleRegister) {
        // Bridge the existing Supabase (Google) session straight into the app
        // session. Fall back to the legacy NextAuth Google provider if needed.
        if (supabaseAccessToken) {
          await signIn('supabase', { access_token: supabaseAccessToken, redirect: true, callbackUrl: '/portal' });
        } else {
          await signIn('google', { callbackUrl: '/portal' });
        }
      } else {
        router.push(`/login?registerPending=1&emailSent=${data.emailSent ? 1 : 0}&username=${encodeURIComponent(data.username || ownerPhone)}&email=${encodeURIComponent(ownerEmail || '')}`);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  if (catalogLoading) {
    return (
      <div className="login-wrapper">
        <div className="login-card" style={{ maxWidth: '600px', textAlign: 'center', padding: '40px' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 20px' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading registration catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrapper" style={{ minHeight: '100vh', padding: '40px 20px' }}>
      <div className="login-card" style={{ maxWidth: '750px', width: '100%' }}>
        
        {/* Header */}
        <div className="login-logo" style={{ marginBottom: '16px' }}>
          <img src="/assets/logo.svg" alt="LoanTrack" />
          <h1>Loan<span>Track</span></h1>
        </div>
        <h2 style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
          Register Your Lending Business
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.85rem', marginBottom: '32px' }}>
          Configure tenant workspace, vertical subscription, and add-ons
        </p>

        {/* Stepper Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '15px', left: '10%', right: '10%', height: '2px', background: 'var(--border)', zIndex: 1 }}>
            <div style={{ height: '100%', background: 'var(--primary)', width: `${((step - 1) / 4) * 100}%`, transition: 'width 0.3s' }}></div>
          </div>
          {(simpleMode ? [1] : [1, 2, 3, 4, 5]).map((num) => (
            <div key={num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, position: 'relative' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: step >= num ? 'var(--primary)' : 'var(--bg-light)',
                color: step >= num ? '#fff' : 'var(--text-secondary)',
                border: `2px solid ${step >= num ? 'var(--primary)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 600, fontSize: '0.85rem'
              }}>
                {num}
              </div>
              <span style={{ fontSize: '0.72rem', color: step >= num ? 'var(--text-primary)' : 'var(--text-light)', marginTop: '6px', fontWeight: step === num ? 600 : 400 }}>
                {num === 1 ? 'Details' : num === 2 ? 'Verticals' : num === 3 ? 'Plan' : num === 4 ? 'Add-ons' : 'Review'}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div className="login-error" style={{ marginBottom: '24px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {/* Step 1: Details */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isGoogleRegister && (
                <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="material-icons-outlined" style={{ color: 'var(--success)', fontSize: '20px' }}>check_circle</span>
                  <div style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                    Authenticated with Google email: <strong>{googleEmail}</strong>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Spring Green Microfinance"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Owner Full Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter owner name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner Mobile Phone</label>
                  <input
                    type="tel"
                    className="form-control"
                    style={phoneError ? { borderColor: 'var(--danger)' } : undefined}
                    placeholder="e.g. 9876543210"
                    value={ownerPhone}
                    onChange={(e) => { setOwnerPhone(e.target.value); if (phoneError) setPhoneError(''); }}
                    onBlur={() => { const r = validateIndianMobile(ownerPhone); setPhoneError(r.ok ? '' : r.error); }}
                    required
                  />
                  {phoneError && <small style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{phoneError}</small>}
                  {!phoneError && (availability.phone.checking || availability.username.checking) && (
                    <small style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>Checking phone number...</small>
                  )}
                  {!phoneError && availability.phone.available === false && (
                    <small style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{availability.phone.message}</small>
                  )}
                  {!phoneError && availability.phone.available !== false && availability.username.available === false && (
                    <small style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{availability.username.message}</small>
                  )}
                  {!phoneError && !availability.phone.checking && !availability.username.checking && availability.phone.available !== false && availability.username.available !== false && (
                    <small style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>
                      Your phone number is also your login username.
                    </small>
                  )}
                </div>
              </div>

              {!isGoogleRegister && (
                <div className="form-group">
                  <label className="form-label">Owner Email</label>
                  <input
                    type="email"
                    className="form-control"
                    style={emailError ? { borderColor: 'var(--danger)' } : undefined}
                    placeholder="you@business.com"
                    value={ownerEmail}
                    onChange={(e) => { setOwnerEmail(e.target.value); if (emailError) setEmailError(''); }}
                    onBlur={() => { const r = validateEmail(ownerEmail); setEmailError(r.ok ? '' : r.error); }}
                    required
                  />
                  {emailError ? (
                    <small style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{emailError}</small>
                  ) : availability.email.checking ? (
                    <small style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>Checking email...</small>
                  ) : availability.email.available === false ? (
                    <small style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{availability.email.message}</small>
                  ) : (
                    <small style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>
                      We'll send an activation link here — your account stays inactive until verified.
                    </small>
                  )}
                </div>
              )}

              {!isGoogleRegister && (
                <div className="form-group">
                  <label className="form-label">Login Password</label>
                  <PasswordInput
                    className="form-control"
                    placeholder="Choose password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Verticals */}
          {step === 2 && (
            <div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Choose the vertical base for this workspace. Each selected vertical uses its own subscription; extra verticals are not add-ons.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {catalog.modules.map((m: any) => {
                  const isEnabled = selectedModules.includes(m.module);
                  return (
                    <div
                      key={m.module}
                      onClick={() => handleModuleToggle(m.module)}
                      style={{
                        padding: '16px', borderRadius: '10px',
                        background: isEnabled ? 'var(--bg-light)' : 'transparent',
                        border: `2px solid ${isEnabled ? 'var(--primary)' : 'var(--border)'}`,
                        cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '24px', color: isEnabled ? 'var(--primary)' : 'var(--text-light)' }}>
                          {m.module === 'microlending' ? 'monetization_on' : m.module === 'autofinance' ? 'directions_car' : m.module === 'goldloan' ? 'account_balance' : 'groups'}
                        </span>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{m.displayName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{m.description}</div>
                          {isEnabled && selectedModules.length === 1 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '4px' }}>At least one vertical is required</div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {quote.planPrice === 0 ? 'Included with selected plan' : 'Plan price applies'}
                        </span>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => {}}
                          style={{ pointerEvents: 'none' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Plans */}
          {step === 3 && (
            <div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Select a subscription plan that fits your business scale. The selected plan is billed once for each active vertical.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                {catalog.plans.map((p: any) => {
                  const isSelected = selectedPlan === p.plan;
                  let featuresList = [];
                  try {
                    featuresList = typeof p.features === 'string' ? JSON.parse(p.features || '[]') : (Array.isArray(p.features) ? p.features : []);
                  } catch(e) {
                    console.error('Failed to parse features:', p.features);
                  }
                  return (
                    <div
                      key={p.plan}
                      onClick={() => setSelectedPlan(p.plan)}
                      style={{
                        padding: '20px 16px', borderRadius: '12px',
                        background: isSelected ? 'var(--bg-light)' : 'transparent',
                        border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                        cursor: 'pointer', display: 'flex', flexDirection: 'column',
                        textAlign: 'center', transition: 'all 0.2s'
                      }}
                    >
                      <span className="badge badge-primary" style={{ alignSelf: 'center', marginBottom: '12px', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                        {p.plan}
                      </span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ₹{p.monthlyPrice}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/vertical/mo</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '8px 0 16px', minHeight: '36px' }}>
                        {p.description}
                      </p>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'left', flexGrow: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--success)' }}>check</span>
                          Max Branches: {p.maxBranches === 999 ? 'Unlimited' : p.maxBranches}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--success)' }}>check</span>
                          Max Agents: {p.maxAgents === 999 ? 'Unlimited' : p.maxAgents}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--success)' }}>check</span>
                          Max Active Loans: {p.maxActiveLoans === 999999 ? 'Unlimited' : p.maxActiveLoans}
                        </div>
                        {featuresList.slice(0, 3).map((f: string, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--success)' }}>check</span>
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Add-ons */}
          {step === 4 && (
            <div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Select add-on features to activate in your workspace. You can disable them anytime.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {catalog.addons.map((a: any) => {
                  const isEnabled = selectedAddons.includes(a.addon);
                  return (
                    <div
                      key={a.addon}
                      onClick={() => handleAddonToggle(a.addon)}
                      style={{
                        padding: '16px', borderRadius: '10px',
                        background: isEnabled ? 'var(--bg-light)' : 'transparent',
                        border: `2px solid ${isEnabled ? 'var(--primary)' : 'var(--border)'}`,
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '24px', color: isEnabled ? 'var(--primary)' : 'var(--text-light)' }}>
                          {a.addon === 'whatsapp_sms' ? 'sms' : a.addon === 'kyc' ? 'assignment_ind' : a.addon === 'gps_tracking' ? 'my_location' : a.addon === 'premium_accounting' ? 'receipt_long' : 'account_balance'}
                        </span>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{a.displayName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{a.description}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          +₹{a.monthlyPrice}/mo
                        </span>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => {}}
                          style={{ pointerEvents: 'none' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 5: Review & Submit */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg-light)', padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Registration Review</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Pricing Quote</span>
                </div>
                
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Business details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', paddingBottom: '12px', borderBottom: '1px dashed var(--border)' }}>
                    <div>
                      <div style={{ color: 'var(--text-secondary)' }}>Workspace Profile</div>
                      <strong style={{ display: 'block', fontSize: '1rem', marginTop: '2px' }}>{businessName}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>Slug: {slugify(businessName) || 'pending'}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>Owner Profile</div>
                      <strong style={{ display: 'block', fontSize: '0.95rem', marginTop: '2px' }}>{ownerName}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{ownerPhone} (login username)</span>
                    </div>
                  </div>

                  {/* Pricing Quote Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Base Vertical Subscription ({selectedPlan.toUpperCase()})</span>
                      <strong style={{ color: 'var(--text-primary)' }}>₹{quote.base}/mo</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Additional Vertical Subscriptions ({Math.max(selectedModules.length - 1, 0)} extra)</span>
                      <strong style={{ color: 'var(--text-primary)' }}>₹{quote.modules}/mo</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Add-ons Activated ({selectedAddons.length} active)</span>
                      <strong style={{ color: 'var(--text-primary)' }}>+₹{quote.addons}/mo</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '4px' }}>
                      <span style={{ fontWeight: 700 }}>Total Estimated Monthly Price</span>
                      <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{quote.total}/mo</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  style={{ marginTop: '4px' }}
                />
                <label htmlFor="terms" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  I accept the Terms of Service, privacy policy and authorize LoanTrack to set up my workspace trial database immediately.
                </label>
              </div>

            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '36px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
            {step > 1 ? (
              <button type="button" className="btn btn-ghost" onClick={handlePrev} disabled={loading}>
                <span className="material-icons-outlined">arrow_back</span> Back
              </button>
            ) : (
              <a href="/login" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                Cancel
              </a>
            )}

            {step < 5 ? (
              <button type="button" className="btn btn-primary" onClick={handleNext} disabled={loading}>
                {simpleMode ? (loading ? 'Creating...' : 'Create Business') : 'Continue'} <span className="material-icons-outlined">arrow_forward</span>
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Setting up Workspace...' : 'Register Business'}
              </button>
            )}
          </div>

        </form>

      </div>
    </div>
  );
}

// Simple slugify copy for frontend preview
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="login-wrapper">
        <div className="login-card" style={{ maxWidth: '600px', textAlign: 'center', padding: '40px' }}>
          Loading...
        </div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
