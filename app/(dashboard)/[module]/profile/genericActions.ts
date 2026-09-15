'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import {
  changeGenericPasswordWithOtp,
  getGenericProfile,
  sendGenericPasswordOtp,
  updateGenericProfile,
} from '@/lib/genericProfile';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function accountContext() {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) throw new Error('Unauthorized');
  const tenantId = await getDefaultTenantId();
  const headerStore = await headers();
  return {
    userId: user.id,
    tenantId,
    ip: (headerStore.get('x-forwarded-for') || '').split(',')[0].trim() || '0.0.0.0',
    userAgent: headerStore.get('user-agent'),
  };
}

export async function updateAccountProfileAction(formData: FormData) {
  try {
    const context = await accountContext();
    const profile = await updateGenericProfile(context, {
      name: formData.get('name'),
      phone: formData.get('phone'),
    });
    const moduleSlug = await getUserAppType();
    revalidatePath(`/${moduleSlug}/profile`);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'Could not update profile') };
  }
}

export async function sendAccountPasswordOtpAction() {
  try {
    const context = await accountContext();
    const result = await sendGenericPasswordOtp(context);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'Could not send OTP') };
  }
}

export async function changeAccountPasswordAction(formData: FormData) {
  try {
    const context = await accountContext();
    const result = await changeGenericPasswordWithOtp(context, {
      otp: formData.get('otp'),
      newPassword: formData.get('newPassword'),
    });
    return { success: true, result };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'Could not change password') };
  }
}

export async function refreshAccountProfileAction() {
  const context = await accountContext();
  return getGenericProfile(context.userId, context.tenantId);
}
