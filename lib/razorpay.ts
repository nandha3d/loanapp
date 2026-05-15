import crypto from 'node:crypto';

export function verifyRazorpayWebhookSignature(body: string, secret: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function createRazorpaySubscription(planId: string, tenantId: string, email?: string, phone?: string) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys not configured');
  }

  // Map internal plan names to actual Razorpay plan IDs from environment
  const planIdMap: Record<string, string | undefined> = {
    basic: process.env.RAZORPAY_PLAN_BASIC,
    pro: process.env.RAZORPAY_PLAN_PRO,
    enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE,
  };
  const razorpayPlanId = planIdMap[planId] ?? planId;

  if (!razorpayPlanId.startsWith('plan_')) {
    throw new Error(`No Razorpay plan ID configured for plan "${planId}". Set RAZORPAY_PLAN_${planId.toUpperCase()} in your environment.`);
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      plan_id: razorpayPlanId,
      total_count: 120, // Arbitrary large number for recurring
      customer_notify: 1,
      notes: {
        tenant_id: tenantId
      }
    })
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
