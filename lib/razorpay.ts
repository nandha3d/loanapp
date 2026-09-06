import crypto from 'node:crypto';

export function verifyRazorpayWebhookSignature(body: string, secret: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

type RazorpaySubscriptionOptions = {
  razorpayPlanId?: string;
  startAt?: number;
};

type RazorpaySubscriptionResult = {
  id: string;
  short_url: string | null;
  status: string;
};

/**
 * A Razorpay API call that failed, carrying enough detail for the billing UI to
 * tell an operator whether the problem is our configuration or Razorpay's side.
 * The generic "try again" message that used to be shown for every failure hid
 * unrecoverable errors such as rejected API keys.
 */
export class RazorpayApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'RazorpayApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Turns a non-2xx Razorpay response into a RazorpayApiError, logging the
 * description Razorpay returned. Only the error envelope is logged — it never
 * echoes the API key or secret back to us.
 */
async function razorpayFailure(res: Response, action: string): Promise<RazorpayApiError> {
  const body = await res.text().catch(() => '');
  let code: string | undefined;
  let description = '';
  try {
    const parsed = JSON.parse(body);
    code = typeof parsed?.error?.code === 'string' ? parsed.error.code : undefined;
    description = typeof parsed?.error?.description === 'string' ? parsed.error.description : '';
  } catch {
    // Razorpay occasionally returns HTML (gateway/maintenance pages).
  }
  console.error(`Razorpay ${action} failed`, { status: res.status, code, description });
  return new RazorpayApiError(description || `Razorpay ${action} failed`, res.status, code);
}

function getPlatformRazorpayAuth(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new RazorpayApiError('Razorpay keys not configured', 0, 'KEYS_MISSING');
  }
  return Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

/**
 * The Razorpay plan an operator pre-created in the dashboard for this SaaS plan.
 *
 * Preferred over creating a plan per checkout: Razorpay plans are immutable, so
 * the create-on-demand path leaves a fresh plan on the account for every attempt
 * and needs write access to the Plans API. Returns null when unset, which keeps
 * the dynamic-plan path as the fallback.
 */
export function getConfiguredRazorpayPlanId(planId: string): string | null {
  const configured: Record<string, string | undefined> = {
    basic: process.env.RAZORPAY_PLAN_BASIC,
    business: process.env.RAZORPAY_PLAN_BUSINESS,
    enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE,
  };
  return normalizeRazorpayPlanId(configured[planId]);
}

/**
 * Accepts a plan ID only in Razorpay's `plan_…` form, so a blank or half-filled
 * value from the pricing admin screen falls through to the next source instead
 * of failing the checkout.
 */
export function normalizeRazorpayPlanId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.startsWith('plan_') ? trimmed : null;
}

export function buildRazorpaySubscriptionRequest(
  planId: string,
  tenantId: string,
  options: RazorpaySubscriptionOptions = {},
) {
  const planIdMap: Record<string, string | undefined> = {
    basic: process.env.RAZORPAY_PLAN_BASIC,
    business: process.env.RAZORPAY_PLAN_BUSINESS,
    enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE,
  };
  const razorpayPlanId = options.razorpayPlanId ?? planIdMap[planId] ?? planId;

  if (!razorpayPlanId.startsWith('plan_')) {
    throw new Error(`No Razorpay plan ID configured for plan "${planId}". Set RAZORPAY_PLAN_${planId.toUpperCase()} in your environment.`);
  }

  return {
    plan_id: razorpayPlanId,
    total_count: parseInt(process.env.RAZORPAY_SUB_TOTAL_COUNT ?? '120', 10) || 120,
    customer_notify: 1,
    ...(options.startAt && Number.isInteger(options.startAt) ? { start_at: options.startAt } : {}),
    notes: {
      tenant_id: tenantId,
      ...(options.razorpayPlanId ? { loantrack_plan: planId } : {}),
    },
  };
}

/**
 * Razorpay Plans are immutable. A platform plan is therefore created from the
 * tenant's complete recurring price (base plan + verticals + add-ons) before
 * the subscription is created, preventing a client-supplied amount override.
 */
export async function createRazorpayPlan(input: {
  tenantId: string;
  planId: string;
  displayName: string;
  amountRupees: number;
}): Promise<string> {
  if (!Number.isFinite(input.amountRupees) || input.amountRupees <= 0) {
    throw new Error('Subscription amount must be greater than zero');
  }

  if (process.env.RAZORPAY_MOCK_CHECKOUT === 'true') {
    return `plan_mock_${input.planId}_${Math.round(input.amountRupees * 100)}`;
  }

  const res = await fetch('https://api.razorpay.com/v1/plans', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${getPlatformRazorpayAuth()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      period: 'monthly',
      interval: 1,
      item: {
        name: `ZoloFund ${input.displayName}`.slice(0, 100),
        description: 'ZoloFund SaaS monthly subscription',
        amount: Math.round(input.amountRupees * 100),
        currency: 'INR',
      },
      notes: {
        tenant_id: input.tenantId,
        loantrack_plan: input.planId,
      },
    }),
  });

  if (!res.ok) throw await razorpayFailure(res, 'plan creation');

  const data = await res.json();
  if (typeof data.id !== 'string' || !data.id.startsWith('plan_')) {
    throw new Error('Razorpay returned an invalid plan');
  }
  return data.id;
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

export async function createRazorpaySubscription(
  planId: string,
  tenantId: string,
  options: RazorpaySubscriptionOptions = {},
): Promise<RazorpaySubscriptionResult> {
  if (process.env.RAZORPAY_MOCK_CHECKOUT === 'true') {
    const request = buildRazorpaySubscriptionRequest(planId, tenantId, options);
    return {
      id: `mock_sub_${tenantId}_${request.plan_id}`,
      short_url: `/portal/billing/mock-checkout?subscription=mock_sub_${encodeURIComponent(tenantId)}`,
      status: 'created',
    };
  }

  const requestBody = buildRazorpaySubscriptionRequest(planId, tenantId, options);

  const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${getPlatformRazorpayAuth()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) throw await razorpayFailure(res, 'subscription creation');

  const data = await res.json();
  if (typeof data.id !== 'string' || !data.id.startsWith('sub_')) {
    throw new Error('Razorpay returned an invalid subscription');
  }
  return {
    id: data.id,
    short_url: typeof data.short_url === 'string' ? data.short_url : null,
    status: typeof data.status === 'string' ? data.status : 'created',
  };
}

export async function getRazorpaySubscription(subscriptionId: string): Promise<RazorpaySubscriptionResult | null> {
  if (!subscriptionId.startsWith('sub_')) return null;

  const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Basic ${getPlatformRazorpayAuth()}` },
  });
  if (!res.ok) return null;

  const data = await res.json();
  return {
    id: data.id,
    short_url: typeof data.short_url === 'string' ? data.short_url : null,
    status: typeof data.status === 'string' ? data.status : 'created',
  };
}
