'use client';

import { useState, useTransition } from 'react';
import { initiateCheckout } from './actions';

export function CheckoutButton({ planId, label = 'Continue to payment' }: { planId: string; label?: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        className="btn btn-primary btn-sm"
        style={{ width: '100%', textAlign: 'center' }}
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
      {error ? <p role="alert" style={{ color: '#b91c1c', fontSize: '.78rem', marginTop: 8 }}>{error}</p> : null}
    </div>
  );
}
