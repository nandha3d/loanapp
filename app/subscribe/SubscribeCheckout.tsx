'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { Razorpay?: any }
}

function loadRazorpayCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function SubscribeCheckout({
  keyId,
  subscriptionId,
  returnUrl,
  cancelUrl,
}: {
  keyId: string;
  subscriptionId: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);
  const opened = useRef(false);

  const open = useCallback(async () => {
    setError('');
    if (!(await loadRazorpayCheckout())) {
      setError('Could not load the secure payment window. Check your connection and try again.');
      return;
    }
    const rzp = new window.Razorpay({
      key: keyId,
      subscription_id: subscriptionId,
      name: 'ZoloFund',
      description: 'Subscription',
      theme: { color: '#2563eb' },
      // Success: leave Razorpay and return to the app.
      handler: async (response: Record<string, string>) => {
        setPaid(true);
        // Activate the plan now (signature-verified server-side) rather than
        // waiting on the webhook. Redirect even if this fails — the webhook
        // remains the fallback.
        try {
          await fetch('/api/subscribe/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
        } catch { /* webhook fallback */ }
        window.location.replace(returnUrl);
      },
      modal: { ondismiss: () => { window.location.replace(cancelUrl); } },
    });
    rzp.on('payment.failed', () => {
      setError('Payment failed. You can retry from the payment window.');
    });
    rzp.open();
  }, [keyId, subscriptionId, returnUrl, cancelUrl]);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    open();
  }, [open]);

  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: 24, textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.3rem', marginBottom: 8 }}>
        {paid ? 'Payment successful' : 'Opening secure checkout…'}
      </h1>
      <p style={{ color: '#64748b', marginBottom: 20 }}>
        {paid ? 'Taking you back to ZoloFund…' : 'Complete the payment in the Razorpay window.'}
      </p>
      {error ? <p role="alert" style={{ color: '#b91c1c', marginBottom: 16 }}>{error}</p> : null}
      {!paid ? (
        <button type="button" className="btn btn-primary" onClick={open}>
          Open payment window
        </button>
      ) : null}
    </main>
  );
}
