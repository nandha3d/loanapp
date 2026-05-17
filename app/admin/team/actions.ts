'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { checkLimit } from '@/lib/subscription';
import { revalidatePath } from 'next/cache';
import { normalizeModuleList } from '@/types/modules';

export async function manageAgent(formData: FormData) {
  const session = await auth();
  const actorRole = (session?.user as any)?.role;
  const actorId = session?.user?.id;
  const tenantId = await getDefaultTenantId();
  const activeBranchId = await getActiveBranchId();
  const appType = await getUserAppType();

  if (!actorId || !['admin', 'superadmin', 'developer'].includes(actorRole)) {
    return { success: false, error: 'Unauthorized. Admins only.' };
  }

  const id = formData.get('id') as string | null;
  const name = formData.get('name') as string;
  const username = formData.get('username') as string;
  const phone = formData.get('phone') as string;
  const password = formData.get('password') as string;
  const status = formData.get('status') as string || 'active';

  if (!name || !username || !phone) {
    return { success: false, error: 'Missing required fields' };
  }

  // Check unique username within tenant
  const existingUsername = await prisma.user.findFirst({
    where: { username, tenantId, id: id ? { not: id } : undefined }
  });
  if (existingUsername) return { success: false, error: 'Username already taken' };

  const adminModules = normalizeModuleList(formData.getAll('adminModules'));
  const targetModules = adminModules.length > 0 ? adminModules : [appType];
  const primaryAppType = targetModules[0] || 'microlending';

  // Validate modules are enabled for the branch
  if (activeBranchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: activeBranchId },
      select: { enabledModules: true }
    });
    const branchModules = normalizeModuleList(branch?.enabledModules);
    const invalid = targetModules.filter(m => !(branchModules as string[]).includes(m));
    if (invalid.length > 0) {
      return { success: false, error: `Modules not enabled for this branch: ${invalid.join(', ')}` };
    }
  }

  let savedUserId = id;

  if (id) {
    // Editing an existing user
    // Verify user belongs to same tenant, branch, and role is agent
    const userToEdit = await prisma.user.findFirst({
      where: { id, tenantId, role: 'agent' }
    });
    if (!userToEdit) {
      return { success: false, error: 'Agent not found' };
    }

    // Branch Admins can only edit agents in their own branch
    if (actorRole === 'admin' && userToEdit.branchId !== activeBranchId) {
      return { success: false, error: 'Unauthorized to edit agents from other branches.' };
    }

    const updateData: any = { name, username, phone, status, appType: primaryAppType };
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    await prisma.user.update({
      where: { id },
      data: updateData
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'update',
        entityType: 'user',
        entityId: id,
        newValue: JSON.stringify({ name, username, status, role: 'agent', appType: primaryAppType }),
      },
    }).catch(() => {});
  } else {
    // Creating a new agent
    if (!password) return { success: false, error: 'Password is required for new agent' };

    // Enforce subscription agent limit
    try {
      await checkLimit(tenantId, 'agents');
    } catch (err: any) {
      return { success: false, error: err.message };
    }

    const newAgent = await prisma.user.create({
      data: {
        tenantId,
        branchId: activeBranchId, // Strictly scoped to current branch!
        name,
        username,
        phone,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'agent',
        appType: primaryAppType,
        status
      }
    });

    savedUserId = newAgent.id;

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'create',
        entityType: 'user',
        entityId: newAgent.id,
        newValue: JSON.stringify({ name, username, role: 'agent', status, appType: primaryAppType }),
      },
    }).catch(() => {});
  }

  if (savedUserId && activeBranchId) {
    await prisma.userBranchModule.upsert({
      where: { userId_branchId: { userId: savedUserId, branchId: activeBranchId } },
      update: { enabledModules: JSON.stringify(targetModules) },
      create: { userId: savedUserId, branchId: activeBranchId, enabledModules: JSON.stringify(targetModules) },
    });
  }

  revalidatePath('/admin/team');
  return { success: true };
}

export async function toggleAgentStatus(agentId: string, currentStatus: string) {
  console.log(`[toggleAgentStatus] Called for agent ${agentId} with status ${currentStatus}`);
  const session = await auth();
  const actorRole = (session?.user as any)?.role;
  const actorId = session?.user?.id;
  const tenantId = await getDefaultTenantId();
  const activeBranchId = await getActiveBranchId();

  console.log(`[toggleAgentStatus] Actor ${actorId} (${actorRole}), tenant: ${tenantId}, activeBranch: ${activeBranchId}`);

  if (!actorId || !['admin', 'superadmin', 'developer'].includes(actorRole)) {
    console.log(`[toggleAgentStatus] Failed: Unauthorized actor`);
    return { success: false, error: 'Unauthorized' };
  }

  const agent = await prisma.user.findFirst({
    where: { id: agentId, tenantId, role: 'agent' }
  });
  if (!agent) {
    console.log(`[toggleAgentStatus] Failed: Agent not found`);
    return { success: false, error: 'Agent not found' };
  }

  if (actorRole === 'admin' && agent.branchId !== activeBranchId) {
    console.log(`[toggleAgentStatus] Failed: Admin branch mismatch (agent.branchId=${agent.branchId}, activeBranchId=${activeBranchId})`);
    return { success: false, error: 'Unauthorized' };
  }

  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
  await prisma.user.update({
    where: { id: agentId },
    data: { status: nextStatus }
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: 'update',
      entityType: 'user',
      entityId: agentId,
      newValue: JSON.stringify({ status: nextStatus }),
    },
  }).catch(() => {});

  revalidatePath('/admin/team');
  return { success: true };
}
