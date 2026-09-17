'use client';

import { useState, useTransition } from 'react';
import { initiateCheckout } from './actions';

export function CheckoutButton({ planId, label = 'Pay & Activate' }: { planId: string; label?: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ width: '100%' }}>
      <button
        className="btn btn-primary"
        style={{
          width: '100%',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '0.95rem',
          padding: '10px 16px',
          borderRadius: '8px',
          letterSpacing: '0.01em',
          cursor: isPending ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
        }}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await initiateCheckout(planId);
            if (result?.error) setError(result.error);
          });
        }}
        disabled={isPending}
      >
        {isPending ? 'Opening secure checkout…' : label}
      </button>
      {error ? (
        <div
          role="alert"
          style={{
            color: '#b91c1c',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '0.8rem',
            marginTop: '10px',
            lineHeight: 1.4,
            textAlign: 'left',
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
