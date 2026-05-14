'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, setSetting, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { hash } from 'bcryptjs';
import { auth } from '@/lib/auth';

export async function saveSystemSettings(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }
  const tenantId = await getDefaultTenantId();
  const entries = Array.from(formData.entries());
  const saved: Record<string, string> = {};
  
  for (const [key, value] of entries) {
    if (key.startsWith('$')) continue; // Skip Next.js internal fields
    await setSetting(tenantId, key, value.toString(), 'system');
    saved[key] = value.toString();
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'settings',
      newValue: JSON.stringify({ category: 'system', changes: saved }),
    },
  });

  revalidatePath('/settings');
  return { success: true };
}

export async function savePenaltySettings(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }
  const tenantId = await getDefaultTenantId();
  const fields = {
    default_penalty_per_day: formData.get('default_penalty_per_day') as string,
    penalty_grace_period: formData.get('penalty_grace_period') as string,
    penalty_max_cap: formData.get('penalty_max_cap') as string,
  };
  
  for (const [key, value] of Object.entries(fields)) {
    await setSetting(tenantId, key, value, 'penalty');
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'settings',
      newValue: JSON.stringify({ category: 'penalty', changes: fields }),
    },
  });
  
  revalidatePath('/settings');
  return { success: true };
}

export async function createRoute(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }
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
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }
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
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const principal = Number(formData.get('principal'));
  const deductionType = (formData.get('deductionType') as string) || 'fixed';
  const deductionInput = Number(formData.get('deduction'));
  const deduction = deductionType === 'percentage'
    ? Math.round((principal * deductionInput) / 100)
    : deductionInput;
  
  await prisma.loanPackage.create({
    data: {
      tenantId,
      name: formData.get('name') as string,
      principal,
      deduction,
      deductionType,
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
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }
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
  const session = await auth();
  const role = (session?.user as any)?.role;
  const actorId = session?.user?.id;
  if (!actorId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }
  // Agents can only be created by admins/superadmins — prevent privilege escalation
  const requestedRole = formData.get('role') as string;
  if (requestedRole === 'superadmin' && role !== 'superadmin' && role !== 'developer') {
    return { success: false, error: 'Only a superadmin can create superadmin accounts' };
  }
  if (requestedRole === 'developer' && role !== 'developer') {
    return { success: false, error: 'Only a developer can create developer accounts' };
  }
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const passwordHash = await hash(formData.get('password') as string, 12);
  
  const newUser = await prisma.user.create({
    data: {
      tenantId,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      username: formData.get('username') as string,
      role: requestedRole,
      appType: appType,
      passwordHash,
      status: 'active',
    }
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: 'create',
      entityType: 'user',
      entityId: newUser.id,
      newValue: JSON.stringify({ name: newUser.name, username: newUser.username, role: newUser.role }),
    },
  });
  
  revalidatePath('/settings');
  return { success: true, user: newUser };
}

export async function assignAgentToRoute(routeId: string, agentId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;
  if (!userId || (role !== 'admin' && role !== 'superadmin' && role !== 'developer')) {
    return { success: false, error: 'Unauthorized' };
  }

  const tenantId = await getDefaultTenantId();

  // Verify route belongs to tenant
  const route = await prisma.route.findFirst({ where: { id: routeId, tenantId } });
  if (!route) return { success: false, error: 'Route not found' };

  // Verify agent belongs to tenant
  const agent = await prisma.user.findFirst({ where: { id: agentId, tenantId, role: 'agent' } });
  if (!agent) return { success: false, error: 'Agent not found' };

  await prisma.routeAgent.upsert({
    where: { routeId_agentId: { routeId, agentId } },
    create: { routeId, agentId },
    update: {},
  });

  revalidatePath('/settings');
  return { success: true };
}

export async function removeAgentFromRoute(routeId: string, agentId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;
  if (!userId || (role !== 'admin' && role !== 'superadmin' && role !== 'developer')) {
    return { success: false, error: 'Unauthorized' };
  }

  const tenantId = await getDefaultTenantId();

  // Verify route belongs to tenant before deleting
  const route = await prisma.route.findFirst({ where: { id: routeId, tenantId } });
  if (!route) return { success: false, error: 'Route not found' };

  await prisma.routeAgent.deleteMany({ where: { routeId, agentId } });

  revalidatePath('/settings');
  return { success: true };
}

export async function updateLanguage(lang: string) {
  const tenantId = await getDefaultTenantId();
  await setSetting(tenantId, 'language', lang, 'system');
  revalidatePath('/');
  return { success: true };
}
