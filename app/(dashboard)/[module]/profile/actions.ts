'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import {
  changeSuperadminPasswordWithOtp,
  getSuperadminProfile,
  sendSuperadminPasswordOtp,
  updateSuperadminProfile,
} from '@/lib/profile';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function profileContext() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'superadmin') {
    throw new Error('Unauthorized');
  }
  const tenantId = await getDefaultTenantId();
  const headerStore = await headers();
  return {
    userId: user.id,
    tenantId,
    ip: (headerStore.get('x-forwarded-for') || '').split(',')[0].trim() || '0.0.0.0',
    userAgent: headerStore.get('user-agent'),
  };
}

export async function updateProfileAction(formData: FormData) {
  try {
    const context = await profileContext();
    const profile = await updateSuperadminProfile(context, {
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

export async function sendProfilePasswordOtpAction() {
  try {
    const context = await profileContext();
    const result = await sendSuperadminPasswordOtp(context);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'Could not send OTP') };
  }
}

export async function changeProfilePasswordAction(formData: FormData) {
  try {
    const context = await profileContext();
    const result = await changeSuperadminPasswordWithOtp(context, {
      otp: formData.get('otp'),
      newPassword: formData.get('newPassword'),
    });
    return { success: true, result };
  } catch (error) {
    return { success: false, error: errorMessage(error, 'Could not change password') };
  }
}

export async function refreshProfileAction() {
  const context = await profileContext();
  return getSuperadminProfile(context.userId, context.tenantId);
}
