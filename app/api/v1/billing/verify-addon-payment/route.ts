import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getPlatformPaymentSettings } from '@/lib/platformPayment';
import { calculateVerticalSubscriptionPricing, normalizeEnabledModules } from '@/lib/subscription';

const ADDON_BOOLEAN_FIELDS: Record<string, string> = {
  npa: 'npaEnabled',
  npaenabled: 'npaEnabled',
  gps_tracking: 'gpsTrackingEnabled',
  gpstrackingenabled: 'gpsTrackingEnabled',
  kyc: 'kycEnabled',
  kycenabled: 'kycEnabled',
  bureau: 'bureauEnabled',
  bureauenabled: 'bureauEnabled',
  premium_accounting: 'premiumAccountingEnabled',
  premiumaccountingenabled: 'premiumAccountingEnabled',
  whatsapp_sms: 'whatsappSmsEnabled',
  whatsappsmsenabled: 'whatsappSmsEnabled',
  foreclosure: 'foreclosureEnabled',
  foreclosureenabled: 'foreclosureEnabled',
};

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden: only admins can manage add-ons', 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawKey = typeof body?.addonKey === 'string' ? body.addonKey.trim().toLowerCase() : '';
    const addonKey = rawKey === 'npaenabled' ? 'npa' : rawKey;
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    const paymentId = typeof body?.paymentId === 'string' ? body.paymentId : `pay_mock_${Date.now()}`;
    const signature = typeof body?.signature === 'string' ? body.signature : '';

    const booleanField = ADDON_BOOLEAN_FIELDS[addonKey];
    if (!booleanField) {
      return fail(`Invalid add-on key: "${addonKey}"`, 400);
    }

    const platform = await getPlatformPaymentSettings();
    const isMock = orderId.startsWith('order_mock_') || platform.mockCheckout || !platform.keySecret;

    // Signature verification for live non-mock payments
    if (!isMock) {
      if (!signature) {
        return fail('Missing Razorpay payment signature', 400);
      }
      const expectedSignature = crypto
        .createHmac('sha256', platform.keySecret || '')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      if (expectedSignature !== signature) {
        return fail('Invalid Razorpay payment signature', 400);
      }
    }

    // Load tenant subscription
    const sub = await prisma.tenantSubscription.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (!sub) {
      return fail('Subscription record not found for tenant', 404);
    }

    // Parse existing addons
    let currentAddons: string[] = [];
    try {
      if (sub.selectedAddons) {
        const parsed = JSON.parse(sub.selectedAddons);
        if (Array.isArray(parsed)) {
          currentAddons = parsed.filter((a): a is string => typeof a === 'string');
        }
      }
    } catch {
      currentAddons = [];
    }

    const updatedAddons = Array.from(new Set([...currentAddons, addonKey]));

    // Fetch addon pricing to update totals
    const addonRows = await prisma.addonCatalog.findMany({
      where: { addon: { in: updatedAddons }, isActive: true },
      select: { monthlyPrice: true },
    });
    const addonsPrice = addonRows.reduce((sum, item) => sum + item.monthlyPrice, 0);

    const enabledModules = normalizeEnabledModules(sub.enabledModules);
    const pricing = calculateVerticalSubscriptionPricing(
      sub.basePlanPrice,
      enabledModules,
      addonsPrice,
    );

    // Update subscription with activated add-on flag
    const updateData: Record<string, any> = {
      [booleanField]: true,
      selectedAddons: JSON.stringify(updatedAddons),
      addonsPrice,
      totalMonthlyPrice: pricing.totalMonthlyPrice,
    };

    const updatedSub = await prisma.tenantSubscription.update({
      where: { tenantId: ctx.tenantId },
      data: updateData,
    });

    // Create an invoice entry for this add-on purchase
    const itemCatalog = await prisma.addonCatalog.findUnique({
      where: { addon: addonKey },
    });
    const itemPrice = itemCatalog?.monthlyPrice ?? 499;

    await prisma.billingInvoice.create({
      data: {
        tenantId: ctx.tenantId,
        subscriptionId: updatedSub.id,
        amount: itemPrice,
        tax: 0,
        total: itemPrice,
        status: 'paid',
        dueDate: new Date(),
        paidAt: new Date(),
        razorpayId: paymentId,
        billingPeriod: new Date().toISOString().slice(0, 7),
      },
    }).catch((err) => {
      console.warn('[INVOICE_RECORD_WARNING]', err);
    });

    return ok({
      success: true,
      addonKey,
      booleanField,
      activated: true,
      message: `${addonKey.toUpperCase()} add-on activated successfully.`,
    });
  } catch (err: any) {
    console.error('[VERIFY_ADDON_PAYMENT_ERROR]', err);
    return fail(err?.message || 'Failed to verify add-on payment', 500);
  }
}
