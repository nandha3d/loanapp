'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill parameters if redirected from Google
  const googleEmail = searchParams.get('google_email') || '';
  const googleName = searchParams.get('google_name') || '';
  const googleId = searchParams.get('google_id') || '';
  const isGoogleRegister = !!googleId;

  // Form state
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState(googleName || '');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerUsername, setOwnerUsername] = useState(
    googleEmail ? googleEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : ''
  );
  const [ownerPassword, setOwnerPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('basic');
  const [selectedModules, setSelectedModules] = useState(['microlending']);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [catalog, setCatalog] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState('');

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

  const handleModuleToggle = (moduleKey: string) => {
    if (moduleKey === 'microlending') return; // Cannot toggle off default module
    if (selectedModules.includes(moduleKey)) {
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
    if (!catalog) return { base: 0, modules: 0, addons: 0, total: 0 };
    
    const plan = catalog.plans.find((p: any) => p.plan === selectedPlan);
    const base = plan ? plan.monthlyPrice : 0;

    const modules = catalog.modules
      .filter((m: any) => selectedModules.includes(m.module))
      .reduce((sum: number, m: any) => sum + m.monthlyPrice, 0);

    const addons = catalog.addons
      .filter((a: any) => selectedAddons.includes(a.addon))
      .reduce((sum: number, a: any) => sum + a.monthlyPrice, 0);

    return {
      base,
      modules,
      addons,
      total: base + modules + addons
    };
  };

  const quote = getPricingQuote();

  const handleNext = () => {
    if (step === 1) {
      if (!businessName || !ownerName || !ownerPhone || !ownerUsername || (!isGoogleRegister && !ownerPassword)) {
        setError('Please fill in all owner and business details.');
        return;
      }
      setError('');
    }
    setStep(prev => prev + 1);
  };

  const handlePrev = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('You must accept the Terms and Conditions to register.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const endpoint = isGoogleRegister ? '/api/register/google' : '/api/register/email';
      const payload = isGoogleRegister
        ? {
            googleId,
            ownerEmail: googleEmail,
            ownerName,
            businessName,
            ownerPhone,
            selectedPlan,
            selectedModules,
            selectedAddons
          }
        : {
            businessName,
            ownerName,
            ownerPhone,
            ownerUsername,
            ownerPassword,
            selectedPlan,
            selectedModules,
            selectedAddons
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

      // Successfully registered. Redirect to login.
      // If they registered via Google, log them in immediately using NextAuth google provider
      if (isGoogleRegister) {
        await signIn('google', { callbackUrl: '/portal' });
      } else {
        router.push(`/login?registered=true&username=${encodeURIComponent(ownerUsername)}`);
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
          Configure tenant workspace, plan, modules, and add-ons
        </p>

        {/* Stepper Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '15px', left: '10%', right: '10%', height: '2px', background: 'var(--border)', zIndex: 1 }}>
            <div style={{ height: '100%', background: 'var(--primary)', width: `${((step - 1) / 4) * 100}%`, transition: 'width 0.3s' }}></div>
          </div>
          {[1, 2, 3, 4, 5].map((num) => (
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
                {num === 1 ? 'Details' : num === 2 ? 'Modules' : num === 3 ? 'Plan' : num === 4 ? 'Add-ons' : 'Review'}
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
                    placeholder="e.g. 9876543210"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isGoogleRegister ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Owner Login Username</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Choose login username"
                    value={ownerUsername}
                    onChange={(e) => setOwnerUsername(e.target.value)}
                    required
                  />
                </div>
                {!isGoogleRegister && (
                  <div className="form-group">
                    <label className="form-label">Login Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Choose password"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Modules */}
          {step === 2 && (
            <div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Select modules to activate in your workspace. You can customize active modules per branch.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {catalog.modules.map((m: any) => {
                  const isEnabled = selectedModules.includes(m.module);
                  const isDefault = m.module === 'microlending';
                  return (
                    <div
                      key={m.module}
                      onClick={() => handleModuleToggle(m.module)}
                      style={{
                        padding: '16px', borderRadius: '10px',
                        background: isEnabled ? 'var(--bg-light)' : 'transparent',
                        border: `2px solid ${isEnabled ? 'var(--primary)' : 'var(--border)'}`,
                        cursor: isDefault ? 'default' : 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '24px', color: isEnabled ? 'var(--primary)' : 'var(--text-light)' }}>
                          {m.module === 'microlending' ? 'monetization_on' : m.module === 'autofinance' ? 'directions_car' : 'groups'}
                        </span>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{m.displayName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{m.description}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {m.monthlyPrice === 0 ? 'Included' : `+₹${m.monthlyPrice}/mo`}
                        </span>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          disabled={isDefault}
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
                Select a subscription plan that fits your business scale. Plans determine branches and agents capacity.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                {catalog.plans.map((p: any) => {
                  const isSelected = selectedPlan === p.plan;
                  const featuresList = JSON.parse(p.features || '[]');
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
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/mo</span>
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
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{ownerUsername} • {ownerPhone}</span>
                    </div>
                  </div>

                  {/* Pricing Quote Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Base Subscription Plan ({selectedPlan.toUpperCase()})</span>
                      <strong style={{ color: 'var(--text-primary)' }}>₹{quote.base}/mo</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Modules Subscription ({selectedModules.length} active)</span>
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
              <button type="button" className="btn btn-primary" onClick={handleNext}>
                Continue <span className="material-icons-outlined">arrow_forward</span>
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
