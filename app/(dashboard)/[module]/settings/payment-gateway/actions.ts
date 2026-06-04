'use server';

import { revalidatePath } from 'next/cache';
import { requireApiContext, ADMIN_API_ROLES, isApiError } from '@/lib/apiAuth';
import { setSetting } from '@/lib/tenant';
import { saveTenantRazorpayConfig } from '@/lib/tenantRazorpay';

/** Admin-only: save this tenant's collections config (Tier-0 UPI + Razorpay). */
export async function saveGatewayAction(form: {
  upiId: string;
  enabled: boolean;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}) {
  const res = await requireApiContext(ADMIN_API_ROLES);
  if (isApiError(res)) return { success: false, error: 'Unauthorized' };
  const { context } = res;

  if (form.enabled && !form.keyId.trim()) {
    return { success: false, error: 'Key ID is required to enable the gateway.' };
  }
  try {
    // Tier-0: tenant's own UPI VPA (powers the dynamic intent QR, no PSP needed).
    await setSetting(context.tenantId, 'upi_id', form.upiId.trim(), 'payments');
    await saveTenantRazorpayConfig(context.tenantId, {
      enabled: form.enabled,
      keyId: form.keyId,
      keySecret: form.keySecret,
      webhookSecret: form.webhookSecret,
    });
    revalidatePath('/settings/payment-gateway');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to save gateway' };
  }
}
