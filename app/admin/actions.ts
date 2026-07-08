'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { checkLimit, normalizeEnabledModules, assertTenantSubscriptionAccess } from '@/lib/subscription';
import { normalizeModuleList, type ModuleKey } from '@/types/modules';
import { findUserUniqueConflicts } from '@/lib/userUniqueness';

// The mobile v1 API authenticates with a Bearer token (no NextAuth cookie),
// so `auth()` is empty there. Routes that reuse these actions pass the
// verified mobile context as an explicit actor instead.
export type ActionActor = { id: string; role: string; tenantId: string };

async function resolveActionActor(override?: ActionActor): Promise<ActionActor | null> {
  if (override) return override;
  const session = await auth();
  const u = session?.user as any;
  if (!u?.id) return null;
  return { id: u.id, role: u.role, tenantId: u.tenantId };
}

export async function manageMasterUser(formData: FormData, actorOverride?: ActionActor) {
  const actor = await resolveActionActor(actorOverride);
  if (!actor || (actor.role !== 'superadmin' && actor.role !== 'developer')) {
    return { success: false, error: 'Unauthorized. Super Admin or Developer only.' };
  }
  const userRole = actor.role;
  const actorTenantId = actor.tenantId;
  const actorUserId = actor.id;

  const id = formData.get('id') as string | null;
  const role = formData.get('role') as string;
  let tenantId = actorTenantId;
  // Only a DEVELOPER onboarding a business creates a new tenant. A superadmin
  // creating a superadmin adds a CO-OWNER to their OWN account (same tenant).
  // No new businesses can be created from inside an account — and registration
  // is separately blocked on client domains.
  let creatingNewTenant = false;

  if (id) {
    const user = await prisma.user.findUnique({ where: { id }, select: { tenantId: true } });
    if (user) tenantId = user.tenantId;
  } else if (role === 'superadmin' && userRole === 'developer') {
    // Developer onboarding a new business → create a proper Tenant row.
    creatingNewTenant = true;
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
  const phone = formData.get('phone') as string;
  const username = ((formData.get('username') as string) || phone).trim().toLowerCase();
  const email = ((formData.get('email') as string) || '').trim().toLowerCase() || null;
  const password = formData.get('password') as string;
  const requestedAppType = formData.get('appType') as string;
  // For superadmins: branchId is ignored; branchIds[] is the multi-select
  const rawBranchId = role === 'superadmin' ? null : (formData.get('branchId') as string || null);
  const branchId = rawBranchId;
  const superadminBranchIds = role === 'superadmin' ? formData.getAll('branchIds').map(String) : [];
  const status = formData.get('status') as string || 'active';
  const adminModules = normalizeModuleList(formData.getAll('adminModules'));
  const userModuleList = normalizeModuleList(formData.getAll('userModules'));
  const appType = requestedAppType || adminModules[0] || userModuleList[0] || 'microlending';

  // New optional details & permission switches
  const aadharNumber = formData.get('aadharNumber') as string | null || null;
  const dobRaw = formData.get('dob') as string | null;
  const dob = dobRaw ? new Date(dobRaw) : null;
  const experience = formData.get('experience') as string | null || null;
  const ageRaw = formData.get('age') as string | null;
  const age = ageRaw ? parseInt(ageRaw, 10) : null;

  const bypassLoanApproval = formData.get('bypassLoanApproval') === 'true' || formData.get('bypassLoanApproval') === 'on';
  const bypassCustomerApproval = formData.get('bypassCustomerApproval') === 'true' || formData.get('bypassCustomerApproval') === 'on';
  const bypassVehicleApproval = formData.get('bypassVehicleApproval') === 'true' || formData.get('bypassVehicleApproval') === 'on';
  const autoReleaseFloat = formData.get('autoReleaseFloat') === 'true' || formData.get('autoReleaseFloat') === 'on';
  const feeConfirmationMandatory = formData.get('feeConfirmationMandatory') === 'true' || formData.get('feeConfirmationMandatory') === 'on';

  if (!name || !username || !phone || !role || !appType) {
    return { success: false, error: 'Missing required fields' };
  }

  if (userRole === 'superadmin') {
    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, superadminId: actorUserId }
      });
      if (!branch) {
        return { success: false, error: 'Unauthorized: You do not own the target branch.' };
      }
    }
    // Superadmins cannot assign branches to other superadmins
    if (superadminBranchIds.length > 0) {
      return { success: false, error: 'Unauthorized: Only developers can assign branches to superadmins.' };
    }
    if (id) {
      const targetUser = await prisma.user.findFirst({
        where: { id, tenantId }
      });
      if (!targetUser) return { success: false, error: 'User not found' };
      if (targetUser.id !== actorUserId) {
        if (targetUser.role === 'superadmin') {
          return { success: false, error: 'Unauthorized: Cannot modify other superadmins.' };
        }
        if (targetUser.branchId) {
          const branch = await prisma.branch.findFirst({
            where: { id: targetUser.branchId, superadminId: actorUserId }
          });
          if (!branch) {
            return { success: false, error: 'Unauthorized: Target user belongs to a branch you do not own.' };
          }
        }
      }
    }
  }

  // Only developers can create or edit developer accounts
  if (role === 'developer' && userRole !== 'developer') {
    return { success: false, error: 'Only a developer can manage developer accounts.' };
  }

  const conflicts = await findUserUniqueConflicts({ username, phone, email: email || undefined }, id);
  if (conflicts.length > 0) return { success: false, error: conflicts[0].message };

  const actorId = actorUserId;
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { enabledModules: true },
  });
  const planModules = normalizeEnabledModules(subscription?.enabledModules);
  const requestedModules = userModuleList.length > 0 ? userModuleList : adminModules.length > 0 ? adminModules : normalizeModuleList([appType]);
  
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
      const allowedBranchModules = branchModules.length > 0 ? branchModules : planModules;
      const invalidBranchModules = requestedModules.filter((module) => !allowedBranchModules.includes(module));
      if (invalidBranchModules.length > 0) {
        return { success: false, error: `Modules not enabled for this branch: ${invalidBranchModules.join(', ')}` };
      }
    }
  }

  let savedUserId = id;

  if (id) {
    const updateData: any = {
      name,
      username,
      phone,
      email,
      role,
      appType,
      branchId,
      status,
      aadharNumber,
      dob,
      experience,
      age,
      bypassLoanApproval,
      bypassCustomerApproval,
      bypassVehicleApproval,
      autoReleaseFloat,
      feeConfirmationMandatory,
    };
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

    let savedUser;
    try {
      savedUser = await prisma.user.create({
        data: {
          tenantId,
          name,
          username,
          phone,
          email,
          passwordHash: await bcrypt.hash(password, 10),
          role,
          appType,
          branchId,
          status,
          aadharNumber,
          dob,
          experience,
          age,
          bypassLoanApproval,
          bypassCustomerApproval,
          bypassVehicleApproval,
          autoReleaseFloat,
          feeConfirmationMandatory,
        }
      });
      savedUserId = savedUser.id;
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Prisma's meta.target is a string (MySQL index name) — NOT an array as
        // on Postgres. Normalize to a string before substring checks, or `.some`
        // throws "some is not a function" and turns a dup into a 500.
        const t = err.meta?.target;
        const target = Array.isArray(t) ? t.join(',') : String(t ?? '');
        if (target.includes('phone')) {
          return { success: false, error: 'A user with this phone number already exists.' };
        }
        if (target.includes('username')) {
          return { success: false, error: 'A user with this username already exists.' };
        }
        return { success: false, error: 'A user with these details already exists.' };
      }
      throw err;
    }
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
      if (creatingNewTenant) {
        await prisma.tenantSubscription.upsert({
          where: { tenantId },
          update: { enabledModules: JSON.stringify(subModules) },
          create: {
            tenantId,
            enabledModules: JSON.stringify(subModules),
            plan: 'trial',
            status: 'active',
            maxActiveLoans: 100,
            maxAgents: 5,
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          }
        });
      }

      // New-business bootstrap: HQ branch, owner link, default settings.
      if (creatingNewTenant) {
        // Create default HQ Branch
        const branch = await prisma.branch.create({
          data: {
            tenantId,
            superadminId: savedUserId,
            name: 'Head Office',
            code: 'HQ',
            status: 'active',
            enabledModules: JSON.stringify(subModules),
          }
        });

        // Link user to this branch
        await prisma.user.update({
          where: { id: savedUserId },
          data: { branchId: branch.id }
        });

        // Link in SuperadminBranch table
        await prisma.superadminBranch.create({
          data: {
            superadminId: savedUserId,
            branchId: branch.id,
            assignedById: actorId,
          }
        });

        // Initialize default settings for branding & system
        const defaultSettings = [
          { key: 'app_name', value: name || 'LoanTrack', group: 'branding' },
          { key: 'app_tagline', value: 'Micro-Lending Management System', group: 'branding' },
          { key: 'logo_url', value: '/assets/logo.svg', group: 'branding' },
          { key: 'primary_color', value: '#F5A623', group: 'branding' },
          { key: 'primary_dark', value: '#E8930C', group: 'branding' },
          { key: 'timezone', value: 'Asia/Kolkata', group: 'system' },
          { key: 'currency', value: 'INR', group: 'system' },
          { key: 'currency_symbol', value: '₹', group: 'system' },
          { key: 'date_format', value: 'dd MMM yyyy', group: 'system' },
          { key: 'midnight_cutoff', value: 'true', group: 'system' },
          { key: 'allow_weekend_collection', value: 'false', group: 'system' },
          { key: 'default_penalty_per_day', value: '50', group: 'penalty' },
          { key: 'penalty_grace_period', value: '0', group: 'penalty' },
          { key: 'penalty_max_cap', value: '0', group: 'penalty' },
          { key: 'customer_code_prefix', value: 'CUS', group: 'general' },
          { key: 'loan_code_prefix', value: 'LN', group: 'general' },
          { key: 'customer_code_counter', value: '0', group: 'general' },
          { key: 'loan_code_counter', value: '0', group: 'general' }
        ];

        await prisma.appSetting.createMany({
          data: defaultSettings.map(s => ({
            tenantId,
            ...s
          }))
        });
      } else if (!id) {
        // Co-owner: a superadmin added by an existing superadmin joins the SAME
        // account (no new tenant/branch/settings) with access to all its branches.
        const tenantBranches = await prisma.branch.findMany({
          where: { tenantId },
          select: { id: true },
        });
        if (tenantBranches.length > 0) {
          await prisma.user.update({
            where: { id: savedUserId },
            data: { branchId: tenantBranches[0].id },
          });
          await prisma.superadminBranch.deleteMany({ where: { superadminId: savedUserId } });
          await prisma.superadminBranch.createMany({
            data: tenantBranches.map((b) => ({
              superadminId: savedUserId!,
              branchId: b.id,
              assignedById: actorId,
            })),
          });
        }
      }

      // Developer can assign multiple branches to the superadmin via SuperadminBranch join table
      if (userRole === 'developer' && superadminBranchIds.length > 0) {
        // Validate all branches exist in the correct tenant
        const validBranches = await prisma.branch.findMany({
          where: { id: { in: superadminBranchIds }, tenantId },
          select: { id: true },
        });
        const validIds = validBranches.map((b) => b.id);

        // Replace all existing SuperadminBranch links for this superadmin
        await prisma.superadminBranch.deleteMany({ where: { superadminId: savedUserId } });
        if (validIds.length > 0) {
          await prisma.superadminBranch.createMany({
            data: validIds.map((bid) => ({
              superadminId: savedUserId!,
              branchId: bid,
              assignedById: actorId,
            })),
          });
          // Keep Branch.superadminId in sync (set to this superadmin)
          await prisma.branch.updateMany({
            where: { id: { in: validIds } },
            data: { superadminId: savedUserId },
          });
        }
      }
    }

    // Persist UserModule for admin/agent global module access
    if ((role === 'admin' || role === 'agent') && savedUserId) {
      const modulesToAssign = userModuleList.length > 0 ? userModuleList : adminModules;
      if (modulesToAssign.length > 0) {
        // Delete existing and re-insert for simplicity
        await prisma.userModule.deleteMany({ where: { userId: savedUserId } });
        await prisma.userModule.createMany({
          data: modulesToAssign.map((mod) => ({
            userId: savedUserId!,
            appType: mod,
            assignedById: actorId,
          })),
        });
      }
    }

    // Handle UserBranchModule updates for admins/agents assigned to a branch
    if ((role === 'admin' || role === 'agent') && branchId) {
      // Validate requested modules are within branch's enabled modules
      if (userRole !== 'developer' && adminModules.length > 0) {
        const branch = await prisma.branch.findFirst({
          where: { id: branchId, tenantId },
          select: { enabledModules: true, name: true },
        });
        const branchModules = normalizeModuleList(branch?.enabledModules);
        const allowedBranchModules = branchModules.length > 0 ? branchModules : planModules;
        const invalid = adminModules.filter((module) => !allowedBranchModules.includes(module));
        if (invalid.length > 0) {
          return { success: false, error: `Branch "${branch?.name}" does not have these modules enabled: ${invalid.join(', ')}. Please enable them on the branch first.` };
        }
      }

      if (adminModules.length > 0) {
        // User has specific module access — save it
        await prisma.userBranchModule.upsert({
          where: { userId_branchId: { userId: savedUserId, branchId } },
          update: { enabledModules: JSON.stringify(adminModules) },
          create: { userId: savedUserId, branchId, enabledModules: JSON.stringify(adminModules) },
        });
      } else {
        // User has no specific modules selected — delete the override, will inherit branch defaults
        await prisma.userBranchModule.deleteMany({
          where: { userId: savedUserId, branchId },
        });
      }
    } else if (!branchId) {
      // User not assigned to any branch — delete module overrides
      await prisma.userBranchModule.deleteMany({ where: { userId: savedUserId } });
    }
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin/team');
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

  if (userRole === 'superadmin') {
    if (superadminId !== session?.user?.id) {
      return { success: false, error: 'Unauthorized: You can only assign yourself as the owner.' };
    }
  }

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
    select: { enabledModules: true, maxBranches: true }
  });

  // Check branch limit
  const existingBranchCount = await prisma.branch.count({
    where: { tenantId: owner.tenantId, status: 'active' }
  });
  if (sub && sub.maxBranches > 0 && existingBranchCount >= sub.maxBranches) {
    return { success: false, error: `Branch limit reached (${sub.maxBranches}). Upgrade the subscription to add more branches.` };
  }

  try {
    await prisma.branch.create({
      data: {
        tenantId: owner.tenantId,
        superadminId,
        name,
        code,
        phone,
        enabledModules: sub?.enabledModules || '[]',
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

  if (userRole === 'superadmin') {
    const targetBranch = await prisma.branch.findFirst({
      where: { id, superadminId: session?.user?.id }
    });
    if (!targetBranch) {
      return { success: false, error: 'Unauthorized: You do not own this branch.' };
    }
    if (superadminId !== session?.user?.id) {
      return { success: false, error: 'Unauthorized: You can only assign yourself as the owner.' };
    }
  }

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
    select: { enabledModules: true, maxBranches: true }
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
        enabledModules: sub?.enabledModules || '[]',
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
    update: { enabledModules: JSON.stringify(data.modules) },
    create: {
      userId: data.adminUserId,
      branchId: data.branchId,
      enabledModules: JSON.stringify(data.modules),
    },
  });

  revalidatePath('/admin/users');
  revalidatePath('/portal');
  return { success: true };
}

export async function toggleUserStatus(userId: string, newStatus: string, actorOverride?: ActionActor) {
  const actor = await resolveActionActor(actorOverride);
  const role = actor?.role;
  const actorId = actor?.id;
  if (role !== 'superadmin' && role !== 'developer') return { success: false };

  // Scope: non-developers may only toggle users inside their own tenant.
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  });
  if (!target) return { success: false };
  if (role !== 'developer' && target.tenantId !== actor?.tenantId) {
    return { success: false };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus }
  });

  await prisma.auditLog.create({
    data: {
      tenantId: target.tenantId,
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

// ─── Scoped agent management (module Settings → Users tab) ──────────────────
// Lets a branch admin / superadmin manage AGENTS within ONE branch + ONE module
// only. Narrower than manageMasterUser (which is superadmin/dev-only and handles
// tenant/superadmin creation). Portal /admin/users stays the master editor.
export async function manageBranchAgent(formData: FormData, actorOverride?: ActionActor) {
  const actor = await resolveActionActor(actorOverride);
  const role = actor?.role;
  const actorId = actor?.id;
  if (role !== 'admin' && role !== 'superadmin' && role !== 'developer') {
    return { success: false, error: 'Unauthorized.' };
  }
  // Mobile actor carries its tenant; web resolves from session/host.
  const tenantId = actorOverride ? actorOverride.tenantId : await getDefaultTenantId();

  const id = (formData.get('id') as string) || null;
  const name = ((formData.get('name') as string) || '').trim();
  const phone = ((formData.get('phone') as string) || '').trim();
  const username = ((formData.get('username') as string) || phone).trim().toLowerCase();
  const email = ((formData.get('email') as string) || '').trim().toLowerCase() || null;
  const password = (formData.get('password') as string) || '';
  const status = (formData.get('status') as string) === 'inactive' ? 'inactive' : 'active';
  const appType = (formData.get('appType') as string) || 'microlending';

  // New optional details & permission switches
  const aadharNumber = formData.get('aadharNumber') as string | null || null;
  const dobRaw = formData.get('dob') as string | null;
  const dob = dobRaw ? new Date(dobRaw) : null;
  const experience = formData.get('experience') as string | null || null;
  const ageRaw = formData.get('age') as string | null;
  const age = ageRaw ? parseInt(ageRaw, 10) : null;

  const bypassLoanApproval = formData.get('bypassLoanApproval') === 'true' || formData.get('bypassLoanApproval') === 'on';
  const bypassCustomerApproval = formData.get('bypassCustomerApproval') === 'true' || formData.get('bypassCustomerApproval') === 'on';
  const bypassVehicleApproval = formData.get('bypassVehicleApproval') === 'true' || formData.get('bypassVehicleApproval') === 'on';
  const autoReleaseFloat = formData.get('autoReleaseFloat') === 'true' || formData.get('autoReleaseFloat') === 'on';
  const feeConfirmationMandatory = formData.get('feeConfirmationMandatory') === 'true' || formData.get('feeConfirmationMandatory') === 'on';

  if (!name || !username || !phone) {
    return { success: false, error: 'Name, username and phone are required.' };
  }

  // ── Resolve the branch the actor may manage ──
  let branchId: string | null = null;
  if (role === 'admin') {
    const me = await prisma.user.findUnique({ where: { id: actorId }, select: { branchId: true } });
    branchId = me?.branchId ?? null;
    if (!branchId) return { success: false, error: 'Your account is not assigned to a branch.' };
  } else {
    // superadmin / developer: branch from form; superadmin must own it
    branchId = (formData.get('branchId') as string) || null;
    if (!branchId) return { success: false, error: 'No branch selected.' };
    const owned = await prisma.branch.findFirst({
      where: { id: branchId, tenantId, ...(role === 'superadmin' ? { superadminId: actorId } : {}) },
      select: { id: true },
    });
    if (!owned) return { success: false, error: 'Unauthorized: you do not manage this branch.' };
  }

  // Subscription gate (developer bypass)
  if (role !== 'developer') {
    try { await assertTenantSubscriptionAccess(tenantId); }
    catch (e: any) { return { success: false, error: e.message }; }
  }

  // Module must be enabled on the plan AND the branch
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId }, select: { enabledModules: true } });
  const planModules = normalizeEnabledModules(sub?.enabledModules);
  const branchRow = await prisma.branch.findFirst({ where: { id: branchId, tenantId }, select: { enabledModules: true } });
  const branchModules = normalizeModuleList(branchRow?.enabledModules);
  const allowedModules = branchModules.length > 0 ? branchModules : (planModules as ModuleKey[]);
  if (role !== 'developer' && !allowedModules.includes(appType as ModuleKey)) {
    return { success: false, error: `Module "${appType}" is not enabled for this branch.` };
  }

  const conflicts = await findUserUniqueConflicts({ username, phone, email: email || undefined }, id);
  if (conflicts.length > 0) return { success: false, error: conflicts[0].message };

  let savedUserId = id;
  if (id) {
    // Edit — target must be an agent inside the allowed branch
    const target = await prisma.user.findFirst({
      where: { id, tenantId, role: 'agent', branchId },
      select: { id: true },
    });
    if (!target) return { success: false, error: 'Agent not found in your branch.' };
    const data: any = { name, username, phone, email, status,
      aadharNumber, dob, experience, age,
      bypassLoanApproval, bypassCustomerApproval, bypassVehicleApproval, autoReleaseFloat, feeConfirmationMandatory };
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: { tenantId, userId: actorId, action: 'update', entityType: 'user', entityId: id,
        newValue: JSON.stringify({ name, username, status, scope: 'branch_agent' }) },
    }).catch(() => {});
  } else {
    if (!password) return { success: false, error: 'Password is required for a new agent.' };
    if (role !== 'developer') {
      try { await checkLimit(tenantId, 'agents'); }
      catch (e: any) { return { success: false, error: e.message }; }
    }
    try {
      const created = await prisma.user.create({
        data: { tenantId, branchId, name, username, phone, email,
          passwordHash: await bcrypt.hash(password, 10),
          role: 'agent', appType, status, canCreateLoan: true,
          aadharNumber, dob, experience, age,
          bypassLoanApproval, bypassCustomerApproval, bypassVehicleApproval, autoReleaseFloat, feeConfirmationMandatory },
      });
      savedUserId = created.id;
      await prisma.auditLog.create({
        data: { tenantId, userId: actorId, action: 'create', entityType: 'user', entityId: created.id,
          newValue: JSON.stringify({ name, username, role: 'agent', appType, status, scope: 'branch_agent' }) },
      }).catch(() => {});
    } catch (err: any) {
      if (err.code === 'P2002') {
        const t = err.meta?.target;
        const tgt = Array.isArray(t) ? t.join(',') : String(t ?? '');
        if (tgt.includes('phone')) return { success: false, error: 'A user with this phone number already exists.' };
        if (tgt.includes('username')) return { success: false, error: 'A user with this username already exists.' };
        return { success: false, error: 'A user with these details already exists.' };
      }
      throw err;
    }
  }

  if (savedUserId && branchId) {
    // 1. Update UserModule
    await prisma.userModule.deleteMany({ where: { userId: savedUserId } });
    await prisma.userModule.create({
      data: {
        userId: savedUserId,
        appType,
        assignedById: actorId,
      },
    });

    // 2. Update UserBranchModule
    await prisma.userBranchModule.upsert({
      where: { userId_branchId: { userId: savedUserId, branchId } },
      update: { enabledModules: JSON.stringify([appType]) },
      create: { userId: savedUserId, branchId, enabledModules: JSON.stringify([appType]) },
    });
  }

  revalidatePath(`/${appType}/settings`);
  return { success: true };
}

// Activate / deactivate an agent, scoped to the actor's branch(es). Kept separate
// from toggleUserStatus (superadmin/dev master) so branch admins can use it too.
export async function setBranchAgentStatus(userId: string, newStatus: string, appType: string) {
  const session = await auth();
  const user = session?.user as any;
  const role = user?.role;
  const actorId = user?.id;
  if (role !== 'admin' && role !== 'superadmin' && role !== 'developer') {
    return { success: false, error: 'Unauthorized.' };
  }
  const tenantId = await getDefaultTenantId();
  const status = newStatus === 'inactive' ? 'inactive' : 'active';

  let branchWhere: any = {};
  if (role === 'admin') {
    const me = await prisma.user.findUnique({ where: { id: actorId }, select: { branchId: true } });
    if (!me?.branchId) return { success: false, error: 'Your account is not assigned to a branch.' };
    branchWhere = { branchId: me.branchId };
  } else if (role === 'superadmin') {
    const owned = await prisma.branch.findMany({ where: { tenantId, superadminId: actorId }, select: { id: true } });
    branchWhere = { branchId: { in: owned.map((b) => b.id) } };
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, tenantId, role: 'agent', ...branchWhere },
    select: { id: true },
  });
  if (!target) return { success: false, error: 'Agent not found in your branch.' };

  await prisma.user.update({ where: { id: userId }, data: { status } });
  await prisma.auditLog.create({
    data: { tenantId, userId: actorId, action: 'update', entityType: 'user', entityId: userId,
      newValue: JSON.stringify({ status, scope: 'branch_agent' }) },
  }).catch(() => {});

  revalidatePath(`/${appType}/settings`);
  return { success: true };
}

