'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { upsertSubscription } from '@/lib/subscription';

async function requireDeveloper() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function updateSubscription(formData: FormData) {
  try {
    await requireDeveloper();
    const tenantId = formData.get('tenantId') as string;
    const plan = formData.get('plan') as string;
    const status = formData.get('status') as string;
    const maxActiveLoans = parseInt(formData.get('maxActiveLoans') as string) || 0;
    const maxAgents = parseInt(formData.get('maxAgents') as string) || 0;
    const maxBranches = parseInt(formData.get('maxBranches') as string) || 0;
    const enabledModules = formData.getAll('enabledModules');
    const trialEndsAtStr = formData.get('trialEndsAt') as string | null;
    const currentPeriodEndStr = formData.get('currentPeriodEnd') as string | null;
    const razorpaySubId = (formData.get('razorpaySubId') as string) || null;
    const whatsappSmsEnabled = formData.get('whatsappSmsEnabled') === 'true';
    const receiptPdfAllowed = formData.get('receiptPdfAllowed') === 'true';
    const bureauEnabled = formData.get('bureauEnabled') === 'true';
    const npaEnabled = formData.get('npaEnabled') === 'true';
    const kycEnabled = formData.get('kycEnabled') === 'true';
    const gpsTrackingEnabled = formData.get('gpsTrackingEnabled') === 'true';
    const premiumAccountingEnabled = formData.get('premiumAccountingEnabled') === 'true';
    const bureauPullsIncluded = parseInt(formData.get('bureauPullsIncluded') as string) || 0;

    const parseDate = (dStr: string | null) => {
      if (!dStr) return null;
      const d = new Date(dStr);
      return isNaN(d.getTime()) ? null : d;
    };

    await upsertSubscription(tenantId, {
      plan,
      status,
      maxActiveLoans,
      maxAgents,
      maxBranches,
      enabledModules: JSON.stringify(enabledModules),
      whatsappSmsEnabled,
      receiptPdfAllowed,
      bureauEnabled,
      bureauPullsIncluded,
      npaEnabled,
      kycEnabled,
      gpsTrackingEnabled,
      premiumAccountingEnabled,
      trialEndsAt: parseDate(trialEndsAtStr),
      currentPeriodEnd: parseDate(currentPeriodEndStr),
      razorpaySubId,
    });


    await prisma.branch.updateMany({
      where: {
        tenantId,
        OR: [
          { enabledModules: '[]' },
          { enabledModules: '' },
        ],
      },
      data: { enabledModules: JSON.stringify(enabledModules) },
    });

    revalidatePath('/admin/billing');
    revalidatePath(`/admin/billing/${tenantId}`);
    revalidatePath('/admin/users');
    revalidatePath('/admin/branches');
    revalidatePath('/portal');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update subscription' };
  }
}
