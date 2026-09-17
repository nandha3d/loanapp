'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { initiateSubscriptionUpgrade, simulatePlanUpgrade } from './actions';

export type PlanCatalogItem = {
  id: string;
  plan: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  maxBranches: number;
  maxAgents: number;
  maxActiveLoans: number;
  features: string[];
  razorpayPlanId: string | null;
  isActive: boolean;
  sortOrder: number;
  calculatedPrice: {
    basePlanPrice: number;
    modulesPrice: number;
    addonsPrice: number;
    totalMonthlyPrice: number;
  };
};

type Props = {
  plans: PlanCatalogItem[];
  currentPlanKey: string;
  currentStatus: string;
  currentMaxBranches: number;
  currentMaxLoans: number;
  currentMaxAgents: number;
  activeBranchCount: number;
  dict: any;
};

export default function SubscriptionPlansClient({
  plans,
  currentPlanKey,
  currentStatus,
  currentMaxBranches,
  currentMaxLoans,
  currentMaxAgents,
  activeBranchCount,
  dict,
}: Props) {
  const d = dict.subscription || {};
  const router = useRouter();

  const [selectedPlan, setSelectedPlan] = useState<PlanCatalogItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSimulating, setIsSimulating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const openUpgradeModal = (plan: PlanCatalogItem) => {
    setSelectedPlan(plan);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isPending || isSimulating) return;
    setIsModalOpen(false);
    setSelectedPlan(null);
    setErrorMessage(null);
  };

  const handleProceedToRazorpay = () => {
    if (!selectedPlan) return;
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const result = await initiateSubscriptionUpgrade(selectedPlan.plan);
        if (result?.error) {
          setErrorMessage(result.error);
        }
      } catch (err: any) {
        // In Next.js, redirect() throws an internal NEXT_REDIRECT error which is expected
        if (err?.digest?.startsWith('NEXT_REDIRECT') || err?.message === 'NEXT_REDIRECT') {
          return;
        }
        setErrorMessage(err?.message || d.upgradeFailed || 'Unable to connect to Razorpay. Please try again.');
      }
    });
  };

  const handleSimulateUpgrade = async () => {
    if (!selectedPlan) return;
    setIsSimulating(true);
    setErrorMessage(null);
    try {
      const res = await simulatePlanUpgrade(selectedPlan.plan);
      if (res?.error) {
        setErrorMessage(res.error);
      } else if (res?.ok) {
        setSuccessMessage(`${d.upgradeSuccess || 'Subscription upgraded successfully!'} ${res.plan} is now active with ${res.maxBranches === 999 ? d.unlimited || 'unlimited' : res.maxBranches} branches.`);
        setTimeout(() => {
          setIsModalOpen(false);
          router.refresh();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Simulation failed.');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div style={{ marginTop: '32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px' }}>
          {d.availablePlansTitle || 'Available Subscription Plans'}
        </h2>
        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', margin: 0 }}>
          {d.availablePlansDesc || 'Upgrade your plan to unlock more branches, higher loan capacity, and extra field agents. Billed securely via Razorpay.'}
        </p>
      </div>

      {/* Plans Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          alignItems: 'stretch',
        }}
      >
        {plans.map((p) => {
          const isCurrent = p.plan.toLowerCase() === currentPlanKey.toLowerCase();
          const isPopular = p.plan.toLowerCase() === 'business';
          const isFree = p.monthlyPrice === 0;

          return (
            <div
              key={p.plan}
              className="card"
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '24px',
                borderRadius: '14px',
                border: isCurrent
                  ? '2px solid var(--primary, #3b82f6)'
                  : isPopular
                  ? '2px solid #f59e0b'
                  : '1px solid var(--border)',
                background: isCurrent
                  ? 'rgba(59, 130, 246, 0.03)'
                  : isPopular
                  ? 'rgba(245, 158, 11, 0.02)'
                  : 'var(--card-bg, #ffffff)',
                boxShadow: isPopular ? '0 10px 25px -5px rgba(245, 158, 11, 0.1)' : undefined,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              {/* Badges */}
              <div style={{ position: 'absolute', top: '-11px', right: '16px', display: 'flex', gap: '6px' }}>
                {isCurrent && (
                  <span
                    style={{
                      background: 'var(--primary, #3b82f6)',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    {d.currentPlanBadge || 'Current Plan'}
                  </span>
                )}
                {!isCurrent && isPopular && (
                  <span
                    style={{
                      background: '#f59e0b',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    ⭐ {d.popularBadge || 'Most Popular'}
                  </span>
                )}
              </div>

              {/* Top Details */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, textTransform: 'capitalize' }}>
                    {p.displayName}
                  </h3>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', minHeight: '36px', margin: '0 0 16px' }}>
                  {p.description || 'Flexible cloud lending suite for scaling NBFCs.'}
                </p>

                {/* Price Display */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {isFree ? 'Free' : `₹${p.monthlyPrice.toLocaleString('en-IN')}`}
                    </span>
                    {!isFree && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: 500 }}>
                        {d.perMonth || '/mo'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Core Resource Quotas */}
                <div
                  style={{
                    background: 'var(--bg, #f8fafc)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Branches Quota - Strongly highlighted */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#3b82f6' }}>store</span>
                      {d.branchesLimit || 'Branches'}:
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: p.maxBranches > currentMaxBranches ? '#16a34a' : 'inherit',
                        background: p.maxBranches > currentMaxBranches ? 'rgba(22, 163, 74, 0.1)' : 'transparent',
                        padding: p.maxBranches > currentMaxBranches ? '2px 8px' : '0',
                        borderRadius: '6px',
                      }}
                    >
                      {p.maxBranches >= 999 ? (d.unlimited || 'Unlimited') : `${p.maxBranches} Branches`}
                    </span>
                  </div>

                  {/* Loans Quota */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>payments</span>
                      {d.loansLimit || 'Active Loans'}:
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {p.maxActiveLoans >= 999999 ? (d.unlimited || 'Unlimited') : p.maxActiveLoans.toLocaleString()}
                    </span>
                  </div>

                  {/* Agents Quota */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>badge</span>
                      {d.agentsLimit || 'Field Agents'}:
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {p.maxAgents >= 999 ? (d.unlimited || 'Unlimited') : p.maxAgents.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Features list */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-light)', marginBottom: '10px' }}>
                    {d.includedFeatures || 'Included Features'}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {p.features.map((feat, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#16a34a', marginTop: '2px', flexShrink: 0 }}>
                          check_circle
                        </span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ marginTop: 'auto' }}>
                {isCurrent ? (
                  <button
                    disabled
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      padding: '10px',
                      opacity: 0.8,
                      cursor: 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>done</span>
                    {d.currentPlanBadge || 'Current Plan'}
                  </button>
                ) : (
                  <button
                    onClick={() => openUpgradeModal(p)}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 600,
                    }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>rocket_launch</span>
                    {`${d.upgradeToPlan || 'Upgrade to'} ${p.displayName}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upgrade Plan Modal */}
      {isModalOpen && selectedPlan && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={closeModal}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '540px',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              border: '1px solid var(--border)',
              background: 'var(--card-bg, #ffffff)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 4px' }}>
                  {d.upgradeModalTitle || 'Upgrade Subscription Plan'}
                </h3>
                <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', margin: 0 }}>
                  {d.upgradeModalDesc || 'Review your upgrade details below. You will be redirected to Razorpay for secure checkout.'}
                </p>
              </div>
              <button
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-light)',
                  padding: '4px',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            {/* Error & Success Messages */}
            {errorMessage && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #f87171',
                  color: '#991b1b',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  marginBottom: '18px',
                  lineHeight: 1.4,
                }}
              >
                <strong>Error: </strong> {errorMessage}
              </div>
            )}

            {successMessage && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #4ade80',
                  color: '#166534',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  marginBottom: '18px',
                }}
              >
                {successMessage}
              </div>
            )}

            {/* Plan Comparison Box */}
            <div
              style={{
                background: 'var(--bg, #f8fafc)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 600, marginBottom: '4px' }}>
                    {d.currentTier || 'Current Tier'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', textTransform: 'capitalize' }}>
                    {currentPlanKey}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#16a34a', fontWeight: 600, marginBottom: '4px' }}>
                    {d.upgradedTier || 'Upgraded Tier'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#16a34a', textTransform: 'capitalize' }}>
                    {selectedPlan.displayName}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                {/* Branches comparison */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{d.branchesLimit || 'Branches'}:</span>
                  <span style={{ fontWeight: 600 }}>
                    {currentMaxBranches >= 999 ? (d.unlimited || 'Unlimited') : currentMaxBranches}
                    {' ➔ '}
                    <strong style={{ color: '#16a34a' }}>
                      {selectedPlan.maxBranches >= 999 ? (d.unlimited || 'Unlimited') : `${selectedPlan.maxBranches} Branches`}
                    </strong>
                  </span>
                </div>

                {/* Loans comparison */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{d.loansLimit || 'Active Loans'}:</span>
                  <span style={{ fontWeight: 600 }}>
                    {currentMaxLoans >= 999999 ? (d.unlimited || 'Unlimited') : currentMaxLoans.toLocaleString()}
                    {' ➔ '}
                    <strong style={{ color: '#16a34a' }}>
                      {selectedPlan.maxActiveLoans >= 999999 ? (d.unlimited || 'Unlimited') : selectedPlan.maxActiveLoans.toLocaleString()}
                    </strong>
                  </span>
                </div>

                {/* Agents comparison */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{d.agentsLimit || 'Field Agents'}:</span>
                  <span style={{ fontWeight: 600 }}>
                    {currentMaxAgents >= 999 ? (d.unlimited || 'Unlimited') : currentMaxAgents.toLocaleString()}
                    {' ➔ '}
                    <strong style={{ color: '#16a34a' }}>
                      {selectedPlan.maxAgents >= 999 ? (d.unlimited || 'Unlimited') : selectedPlan.maxAgents.toLocaleString()}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Total Billing & Price Breakdown */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{d.monthlyTotal || 'Total Monthly Charge'}:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary, #3b82f6)' }}>
                  {selectedPlan.monthlyPrice === 0 ? (
                    'Free'
                  ) : (
                    <>
                      ₹{selectedPlan.monthlyPrice.toLocaleString('en-IN')}
                      <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-light)' }}>{d.perMonth || '/mo'}</span>
                    </>
                  )}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-light)' }}>
                {selectedPlan.monthlyPrice === 0
                  ? 'Free plan includes core branch, loan, and field agent limits.'
                  : (d.planBilledMonthly || 'Billed securely via Razorpay on a monthly cadence.')}
              </p>
            </div>

            {/* Razorpay Security Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '20px',
              }}
            >
              <span className="material-icons-outlined" style={{ color: '#2563eb', fontSize: '20px' }}>security</span>
              <span>100% Secure Checkout via <strong>Razorpay</strong>. Supports UPI AutoPay, Credit/Debit Cards, and NetBanking.</span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={handleProceedToRazorpay}
                disabled={isPending || isSimulating}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isPending ? (
                  <>
                    <span className="material-icons-outlined spinner" style={{ animation: 'spin 1s linear infinite' }}>sync</span>
                    {d.connectingRazorpay || 'Connecting to Razorpay...'}
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined">payment</span>
                    {d.proceedToRazorpay || 'Proceed to Razorpay Checkout'}
                  </>
                )}
              </button>

              {/* Development / Simulation Option if Razorpay credentials fail or in non-prod */}
              {errorMessage && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '8px', textAlign: 'center' }}>
                    {d.simulatedCheckoutNotice || 'Development Mode: Simulate payment to upgrade immediately without live gateway.'}
                  </p>
                  <button
                    className="btn btn-outline"
                    onClick={handleSimulateUpgrade}
                    disabled={isPending || isSimulating}
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderColor: '#16a34a',
                      color: '#16a34a',
                    }}
                  >
                    {isSimulating ? (
                      <>
                        <span className="material-icons-outlined spinner" style={{ animation: 'spin 1s linear infinite' }}>sync</span>
                        Activating Plan...
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined">check_circle</span>
                        {d.simulatePaymentBtn || 'Simulate Test Upgrade'}
                      </>
                    )}
                  </button>
                </div>
              )}

              <button
                className="btn btn-secondary"
                onClick={closeModal}
                disabled={isPending || isSimulating}
                style={{ width: '100%', padding: '10px', fontSize: '0.88rem' }}
              >
                {d.cancel || 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
