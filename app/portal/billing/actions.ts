'use server';

import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { createRazorpaySubscription } from '@/lib/razorpay';
import { redirect } from 'next/navigation';

export async function initiateCheckout(planId: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const role = (session.user as any)?.role;
  if (role !== 'superadmin' && role !== 'developer' && role !== 'admin') {
    throw new Error('Forbidden');
  }

  const tenantId = await getDefaultTenantId();

  try {
    const sub = await createRazorpaySubscription(planId, tenantId);
    if (sub.short_url) {
      redirect(sub.short_url);
    }
  } catch (error) {
    console.error('Checkout error:', error);
    throw new Error('Failed to initiate checkout');
  }
}
