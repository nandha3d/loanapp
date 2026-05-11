'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, setSetting, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { hash } from 'bcryptjs';

export async function saveSystemSettings(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  const entries = Array.from(formData.entries());
  
  for (const [key, value] of entries) {
    if (key.startsWith('$')) continue; // Skip Next.js internal fields
    await setSetting(tenantId, key, value.toString(), 'system');
  }
  revalidatePath('/settings');
  return { success: true };
}

export async function savePenaltySettings(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  
  await setSetting(tenantId, 'default_penalty_per_day', formData.get('default_penalty_per_day') as string, 'penalty');
  await setSetting(tenantId, 'penalty_grace_period', formData.get('penalty_grace_period') as string, 'penalty');
  await setSetting(tenantId, 'penalty_max_cap', formData.get('penalty_max_cap') as string, 'penalty');
  
  revalidatePath('/settings');
  return { success: true };
}

export async function createRoute(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  
  const newRoute = await prisma.route.create({
    data: {
      tenantId,
      name: formData.get('name') as string,
      assignedAgentId: formData.get('assignedAgentId') as string || null,
      appType,
      status: 'active',
    }
  });
  
  revalidatePath('/settings');
  return { success: true, route: newRoute };
}

export async function deleteRoute(id: string) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  // Verify ownership before delete
  const route = await prisma.route.findFirst({ where: { id, tenantId, appType } });
  if (!route) return { success: false, error: 'Route not found or access denied' };

  await prisma.route.delete({ where: { id } });
  revalidatePath('/settings');
  return { success: true };
}

export async function createLoanPackage(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  
  await prisma.loanPackage.create({
    data: {
      tenantId,
      name: formData.get('name') as string,
      principal: Number(formData.get('principal')),
      deduction: Number(formData.get('deduction')),
      frequency: formData.get('frequency') as string,
      tenure: Number(formData.get('tenure')),
      perInstalment: Number(formData.get('perInstalment')),
      penaltyRate: Number(formData.get('penaltyRate')),
      appType,
      status: 'active',
    }
  });
  
  revalidatePath('/settings');
  return { success: true };
}

export async function deleteLoanPackage(id: string) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  // Verify ownership before delete
  const pkg = await prisma.loanPackage.findFirst({ where: { id, tenantId, appType } });
  if (!pkg) return { success: false, error: 'Package not found or access denied' };

  await prisma.loanPackage.delete({ where: { id } });
  revalidatePath('/settings');
  return { success: true };
}

export async function createUser(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const passwordHash = await hash(formData.get('password') as string, 12);
  
  const newUser = await prisma.user.create({
    data: {
      tenantId,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      username: formData.get('username') as string,
      role: formData.get('role') as string,
      appType: appType,
      passwordHash,
      status: 'active',
    }
  });
  
  revalidatePath('/settings');
  return { success: true, user: newUser };
}
