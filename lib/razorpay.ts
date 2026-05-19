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
    pro: process.env.RAZORPAY_PLAN_PRO,
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
