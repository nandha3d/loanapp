'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { modulePath } from '@/types/modules';

// First-run guided tour. Persists progress in localStorage (per browser) so it
// only appears until finished or skipped. Each step navigates to its section on
// "Next" and tells the user the action to perform there. Mounted in the
// dashboard layout, so the card survives client-side navigation between steps.

type Step = {
  title: string;
  body: string;
  /** Page (within the current module) this step sends the user to. */
  page: string;
  /** Optional CSS selector to spotlight once the page has rendered. */
  highlight?: string;
};

const ADMIN_STEPS: Step[] = [
  {
    title: 'Welcome to LoanTrack 👋',
    body: "Let's set your business up in a few steps. Each step takes you to the right screen — do the action there, then press Next.",
    page: '/dashboard',
  },
  {
    title: 'Step 1 — Create a Route / Line',
    body: 'Routes group customers for daily collection. Open the Routes tab and add your first route, assigning an agent to it.',
    page: '/settings?tab=routes',
    highlight: 'a[href*="/settings"]',
  },
  {
    title: 'Step 2 — Add a Customer',
    body: 'Press "New Customer", fill the details, and assign the route (and agent) you just created so the agent can collect.',
    page: '/customers',
    highlight: 'a[href*="/customers"]',
  },
  {
    title: 'Step 3 — Create a Loan',
    body: 'Press "New Loan", pick the customer, set the principal, frequency (daily/weekly/monthly) and tenure, then disburse.',
    page: '/loans',
    highlight: 'a[href*="/loans"]',
  },
  {
    title: 'Step 4 — Record a Collection',
    body: 'Open a due instalment here and record the payment (cash / UPI / bank). This is what your agents do every day.',
    page: '/collection',
    highlight: 'a[href*="/collection"]',
  },
  {
    title: "You're all set 🎉",
    body: 'That covers the core flow: Route → Customer → Loan → Collection. Explore Reports, Penalties and Settings any time. You can reopen this guide from Settings.',
    page: '/dashboard',
  },
];

const AGENT_STEPS: Step[] = [
  {
    title: 'Welcome 👋',
    body: "Here's how to do your daily work. Press Next to jump to each screen.",
    page: '/dashboard',
  },
  {
    title: 'Your Customers',
    body: 'These are the customers on your routes. Tap one to see their loans and dues.',
    page: '/customers',
    highlight: 'a[href*="/customers"]',
  },
  {
    title: 'Record Collections',
    body: "Open today's due instalments and record each payment with cash, UPI or a photo proof.",
    page: '/collection',
    highlight: 'a[href*="/collection"]',
  },
  {
    title: "You're ready 🎉",
    body: 'Collect on time and your hit-rate climbs. Reopen this guide from Settings whenever you need it.',
    page: '/dashboard',
  },
];

const STORAGE_KEY = 'lt_onboarding_v1';

export default function OnboardingTour({
  module,
  role,
}: {
  module: string;
  role: string;
}) {
  const router = useRouter();
  const steps = role === 'agent' ? AGENT_STEPS : ADMIN_STEPS;
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);

  // Decide on mount whether to show (first run = no stored "done" flag).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { done?: boolean; index?: number };
        if (saved.done) return;
        if (typeof saved.index === 'number') setIndex(saved.index);
      }
      setActive(true);
    } catch {
      setActive(true);
    }
  }, []);

  // Spotlight the target element for the current step, if present.
  useEffect(() => {
    if (!active) return;
    const sel = steps[index]?.highlight;
    if (!sel) return;
    const timer = window.setTimeout(() => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return;
      el.classList.add('lt-tour-spot');
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      document.querySelectorAll('.lt-tour-spot').forEach((e) => e.classList.remove('lt-tour-spot'));
    };
  }, [active, index, steps]);

  const persist = useCallback((next: { done?: boolean; index?: number }) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    persist({ done: true });
    document.querySelectorAll('.lt-tour-spot').forEach((e) => e.classList.remove('lt-tour-spot'));
  }, [persist]);

  const goTo = useCallback(
    (next: number) => {
      if (next >= steps.length) {
        finish();
        return;
      }
      setIndex(next);
      persist({ index: next });
      const page = steps[next].page;
      if (page) router.push(modulePath(module, page));
    },
    [steps, finish, persist, router, module],
  );

  if (!active) return null;
  const step = steps[index];
  const isLast = index === steps.length - 1;

  return (
    <>
      <style>{`
        .lt-tour-spot {
          outline: 3px solid var(--primary, #F5A623) !important;
          outline-offset: 2px;
          border-radius: 8px;
          animation: lt-tour-pulse 1.4s ease-in-out infinite;
        }
        @keyframes lt-tour-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(245,166,35,0.45); }
          50% { box-shadow: 0 0 0 6px rgba(245,166,35,0); }
        }
      `}</style>
      <div
        role="dialog"
        aria-label="Getting started guide"
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          zIndex: 9999,
          width: 'min(360px, calc(100vw - 32px))',
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #E2E8F0)',
          borderRadius: '14px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          padding: '18px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.5px' }}>
            GETTING STARTED · {index + 1}/{steps.length}
          </span>
          <button
            onClick={finish}
            aria-label="Skip guide"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light, #94A3B8)', fontSize: '0.78rem' }}
          >
            Skip
          </button>
        </div>

        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '2px 0 8px', color: 'var(--text-primary, #1E293B)' }}>
          {step.title}
        </h3>
        <p style={{ fontSize: '0.86rem', lineHeight: 1.5, color: 'var(--text-secondary, #64748B)', margin: 0 }}>
          {step.body}
        </p>

        {/* Progress bar segments */}
        <div style={{ display: 'flex', gap: '5px', margin: '14px 0' }}>
          {steps.map((_, i) => (
            <span
              key={i}
              style={{
                height: '4px',
                flex: 1,
                borderRadius: '2px',
                background: i <= index ? 'var(--primary)' : 'var(--border, #E2E8F0)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            style={{
              background: 'none',
              border: 'none',
              cursor: index === 0 ? 'default' : 'pointer',
              color: index === 0 ? 'var(--text-light, #CBD5E1)' : 'var(--text-secondary, #64748B)',
              fontSize: '0.85rem',
              padding: '8px 4px',
            }}
          >
            Back
          </button>
          <button
            onClick={() => goTo(index + 1)}
            style={{
              background: 'var(--primary, #F5A623)',
              color: '#fff',
              border: 'none',
              borderRadius: '9px',
              padding: '10px 20px',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            {isLast ? 'Finish' : 'Next →'}
          </button>
        </div>
      </div>
    </>
  );
}
