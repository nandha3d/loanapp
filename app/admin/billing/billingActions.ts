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
  await requireDeveloper();
  const tenantId = formData.get('tenantId') as string;
  const plan = formData.get('plan') as string;
  const status = formData.get('status') as string;
  const maxActiveLoans = parseInt(formData.get('maxActiveLoans') as string);
  const maxAgents = parseInt(formData.get('maxAgents') as string);
  const enabledModules = formData.getAll('enabledModules');
  const trialEndsAtStr = formData.get('trialEndsAt') as string | null;
  const currentPeriodEndStr = formData.get('currentPeriodEnd') as string | null;
  const razorpaySubId = (formData.get('razorpaySubId') as string) || null;

  await upsertSubscription(tenantId, {
    plan,
    status,
    maxActiveLoans,
    maxAgents,
    enabledModules,
    trialEndsAt: trialEndsAtStr ? new Date(trialEndsAtStr) : null,
    currentPeriodEnd: currentPeriodEndStr ? new Date(currentPeriodEndStr) : null,
    razorpaySubId,
  });

  revalidatePath('/admin/billing');
  revalidatePath(`/admin/billing/${tenantId}`);
}
