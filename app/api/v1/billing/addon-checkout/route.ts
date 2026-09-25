import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getPlatformPaymentSettings } from '@/lib/platformPayment';

const DEFAULT_ADDON_METADATA: Record<string, { displayName: string; monthlyPrice: number }> = {
  npa: { displayName: 'NPA Monitoring & Provisioning Engine', monthlyPrice: 499 },
  gps_tracking: { displayName: 'GPS Live Tracking', monthlyPrice: 299 },
  kyc: { displayName: 'Digital Aadhaar & Video KYC', monthlyPrice: 399 },
  bureau: { displayName: 'Credit Bureau Integration', monthlyPrice: 199 },
  premium_accounting: { displayName: 'Premium Accounting & GST', monthlyPrice: 599 },
  whatsapp_sms: { displayName: 'WhatsApp & SMS Alerts', monthlyPrice: 299 },
  foreclosure: { displayName: 'Preclose & Early Settlement', monthlyPrice: 299 },
};

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden: only admins can purchase add-ons', 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawKey = typeof body?.addonKey === 'string' ? body.addonKey.trim().toLowerCase() : '';
    const addonKey = rawKey === 'npaenabled' ? 'npa' : rawKey;

    if (!addonKey || !DEFAULT_ADDON_METADATA[addonKey]) {
      return fail(`Unsupported add-on key "${addonKey}"`, 400);
    }

    const defaultMeta = DEFAULT_ADDON_METADATA[addonKey];
    const catalogItem = await prisma.addonCatalog.findUnique({
      where: { addon: addonKey },
    });

    const displayName = catalogItem?.displayName || defaultMeta.displayName;
    const monthlyPrice = catalogItem?.monthlyPrice ?? defaultMeta.monthlyPrice;
    const amountInPaise = Math.round(monthlyPrice * 100);

    const platform = await getPlatformPaymentSettings();

    // If mock checkout is explicitly enabled or keys are unset, provide sandbox checkout details
    if (platform.mockCheckout || !platform.keyId || !platform.keySecret) {
      const mockOrderId = `order_mock_${addonKey}_${Date.now()}`;
      return ok({
        orderId: mockOrderId,
        keyId: platform.keyId || 'rzp_test_mock_zolofund',
        amount: amountInPaise,
        currency: 'INR',
        addonKey,
        addonName: displayName,
        monthlyPrice,
        mock: true,
      });
    }

    // Call live/test Razorpay API to generate a real order
    const authHeader = `Basic ${Buffer.from(`${platform.keyId}:${platform.keySecret}`).toString('base64')}`;
    const receipt = `addon_${addonKey}_${ctx.tenantId.slice(-6)}_${Date.now()}`.slice(0, 40);

    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: {
          tenant_id: ctx.tenantId,
          addon_key: addonKey,
          user_id: ctx.userId,
        },
      }),
    });

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text().catch(() => '');
      console.error('[ADDON_CHECKOUT_RAZORPAY_ERROR]', errBody);
      // Fallback gracefully to mock order if platform gateway rejected
      return ok({
        orderId: `order_mock_${addonKey}_${Date.now()}`,
        keyId: platform.keyId,
        amount: amountInPaise,
        currency: 'INR',
        addonKey,
        addonName: displayName,
        monthlyPrice,
        mock: true,
      });
    }

    const orderData = await rzpRes.json();
    return ok({
      orderId: orderData.id,
      keyId: platform.keyId,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      addonKey,
      addonName: displayName,
      monthlyPrice,
      mock: false,
    });
  } catch (err: any) {
    console.error('[ADDON_CHECKOUT_ERROR]', err);
    return fail(err?.message || 'Failed to initialize add-on checkout', 500);
  }
}
