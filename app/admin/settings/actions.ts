'use server';

import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

export async function updateDeveloperCredentials(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  if (role !== 'developer' || !userId) {
    return { success: false, error: 'Unauthorized' };
  }

  const newUsername = (formData.get('username') as string)?.trim();
  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!newUsername) {
    return { success: false, error: 'Username is required' };
  }

  // Get the current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, username: true, tenantId: true },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Check if username is changing and if it's taken
  if (newUsername !== user.username) {
    const existing = await prisma.user.findFirst({
      where: { username: newUsername, tenantId: user.tenantId, id: { not: userId } },
    });
    if (existing) {
      return { success: false, error: 'Username is already taken' };
    }
  }

  // Build update data
  const updateData: any = { username: newUsername };

  // If password change is requested
  if (newPassword || currentPassword) {
    if (!currentPassword) {
      return { success: false, error: 'Current password is required to set a new password' };
    }
    if (!newPassword) {
      return { success: false, error: 'New password is required' };
    }
    if (newPassword !== confirmPassword) {
      return { success: false, error: 'New passwords do not match' };
    }
    if (newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    // Verify current password
    if (!user.passwordHash) {
      return { success: false, error: 'No password set for this account' };
    }
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect' };
    }

    updateData.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      tenantId: user.tenantId,
      userId,
      action: 'update',
      entityType: 'developer_settings',
      entityId: userId,
      newValue: JSON.stringify({
        usernameChanged: newUsername !== user.username,
        passwordChanged: !!newPassword,
      }),
    },
  }).catch(() => {});

  revalidatePath('/admin/settings');
  return { success: true, message: 'Settings updated successfully' };
}
