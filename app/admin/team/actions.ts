'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { checkLimit } from '@/lib/subscription';
import { revalidatePath } from 'next/cache';
import { resolveAgentTargetBranchId, validateAgentModuleSelection } from '@/lib/agentModuleAssignment';

export async function manageAgent(formData: FormData) {
  const session = await auth();
  const actorRole = (session?.user as any)?.role;
  const actorId = session?.user?.id;
  const tenantId = await getDefaultTenantId();
  const activeBranchId = await getActiveBranchId();

  if (!actorId || !['admin', 'superadmin', 'developer'].includes(actorRole)) {
    return { success: false, error: 'Unauthorized. Admins only.' };
  }

  const requestedBranchId = formData.get('branchId') as string | null;
  const branchResolution = resolveAgentTargetBranchId({
    actorRole,
    activeBranchId,
    requestedBranchId,
  });
  if (!branchResolution.ok) {
    return { success: false, error: branchResolution.error };
  }
  const targetBranchId = branchResolution.branchId;

  if (actorRole === 'superadmin') {
    const branch = await prisma.branch.findFirst({
      where: { id: targetBranchId, superadminId: actorId }
    });
    if (!branch) {
      return { success: false, error: 'Unauthorized: You do not own this branch.' };
    }
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

  // Check unique phone within tenant
  const existingPhone = await prisma.user.findFirst({
    where: { phone, tenantId, id: id ? { not: id } : undefined }
  });
  if (existingPhone) return { success: false, error: 'Phone number already in use' };

  const targetBranch = await prisma.branch.findFirst({
    where: { id: targetBranchId, tenantId, status: 'active' },
    select: { enabledModules: true },
  });
  if (!targetBranch) {
    return { success: false, error: 'Select a valid active branch before saving an agent.' };
  }

  const moduleValidation = validateAgentModuleSelection(
    formData.getAll('adminModules'),
    targetBranch.enabledModules,
  );
  if (!moduleValidation.ok) {
    return { success: false, error: moduleValidation.error };
  }
  const targetModules = moduleValidation.modules;
  const primaryAppType = targetModules[0];

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
    if (actorRole === 'admin' && userToEdit.branchId !== targetBranchId) {
      return { success: false, error: 'Unauthorized to edit agents from other branches.' };
    }

    if (actorRole === 'superadmin' && userToEdit.branchId) {
      const currentBranch = await prisma.branch.findFirst({
        where: { id: userToEdit.branchId, superadminId: actorId },
      });
      if (!currentBranch) {
        return { success: false, error: 'Unauthorized: Agent belongs to a branch you do not own.' };
      }
    }

    const updateData: any = { name, username, phone, status, appType: primaryAppType, branchId: targetBranchId };
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
        branchId: targetBranchId,
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

  if (savedUserId) {
    await prisma.userBranchModule.upsert({
      where: { userId_branchId: { userId: savedUserId, branchId: targetBranchId } },
      update: { enabledModules: JSON.stringify(targetModules) },
      create: { userId: savedUserId, branchId: targetBranchId, enabledModules: JSON.stringify(targetModules) },
    });
    await prisma.userBranchModule.deleteMany({
      where: {
        userId: savedUserId,
        branchId: { not: targetBranchId },
      },
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

  if (actorRole === 'superadmin' && agent.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: agent.branchId, superadminId: actorId }
    });
    if (!branch) {
      console.log(`[toggleAgentStatus] Failed: Superadmin does not own this agent's branch`);
      return { success: false, error: 'Unauthorized' };
    }
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
