'use client';

import { useTransition } from 'react';
import { initiateCheckout } from './actions';

export function CheckoutButton({ planId }: { planId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="btn btn-primary btn-sm"
      style={{ width: '100%', textAlign: 'center' }}
      onClick={() => startTransition(() => initiateCheckout(planId))}
      disabled={isPending}
    >
      {isPending ? 'Loading...' : 'Upgrade'}
    </button>
  );
}
