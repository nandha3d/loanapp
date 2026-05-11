'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function manageMasterUser(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  
  if (userRole !== 'superadmin' && userRole !== 'developer') {
    return { success: false, error: 'Unauthorized. Super Admin or Developer only.' };
  }

  const id = formData.get('id') as string | null;
  const name = formData.get('name') as string;
  const username = formData.get('username') as string;
  const phone = formData.get('phone') as string;
  const password = formData.get('password') as string;
  const role = formData.get('role') as string;
  const appType = formData.get('appType') as string;
  const branchId = formData.get('branchId') as string || null;
  const status = formData.get('status') as string || 'active';

  if (!name || !username || !phone || !role || !appType) {
    return { success: false, error: 'Missing required fields' };
  }

  const existingUsername = await prisma.user.findFirst({
    where: { username, tenantId, id: id ? { not: id } : undefined }
  });
  if (existingUsername) return { success: false, error: 'Username already taken' };

  if (id) {
    const updateData: any = { name, username, phone, role, appType, branchId, status };
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    await prisma.user.update({
      where: { id },
      data: updateData
    });
  } else {
    if (!password) return { success: false, error: 'Password is required for new users' };
    await prisma.user.create({
      data: {
        tenantId,
        name,
        username,
        phone,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        appType,
        branchId,
        status
      }
    });
  }

  revalidatePath('/admin/users');
  return { success: true };
}

export async function createBranch(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  
  if (userRole !== 'developer') {
    return { success: false, error: 'Unauthorized. Developer access required.' };
  }

  const name = formData.get('name') as string;
  const code = formData.get('code') as string;
  const phone = formData.get('phone') as string;
  
  if (!name || !code) {
    return { success: false, error: 'Name and code are required' };
  }

  await prisma.branch.create({
    data: {
      tenantId,
      name,
      code,
      phone
    }
  });

  revalidatePath('/admin/branches');
  return { success: true };
}

export async function toggleUserStatus(userId: string, newStatus: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'superadmin' && role !== 'developer') return { success: false };

  await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus }
  });

  revalidatePath('/admin/users');
  return { success: true };
}
