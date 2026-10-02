import Link from 'next/link';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getPlatformPaymentSettings } from '@/lib/platformPayment';
import { SubscribeCheckout } from './SubscribeCheckout';

export const dynamic = 'force-dynamic';

/**
 * Opens Razorpay Standard Checkout for a subscription we created, then sends the
 * payer back into the app. Razorpay's hosted short_url page cannot do this — it
 * has no return URL and leaves the user on its own "subscription is active" page.
 *
 * Public on purpose: a new tenant pays straight after registering, before they
 * have a session. Only subscription ids stored on one of our tenants are served.
 */
export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>;
}) {
  const { sub } = await searchParams;
  const subscriptionId = typeof sub === 'string' ? sub : '';

  const record = /^sub_[A-Za-z0-9]{6,40}$/.test(subscriptionId)
    ? await prisma.tenantSubscription.findFirst({
        where: { razorpaySubId: subscriptionId },
        select: { id: true },
      })
    : null;
  const platform = record ? await getPlatformPaymentSettings() : null;

  if (!record || !platform?.keyId) {
    return (
      <main style={{ maxWidth: 480, margin: '80px auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.3rem', marginBottom: 8 }}>Checkout unavailable</h1>
        <p style={{ color: '#64748b', marginBottom: 20 }}>
          This payment link is invalid or payments are not configured. Please return and try again.
        </p>
        <Link href="/login">Back to sign in</Link>
      </main>
    );
  }

  // Signed in (upgrade from Billing) -> back to Billing; otherwise (fresh
  // registration) -> sign-in, where the new account can now log in.
  const session = await auth();
  const returnUrl = session?.user ? '/portal/billing?payment=success' : '/login?payment=success';
  const cancelUrl = session?.user ? '/portal/billing' : '/login';

  return (
    <SubscribeCheckout
      keyId={platform.keyId}
      subscriptionId={subscriptionId}
      returnUrl={returnUrl}
      cancelUrl={cancelUrl}
    />
  );
}
