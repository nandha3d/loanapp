'use server';

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  savePlatformPaymentSettings,
  testPlatformRazorpayConnection,
} from '@/lib/platformPayment';

export async function savePlatformPaymentSettingsAction(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (role !== 'developer') {
    return { success: false, error: 'Unauthorized: Only developers can modify platform payment settings.' };
  }

  const keyId = (formData.get('keyId') as string)?.trim();
  const keySecret = (formData.get('keySecret') as string)?.trim();
  const webhookSecret = (formData.get('webhookSecret') as string)?.trim();
  const mode = formData.get('mode') === 'test' ? 'test' : 'live';
  const mockCheckout = formData.get('mockCheckout') === 'true';
  const subTotalCount = parseInt(formData.get('subTotalCount') as string, 10) || 120;

  if (!keyId && !mockCheckout) {
    return { success: false, error: 'Razorpay Key ID is required unless Mock Checkout is enabled.' };
  }

  try {
    await savePlatformPaymentSettings({
      keyId: keyId || '',
      keySecret: keySecret || undefined,
      webhookSecret: webhookSecret || undefined,
      mode,
      mockCheckout,
      subTotalCount,
    });

    revalidatePath('/admin/settings/payment');
    revalidatePath('/portal/billing');
    return { success: true, message: 'Platform payment settings updated successfully.' };
  } catch (error: any) {
    console.error('Failed to save platform payment settings:', error);
    return { success: false, error: error?.message || 'Failed to save settings.' };
  }
}

export async function testPlatformRazorpayConnectionAction(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (role !== 'developer') {
    return { success: false, message: 'Unauthorized.' };
  }

  const keyId = (formData.get('keyId') as string)?.trim();
  const keySecret = (formData.get('keySecret') as string)?.trim();

  return await testPlatformRazorpayConnection(keyId, keySecret);
}
