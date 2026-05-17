'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { checkLimit, normalizeEnabledModules, assertTenantSubscriptionAccess } from '@/lib/subscription';
import { normalizeModuleList, type ModuleKey } from '@/types/modules';

export async function manageMasterUser(formData: FormData) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const actorTenantId = (session?.user as any)?.tenantId;
  
  if (userRole !== 'superadmin' && userRole !== 'developer') {
    return { success: false, error: 'Unauthorized. Super Admin or Developer only.' };
  }

  const id = formData.get('id') as string | null;
  const role = formData.get('role') as string;
  let tenantId = actorTenantId;
  
  if (id) {
    const user = await prisma.user.findUnique({ where: { id }, select: { tenantId: true } });
    if (user) tenantId = user.tenantId;
  } else if (role === 'superadmin') {
    // New Superadmin starts a new tenant — create a proper Tenant row
    const slug = `tnt_${Math.random().toString(36).substring(2, 9)}`;
    const newTenant = await prisma.tenant.create({
      data: { name: formData.get('name') as string || 'New Tenant', slug, status: 'active' },
    });
    tenantId = newTenant.id;
  }

  // Subscription expiry check (Developers bypass, or if new tenant)
  if (userRole !== 'developer' && id) {
    try {
      await assertTenantSubscriptionAccess(tenantId);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  const name = formData.get('name') as string;
  const username = formData.get('username') as string;
  const phone = formData.get('phone') as string;
  const password = formData.get('password') as string;
  const requestedAppType = formData.get('appType') as string;
  const branchId = formData.get('branchId') as string || null;
  const status = formData.get('status') as string || 'active';
  const adminModules = normalizeModuleList(formData.getAll('adminModules'));
  const appType = requestedAppType || adminModules[0] || 'microlending';

  if (!name || !username || !phone || !role || !appType) {
    return { success: false, error: 'Missing required fields' };
  }

  // Only developers can create or edit developer accounts
  if (role === 'developer' && userRole !== 'developer') {
    return { success: false, error: 'Only a developer can manage developer accounts.' };
  }

  const existingUsername = await prisma.user.findFirst({
    where: { username, tenantId, id: id ? { not: id } : undefined }
  });
  if (existingUsername) return { success: false, error: 'Username already taken' };

  const actorId = (session?.user as any)?.id;
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { enabledModules: true },
  });
  const planModules = normalizeEnabledModules(subscription?.enabledModules);
  const requestedModules = adminModules.length > 0 ? adminModules : normalizeModuleList([appType]);
  
  if (userRole !== 'developer') {
    const invalidPlanModules = requestedModules.filter((module) => !planModules.includes(module));
    if (invalidPlanModules.length > 0) {
      return { success: false, error: `Modules not included in this subscription plan: ${invalidPlanModules.join(', ')}` };
    }

    if (branchId && requestedModules.length > 0) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, tenantId },
        select: { enabledModules: true },
      });
      const branchModules = normalizeModuleList(branch?.enabledModules);
      const invalidBranchModules = requestedModules.filter((module) => !branchModules.includes(module));
      if (invalidBranchModules.length > 0) {
        return { success: false, error: `Modules not enabled for this branch: ${invalidBranchModules.join(', ')}` };
      }
    }
  }

  let savedUserId = id;

  if (id) {
    const updateData: any = { name, username, phone, role, appType, branchId, status };
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    await prisma.user.update({
      where: { id, tenantId },
      data: updateData
    });
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'update',
        entityType: 'user',
        entityId: id,
        newValue: JSON.stringify({ name, username, role, appType, status }),
      },
    }).catch(() => {});
  } else {
    if (!password) return { success: false, error: 'Password is required for new users' };
    
    // Enforce agent limit if applicable
    if (role === 'agent') {
      try {
        await checkLimit(tenantId, 'agents');
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const savedUser = await prisma.user.create({
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
    savedUserId = savedUser.id;
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'create',
        entityType: 'user',
        entityId: savedUser.id,
        newValue: JSON.stringify({ name, username, role, appType, status }),
      },
    }).catch(() => {});
  }

  if (savedUserId) {
    if (role === 'superadmin') {
      const subModules = requestedModules.length > 0 ? requestedModules : ['microlending'];
      await prisma.tenantSubscription.upsert({
        where: { tenantId },
        update: { enabledModules: subModules },
        create: { 
          tenantId, 
          enabledModules: subModules,
          plan: 'trial',
          status: 'active',
          maxActiveLoans: 100,
          maxAgents: 5
        }
      });
    }

    if (role === 'admin' && branchId && adminModules.length > 0) {
      if (userRole !== 'developer') {
        const branch = await prisma.branch.findFirst({
          where: { id: branchId, tenantId },
          select: { enabledModules: true },
        });
        const branchModules = normalizeModuleList(branch?.enabledModules);
        const invalid = adminModules.filter((module) => !branchModules.includes(module));
        if (invalid.length > 0) {
          return { success: false, error: `Modules not enabled for this branch: ${invalid.join(', ')}` };
        }
      }
      await prisma.userBranchModule.upsert({
        where: { userId_branchId: { userId: savedUserId, branchId } },
        update: { enabledModules: JSON.stringify(adminModules) },
        create: { userId: savedUserId, branchId, enabledModules: JSON.stringify(adminModules) },
      });
    } else if (role !== 'superadmin') {
      await prisma.userBranchModule.deleteMany({ where: { userId: savedUserId } });
    }
  }

  revalidatePath('/admin/users');
  revalidatePath('/portal');
  return { success: true };
}

export async function createBranch(formData: FormData) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  if (userRole !== 'developer' && userRole !== 'superadmin') return { success: false, error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const code = formData.get('code') as string;
  const phone = formData.get('phone') as string;
  const superadminId = formData.get('superadminId') as string;

  if (!superadminId) return { success: false, error: 'Superadmin owner is required' };

  // Get tenant info from superadmin
  const owner = await prisma.user.findUnique({
    where: { id: superadminId },
    select: { tenantId: true }
  });
  if (!owner) return { success: false, error: 'Owner not found' };

  // Subscription expiry check (Developers bypass)
  if (userRole !== 'developer') {
    try {
      await assertTenantSubscriptionAccess(owner.tenantId);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId: owner.tenantId },
    select: { enabledModules: true }
  });

  try {
    await prisma.branch.create({
      data: {
        tenantId: owner.tenantId,
        superadminId,
        name,
        code,
        phone,
        enabledModules: sub?.enabledModules || [],
      },
    });
    revalidatePath('/admin/branches');
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, error: 'Branch code already exists for this tenant' };
    return { success: false, error: error.message };
  }
}

export async function updateBranch(formData: FormData) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  if (userRole !== 'developer' && userRole !== 'superadmin') return { success: false, error: 'Unauthorized' };

  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const code = formData.get('code') as string;
  const phone = formData.get('phone') as string;
  const status = formData.get('status') as string;
  const superadminId = formData.get('superadminId') as string;

  if (!superadminId) return { success: false, error: 'Superadmin owner is required' };

  const owner = await prisma.user.findUnique({
    where: { id: superadminId },
    select: { tenantId: true }
  });
  if (!owner) return { success: false, error: 'Owner not found' };

  // Subscription expiry check (Developers bypass)
  if (userRole !== 'developer') {
    try {
      await assertTenantSubscriptionAccess(owner.tenantId);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId: owner.tenantId },
    select: { enabledModules: true }
  });

  try {
    await prisma.branch.update({
      where: { id },
      data: {
        name,
        code,
        phone,
        status,
        superadminId,
        enabledModules: sub?.enabledModules || [],
      },
    });
    revalidatePath('/admin/branches');
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, error: 'Branch code already exists for this tenant' };
    return { success: false, error: error.message };
  }
}

export async function assignAdminModules(data: {
  adminUserId: string;
  branchId: string;
  modules: ModuleKey[];
}) {
  const tenantId = await getDefaultTenantId();
  const session = await auth();
  const userRole = (session?.user as any)?.role;

  if (userRole !== 'superadmin' && userRole !== 'developer') {
    return { success: false, error: 'Unauthorized.' };
  }

  const admin = await prisma.user.findFirst({
    where: {
      id: data.adminUserId,
      tenantId: userRole === 'developer' ? undefined : tenantId,
      branchId: data.branchId,
      role: 'admin',
    },
  });
  if (!admin) return { success: false, error: 'Admin not found in this branch' };

  const branch = await prisma.branch.findFirst({
    where: {
      id: data.branchId,
      tenantId: userRole === 'developer' ? undefined : tenantId,
    },
    select: { enabledModules: true },
  });
  const branchModules = normalizeModuleList(branch?.enabledModules);
  const invalid = data.modules.filter((module) => !branchModules.includes(module));
  if (invalid.length > 0) {
    return { success: false, error: `Modules not enabled for this branch: ${invalid.join(', ')}` };
  }

  await prisma.userBranchModule.upsert({
    where: { userId_branchId: { userId: data.adminUserId, branchId: data.branchId } },
    update: { enabledModules: data.modules },
    create: {
      userId: data.adminUserId,
      branchId: data.branchId,
      enabledModules: data.modules,
    },
  });

  revalidatePath('/admin/users');
  revalidatePath('/portal');
  return { success: true };
}

export async function toggleUserStatus(userId: string, newStatus: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const actorId = (session?.user as any)?.id;
  if (role !== 'superadmin' && role !== 'developer') return { success: false };

  const tenantId = await getDefaultTenantId();

  await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus }
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: 'update',
      entityType: 'user',
      entityId: userId,
      newValue: JSON.stringify({ status: newStatus }),
    },
  }).catch(() => {});

  revalidatePath('/admin/users');
  return { success: true };
}


