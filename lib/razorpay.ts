import crypto from 'node:crypto';

export function verifyRazorpayWebhookSignature(body: string, secret: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function buildRazorpaySubscriptionRequest(planId: string, tenantId: string) {
  const planIdMap: Record<string, string | undefined> = {
    basic: process.env.RAZORPAY_PLAN_BASIC,
    business: process.env.RAZORPAY_PLAN_BUSINESS,
    enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE,
  };
  const razorpayPlanId = planIdMap[planId] ?? planId;

  if (!razorpayPlanId.startsWith('plan_')) {
    throw new Error(`No Razorpay plan ID configured for plan "${planId}". Set RAZORPAY_PLAN_${planId.toUpperCase()} in your environment.`);
  }

  return {
    plan_id: razorpayPlanId,
    total_count: 120,
    customer_notify: 1,
    notes: {
      tenant_id: tenantId,
    },
  };
}

/**
 * Creates a Razorpay Payment Link for a borrower self-pay instalment (mCollect-B).
 *
 * Multi-tenant: keys are the TENANT's own Razorpay account (passed in, never env)
 * so the repayment settles into the lender's bank — not the platform's. When the
 * tenant has not configured a gateway (no keys) it degrades to an internal hosted
 * UPI page so collection still works. `notes.token` + `notes.tenant_id` let the
 * per-tenant webhook reconcile the capture and resolve the tenant.
 */
export async function createRazorpayPaymentLink(input: {
  token: string;
  amount: number; // rupees
  description: string;
  tenantId: string;
  keyId?: string | null;
  keySecret?: string | null;
  customerName?: string;
  customerPhone?: string | null;
  callbackUrl: string;
}): Promise<{ id: string | null; shortUrl: string; mock: boolean }> {
  const keyId = input.keyId;
  const keySecret = input.keySecret;
  const internalUrl = `${input.callbackUrl}?token=${encodeURIComponent(input.token)}`;

  // No tenant gateway configured (or forced mock) -> internal hosted page.
  if (process.env.RAZORPAY_MOCK_CHECKOUT === 'true' || !keyId || !keySecret) {
    return { id: null, shortUrl: internalUrl, mock: true };
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round(input.amount * 100), // paise
      currency: 'INR',
      accept_partial: false,
      description: input.description,
      customer: input.customerName
        ? { name: input.customerName, contact: input.customerPhone ?? undefined }
        : undefined,
      notify: { sms: Boolean(input.customerPhone), email: false },
      notes: { token: input.token, tenant_id: input.tenantId },
      callback_url: internalUrl,
      callback_method: 'get',
    }),
  });
  if (!res.ok) {
    console.error('Razorpay payment link error:', await res.text());
    // Degrade gracefully to the internal hosted page rather than failing collection.
    return { id: null, shortUrl: internalUrl, mock: true };
  }
  const data = await res.json();
  return { id: data.id ?? null, shortUrl: data.short_url ?? internalUrl, mock: false };
}

export async function createRazorpaySubscription(planId: string, tenantId: string, email?: string, phone?: string) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (process.env.RAZORPAY_MOCK_CHECKOUT === 'true') {
    const request = buildRazorpaySubscriptionRequest(planId, tenantId);
    return {
      id: `mock_sub_${tenantId}_${request.plan_id}`,
      short_url: `/portal/billing/mock-checkout?subscription=mock_sub_${encodeURIComponent(tenantId)}`,
      status: 'created',
    };
  }

  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys not configured');
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const requestBody = buildRazorpaySubscriptionRequest(planId, tenantId);

  const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Razorpay Error:', errorText);
    throw new Error('Failed to create Razorpay subscription');
  }

  const data = await res.json();
  return {
    id: data.id,
    short_url: data.short_url,
    status: data.status,
  };
}
