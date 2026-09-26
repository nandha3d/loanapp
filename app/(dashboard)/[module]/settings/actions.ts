'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, setSetting, getUserAppType } from '@/lib/tenant';
import { FEATURE_FLAG_KEYS } from '@/lib/features';
import { AGENT_PRECLOSE_FLAG } from '@/lib/loanPreclosePolicy';
import { canManageAdmins } from '@/lib/roles';
import { revalidatePath } from 'next/cache';
import { hash } from 'bcryptjs';
import { auth } from '@/lib/auth';
import { startTwoFactorSetup, verifyTwoFactorSetup, disableTwoFactor, TwoFactorError } from '@/lib/twoFactor';
import { encryptAadharNumber, encryptField } from '@/lib/pii';
import { getActiveBranchId, getBranchEnabledModules } from '@/lib/branch';
import { findUserUniqueConflicts } from '@/lib/userUniqueness';
import { storeTenantUpload } from '@/lib/fileUpload';
import {
  RouteError,
  createManagedRoute,
  deleteManagedRoute,
  assignManagedRouteAgent,
  removeManagedRouteAgent,
  setManagedPrimaryAgent,
} from '@/lib/routes/service';
import { createPackage, deletePackage, PackageError } from '@/lib/packages/service';
import { saveManagedNotificationTemplate, TemplateError } from '@/lib/notify/templates';

async function settingsManagerActor() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? '';
  if (!session?.user?.id || !['admin', 'superadmin', 'developer'].includes(role)) return null;
  return {
    tenantId: await getDefaultTenantId(),
    appType: await getUserAppType(),
    branchId: await getActiveBranchId(),
    userId: session.user.id,
    role,
  };
}

function managedRouteFailure(error: unknown) {
  return { success: false, error: error instanceof RouteError ? error.message : 'Route operation failed' };
}

function packageFailure(error: unknown) {
  return { success: false, error: error instanceof PackageError ? error.message : 'Package operation failed' };
}

export async function saveUpiQrCode(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }

  const tenantId = await getDefaultTenantId();
  const qrFile = formData.get('upiQrCode') as File | null;
  const upiId = formData.get('upiId') as string || '';

  // Save UPI ID setting
  if (upiId) {
    await setSetting(tenantId, 'upi_id', upiId, 'payment');
  }

  // Save Receipt PDF Active setting
  const receiptPdfActive = formData.get('receipt_pdf_active') === 'true' ? 'true' : 'false';
  await setSetting(tenantId, 'receipt_pdf_active', receiptPdfActive, 'payment');

  // Manual UPI verification (default off — UPI auto-verifies and credits the
  // account at collection time; on = admin reviews each UPI payment by hand).
  const upiManualVerification = formData.get('upi_manual_verification') === 'true' ? 'true' : 'false';
  await setSetting(tenantId, 'upi_manual_verification', upiManualVerification, 'payment');

  // Save QR code image
  if (qrFile && qrFile.size > 0) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(qrFile.type)) {
      return { success: false, error: 'UPI QR code must be a JPEG, PNG, or WebP image' };
    }

    try {
      const stored = await storeTenantUpload({
        tenantId,
        mimeType: qrFile.type,
        buffer: Buffer.from(await qrFile.arrayBuffer()),
        scopes: ['settings'],
        prefix: 'upi_qr',
      });
      await setSetting(tenantId, 'upi_qr_url', stored.url, 'payment');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to save UPI QR code',
      };
    }
  }

  revalidatePath('/settings');
  return { success: true };
}

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

/**
 * Per-tenant feature opt-ins (lib/features.ts). Superadmin-only: these change
 * which products the tenant can originate, unlike the routine system settings a
 * branch admin edits. Written through setSetting so the tenant settings cache
 * invalidates immediately — a flag flipped directly in the DB needs an app
 * restart to take effect.
 */
export async function saveFeatureFlags(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized. Super Admin only.' };
  }
  const tenantId = await getDefaultTenantId();
  const saved: Record<string, string> = {};

  const featureAppType = await getUserAppType();
  for (const key of FEATURE_FLAG_KEYS) {
    if (key === AGENT_PRECLOSE_FLAG && featureAppType !== 'microlending') continue;
    const value = formData.get(key) === 'on' || formData.get(key) === 'true' ? '1' : '0';
    await setSetting(tenantId, key, value, 'features');
    saved[key] = value;
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'settings',
      newValue: JSON.stringify({ category: 'features', changes: saved }),
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
  const actor = await settingsManagerActor();
  if (!actor) return { success: false, error: 'Unauthorized' };
  try {
    const route = await createManagedRoute(actor, {
      name: String(formData.get('name') ?? ''),
      primaryAgentId: String(formData.get('primaryAgentId') ?? '') || null,
      sharedAgentIds: formData.getAll('agentIds').map(String),
    });
    revalidatePath('/settings');
    return { success: true, route };
  } catch (error) { return managedRouteFailure(error); }
}

export async function deleteRoute(id: string) {
  const actor = await settingsManagerActor();
  if (!actor) return { success: false, error: 'Unauthorized' };
  try {
    await deleteManagedRoute(actor, id);
    revalidatePath('/settings');
    return { success: true };
  } catch (error) { return managedRouteFailure(error); }
}

export async function createLoanPackage(formData: FormData) {
  const actor = await settingsManagerActor();
  if (!actor) return { success: false, error: 'Unauthorized' };
  try {
    const input = Object.fromEntries(formData.entries());
    await createPackage(actor, input);
    revalidatePath('/settings');
    return { success: true };
  } catch (error) { return packageFailure(error); }
}

export async function deleteLoanPackage(id: string) {
  const actor = await settingsManagerActor();
  if (!actor) return { success: false, error: 'Unauthorized' };
  try {
    await deletePackage(actor, id);
    revalidatePath('/settings');
    return { success: true };
  } catch (error) { return packageFailure(error); }
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
  // A plain admin creating a peer admin was an escalation route: the new account
  // carried the same rights with nobody able to constrain it. Minting an admin
  // now requires primary-admin rank or above.
  if (
    requestedRole === 'admin' &&
    !canManageAdmins({ role, isPrimaryAdmin: (session?.user as any)?.isPrimaryAdmin })
  ) {
    return { success: false, error: 'Only a Primary Admin or Super Admin can create admin accounts' };
  }
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const phone = ((formData.get('phone') as string) || '').trim();
  const username = ((formData.get('username') as string) || phone).trim().toLowerCase();
  const email = ((formData.get('email') as string) || '').trim().toLowerCase() || null;
  if (!username || !phone) {
    return { success: false, error: 'Username and phone are required' };
  }
  const conflicts = await findUserUniqueConflicts({ username, phone, email: email || undefined });
  if (conflicts.length > 0) return { success: false, error: conflicts[0].message };
  const passwordHash = await hash(formData.get('password') as string, 12);
  
  // For admin users, assign the currently active branchId
  let adminBranchId: string | null = null;
  if (requestedRole === 'admin') {
    adminBranchId = await getActiveBranchId();
    if (!adminBranchId) {
      return { success: false, error: 'No active branch found. Cannot create admin without branch assignment.' };
    }
  }
  
  const newUser = await prisma.user.create({
    data: {
      tenantId,
      name: formData.get('name') as string,
      phone,
      email,
      username,
      role: requestedRole,
      appType: appType,
      passwordHash,
      status: 'active',
      branchId: adminBranchId,
    }
  });

  // For admin users, create UserBranchModule with the branch's enabled modules
  if (requestedRole === 'admin' && adminBranchId) {
    const branchModules = await getBranchEnabledModules(adminBranchId);
    await prisma.userBranchModule.create({
      data: {
        userId: newUser.id,
        branchId: adminBranchId,
        enabledModules: JSON.stringify(branchModules),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: 'create',
      entityType: 'user',
      entityId: newUser.id,
      newValue: JSON.stringify({ name: newUser.name, username: newUser.username, role: newUser.role, branchId: adminBranchId }),
    },
  });
  
  revalidatePath('/settings');
  return { success: true, user: newUser };
}

export async function assignAgentToRoute(routeId: string, agentId: string) {
  const actor = await settingsManagerActor();
  if (!actor) return { success: false, error: 'Unauthorized' };
  try {
    await assignManagedRouteAgent(actor, routeId, agentId);
    revalidatePath('/settings');
    return { success: true };
  } catch (error) { return managedRouteFailure(error); }
}

export async function setPrimaryAgent(routeId: string, agentId: string | null) {
  const actor = await settingsManagerActor();
  if (!actor) return { success: false, error: 'Unauthorized' };
  try {
    await setManagedPrimaryAgent(actor, routeId, agentId);
    revalidatePath('/settings');
    return { success: true };
  } catch (error) { return managedRouteFailure(error); }
}

export async function removeAgentFromRoute(routeId: string, agentId: string) {
  const actor = await settingsManagerActor();
  if (!actor) return { success: false, error: 'Unauthorized' };
  try {
    await removeManagedRouteAgent(actor, routeId, agentId);
    revalidatePath('/settings');
    return { success: true };
  } catch (error) { return managedRouteFailure(error); }
}

export async function updateLanguage(lang: string) {
  const valid = ['en', 'ta', 'hi', 'te', 'kn', 'ml'];
  if (!valid.includes(lang)) return { success: false, error: 'Unsupported language' };
  const tenantId = await getDefaultTenantId();
  await setSetting(tenantId, 'language', lang, 'system');
  revalidatePath('/');
  return { success: true };
}

export async function generate2faSecret() {
  const actor = await settingsManagerActor();
  if (!actor) throw new TwoFactorError('Unauthorized', 401);
  return startTwoFactorSetup(actor);
}

export async function verifyAndEnable2fa(setupToken: string, code: string) {
  const actor = await settingsManagerActor();
  if (!actor) return { success: false, error: 'Unauthorized' };
  try {
    await verifyTwoFactorSetup(actor, setupToken, code);
    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof TwoFactorError ? error.message : '2FA verification failed' };
  }
}

export async function disable2fa() {
  const actor = await settingsManagerActor();
  if (!actor) throw new TwoFactorError('Unauthorized', 401);
  await disableTwoFactor(actor);
  revalidatePath('/settings');
  return { success: true };
}

export async function importCustomers(data: any[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  const results = { success: 0, failed: 0 };

  for (const item of data) {
    try {
      await prisma.customer.create({
        data: {
          tenantId,
          appType,
          customerCode: item.customerCode || `CUST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: item.name,
          phone: item.phone,
          aadharNumber: encryptAadharNumber(item.aadhaar || item.aadharNumber || null),
          pan: item.pan || null,
          status: 'active',
        }
      });
      results.success++;
    } catch {
      results.failed++;
    }
  }

  revalidatePath('/customers');
  return results;
}

export async function importCollections(data: any[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const tenantId = await getDefaultTenantId();

  const results = { success: 0, failed: 0 };

  for (const item of data) {
    try {
      // Logic for bulk collection import
      results.success++;
    } catch {
      results.failed++;
    }
  }

  revalidatePath('/collection');
  return results;
}

export async function wipeDatabaseRecords(tablesToWipe: string[]) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  
  if (!userId || role !== 'superadmin') {
    return { success: false, error: 'Unauthorized: Only Superadmins can perform this action' };
  }
  
  const tenantId = await getDefaultTenantId();
  
  try {
    await prisma.$transaction(async (tx) => {
      if (tablesToWipe.includes('loans')) {
        await tx.dailyCollection.deleteMany({ where: { tenantId } });
        await tx.collectionEntry.deleteMany({ where: { tenantId } });
        await tx.payment.deleteMany({ where: { loan: { tenantId } } });
        await tx.penalty.deleteMany({ where: { loan: { tenantId } } });
        await tx.instalment.deleteMany({ where: { loan: { tenantId } } });
        await tx.loanCollateral.deleteMany({ where: { loan: { tenantId } } });
        await tx.loan.deleteMany({ where: { tenantId } });
      }

      if (tablesToWipe.includes('customers')) {
        await tx.guarantor.deleteMany({ where: { customer: { tenantId } } });
        await tx.vehicle.deleteMany({ where: { tenantId } });
        await tx.securityCheque.deleteMany({ where: { customer: { tenantId } } });
        await tx.customer.deleteMany({ where: { tenantId } });
      }

      if (tablesToWipe.includes('accounting')) {
        await tx.accountEntry.deleteMany({ where: { tenantId } });
        // Wallet ledger drives Branch Cash / Agent Float / Released-to-Agent on
        // the dashboard. Clear the transactions first, then zero the balances by
        // removing the account rows (recreated lazily on next release/disburse).
        await tx.walletTransaction.deleteMany({ where: { tenantId } });
        await tx.cashHandover.deleteMany({ where: { tenantId } });
        await tx.agentAccount.deleteMany({ where: { tenantId } });
        await tx.branchCashAccount.deleteMany({ where: { tenantId } });
      }

      // Helper function to delete a specific set of users
      const deleteUsersByRole = async (rolesToDelete: string[]) => {
        const usersToDelete = await tx.user.findMany({
          where: { tenantId, role: { in: rolesToDelete } },
          select: { id: true },
        });
        const userIds = usersToDelete.map(u => u.id);

        if (userIds.length > 0) {
          // Delete daily collections and their entries for these users
          await tx.collectionEntry.deleteMany({
            where: { agentId: { in: userIds } },
          });
          await tx.dailyCollection.deleteMany({
            where: { agentId: { in: userIds } },
          });

          // Nullify customer agent assignments
          await tx.customer.updateMany({
            where: { tenantId, agentId: { in: userIds } },
            data: { agentId: null },
          });

          // Nullify loan creator references
          await tx.loan.updateMany({
            where: { tenantId, createdById: { in: userIds } },
            data: { createdById: null },
          });

          // Nullify penalty settler references
          await tx.penalty.updateMany({
            where: { settledById: { in: userIds } },
            data: { settledById: null },
          });

          // Delete approval requests made/reviewed by these users
          await tx.approvalRequest.deleteMany({
            where: { tenantId, requestedById: { in: userIds } },
          });
          await tx.approvalRequest.deleteMany({
            where: { tenantId, reviewedById: { in: userIds } },
          });

          // Delete branch requests made/reviewed by these users
          await tx.branchRequest.deleteMany({
            where: { tenantId, requestedById: { in: userIds } },
          });
          await tx.branchRequest.deleteMany({
            where: { tenantId, reviewedById: { in: userIds } },
          });

          // Nullify route assigned agent references
          await tx.route.updateMany({
            where: { tenantId, assignedAgentId: { in: userIds } },
            data: { assignedAgentId: null },
          });

          // Delete route-agent associations
          await tx.routeAgent.deleteMany({
            where: { agentId: { in: userIds } },
          });

          // Delete user-branch-module associations
          await tx.userBranchModule.deleteMany({
            where: { userId: { in: userIds } },
          });

          // Delete cash handover records
          await tx.cashHandover.deleteMany({
            where: {
              OR: [
                { agentId: { in: userIds } },
                { adminId: { in: userIds } },
              ]
            },
          });

          // Nullify vehicle repo flag references
          await tx.vehicle.updateMany({
            where: { tenantId, repoFlaggedById: { in: userIds } },
            data: { repoFlaggedById: null },
          });

          // Delete account entries created by these users
          await tx.accountEntry.deleteMany({
            where: { tenantId, createdBy: { in: userIds } },
          });

          // Delete the user records
          await tx.user.deleteMany({
            where: { id: { in: userIds } },
          });
        }
      };

      if (tablesToWipe.includes('agents')) {
        await deleteUsersByRole(['agent']);
      }

      if (tablesToWipe.includes('admins')) {
        await deleteUsersByRole(['admin']);
      }

      if (tablesToWipe.includes('agents_routes')) {
        // Delete both agents and admins when wiping routes
        await deleteUsersByRole(['agent', 'admin']);

        // Delete all routes and route-agent associations
        await tx.routeAgent.deleteMany({ where: { route: { tenantId } } });
        await tx.route.deleteMany({ where: { tenantId } });
      }

      if (tablesToWipe.includes('approvals')) {
        await tx.approvalRequest.deleteMany({ where: { tenantId } });
        await tx.auditLog.deleteMany({ where: { tenantId } });
      }
      
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'database_wipe',
          entityType: 'system',
          newValue: JSON.stringify({ wiped: tablesToWipe }),
        }
      });
    });

    revalidatePath('/dashboard');
    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    console.error('Failed to wipe database records:', err);
    return { success: false, error: err.message || 'Database wipe failed' };
  }
}

export async function saveThemeSettings(presetKey: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Only a superadmin can change the theme' };
  }
  const { getThemePreset, THEME_SETTING_KEY } = await import('@/lib/themes');
  const preset = presetKey === 'default' ? null : getThemePreset(presetKey);
  if (presetKey !== 'default' && !preset) {
    return { success: false, error: 'Unknown theme' };
  }

  const tenantId = await getDefaultTenantId();
  await Promise.all([
    setSetting(tenantId, THEME_SETTING_KEY, presetKey, 'branding'),
    // Concrete colours so web layout + mobile app read them directly.
    setSetting(tenantId, 'primary_color', preset?.primary ?? '#F5A623', 'branding'),
    setSetting(tenantId, 'primary_dark', preset?.primaryDark ?? '#E8930C', 'branding'),
    setSetting(tenantId, 'primary_light', preset?.primaryLight ?? '#FFF3E0', 'branding'),
    setSetting(tenantId, 'accent_color', preset?.accent ?? '#FFC107', 'branding'),
  ]);

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'settings',
      newValue: JSON.stringify({ category: 'theme', preset: presetKey }),
    },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function saveNotificationSettings(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }
  const tenantId = await getDefaultTenantId();

  const whatsappSmsActive = formData.get('whatsapp_sms_active') === 'true' ? 'true' : 'false';
  const notifyChannelSms = formData.get('notify_channel_sms') === 'true' ? 'true' : 'false';
  const notifyChannelWhatsapp = formData.get('notify_channel_whatsapp') === 'true' ? 'true' : 'false';
  const notifyChannelEmail = formData.get('notify_channel_email') === 'true' ? 'true' : 'false';

  const notifyEventPaymentReceived = formData.get('notify_event_payment_received') === 'true' ? 'true' : 'false';
  const notifyEventDueReminder = formData.get('notify_event_due_reminder') === 'true' ? 'true' : 'false';
  const notifyEventLoanDisbursed = formData.get('notify_event_loan_disbursed') === 'true' ? 'true' : 'false';
  const notifyEventLoanOverdue = formData.get('notify_event_loan_overdue') === 'true' ? 'true' : 'false';
  const notifyEventLoanClosed = formData.get('notify_event_loan_closed') === 'true' ? 'true' : 'false';
  const notifyEventPenaltyAccrued = formData.get('notify_event_penalty_accrued') === 'true' ? 'true' : 'false';

  const msg91AuthKey = ((formData.get('msg91_auth_key') as string) || '').trim();
  const msg91SenderId = (formData.get('msg91_sender_id') as string) || 'LNTRCK';
  const msg91WhatsappNumber = (formData.get('msg91_whatsapp_number') as string) || '';

  const smtpHost = (formData.get('smtp_host') as string) || '';
  const smtpPort = (formData.get('smtp_port') as string) || '587';
  const smtpUser = (formData.get('smtp_user') as string) || '';
  const smtpPass = ((formData.get('smtp_pass') as string) || '').trim();
  const smtpFromName = (formData.get('smtp_from_name') as string) || '';

  await Promise.all([
    setSetting(tenantId, 'whatsapp_sms_active', whatsappSmsActive, 'notification'),
    setSetting(tenantId, 'notify_channel_sms', notifyChannelSms, 'notification'),
    setSetting(tenantId, 'notify_channel_whatsapp', notifyChannelWhatsapp, 'notification'),
    setSetting(tenantId, 'notify_channel_email', notifyChannelEmail, 'notification'),
    setSetting(tenantId, 'notify_event_payment_received', notifyEventPaymentReceived, 'notification'),
    setSetting(tenantId, 'notify_event_due_reminder', notifyEventDueReminder, 'notification'),
    setSetting(tenantId, 'notify_event_loan_disbursed', notifyEventLoanDisbursed, 'notification'),
    setSetting(tenantId, 'notify_event_loan_overdue', notifyEventLoanOverdue, 'notification'),
    setSetting(tenantId, 'notify_event_loan_closed', notifyEventLoanClosed, 'notification'),
    setSetting(tenantId, 'notify_event_penalty_accrued', notifyEventPenaltyAccrued, 'notification'),
    setSetting(tenantId, 'msg91_sender_id', msg91SenderId, 'notification'),
    setSetting(tenantId, 'msg91_whatsapp_number', msg91WhatsappNumber, 'notification'),
    setSetting(tenantId, 'smtp_host', smtpHost, 'notification'),
    setSetting(tenantId, 'smtp_port', smtpPort, 'notification'),
    setSetting(tenantId, 'smtp_user', smtpUser, 'notification'),
    setSetting(tenantId, 'smtp_from_name', smtpFromName, 'notification'),
  ]);

  if (msg91AuthKey) {
    await setSetting(tenantId, 'msg91_auth_key', encryptField(msg91AuthKey) || '', 'notification');
  }
  if (smtpPass) {
    await setSetting(tenantId, 'smtp_pass', encryptField(smtpPass) || '', 'notification');
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'settings',
      newValue: JSON.stringify({ category: 'notification', whatsapp_sms_active: whatsappSmsActive }),
    },
  });

  revalidatePath('/settings');
  return { success: true };
}

export async function saveBureauSettings(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }
  const tenantId = await getDefaultTenantId();

  const provider = (formData.get('provider') as string) || 'CRIF';
  const environment = (formData.get('environment') as string) || 'sandbox';
  const memberId = formData.get('memberId') as string;
  const apiKey = formData.get('apiKey') as string;
  const apiSecret = formData.get('apiSecret') as string || '';
  const isActive = formData.get('isActive') === 'true';

  const certFile = formData.get('bureauCert') as File | null;
  const keyFile = formData.get('bureauKey') as File | null;

  const existingCred = await prisma.bureauCredential.findUnique({
    where: { tenantId }
  });

  let certPemBase64 = existingCred?.bureauCert || null;
  let keyPemBase64 = existingCred?.bureauKey || null;

  if (certFile && certFile.size > 0) {
    const certText = Buffer.from(await certFile.arrayBuffer()).toString('utf-8');
    certPemBase64 = encryptField(certText);
  }

  if (keyFile && keyFile.size > 0) {
    const keyText = Buffer.from(await keyFile.arrayBuffer()).toString('utf-8');
    keyPemBase64 = encryptField(keyText);
  }

  await prisma.bureauCredential.upsert({
    where: { tenantId },
    update: {
      provider,
      memberId: encryptField(memberId) || '',
      apiKey: encryptField(apiKey) || '',
      apiSecret: apiSecret ? (encryptField(apiSecret) || '') : null,
      bureauCert: certPemBase64,
      bureauKey: keyPemBase64,
      environment,
      isActive,
    },
    create: {
      tenantId,
      provider,
      memberId: encryptField(memberId) || '',
      apiKey: encryptField(apiKey) || '',
      apiSecret: apiSecret ? (encryptField(apiSecret) || '') : null,
      bureauCert: certPemBase64,
      bureauKey: keyPemBase64,
      environment,
      isActive,
    }
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'settings',
      newValue: JSON.stringify({ category: 'bureau', provider, environment, hasCert: !!certPemBase64 }),
    },
  });

  revalidatePath('/settings');
  return { success: true };
}

export async function saveNotificationTemplate(data: {
  name: string;
  channel: string;
  lang: string;
  subject?: string | null;
  body: string;
  isActive?: boolean;
}) {
  const actor = await settingsManagerActor();
  if (!actor) return { success: false, error: 'Unauthorized' };
  try {
    await saveManagedNotificationTemplate(actor, data);
    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof TemplateError ? error.message : 'Template save failed' };
  }
}

/**
 * Create a new branch for the tenant directly in Settings.
 * Gated by subscription plan limits (`maxBranches`) and tenant's subscribed modules.
 */
export async function createTenantBranch(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized: Only business owners (superadmin) can create branches.' };
  }

  const tenantId = await getDefaultTenantId();

  // Enforce subscription active status
  try {
    const { assertTenantSubscriptionAccess } = await import('@/lib/subscription');
    await assertTenantSubscriptionAccess(tenantId);
  } catch (err: any) {
    return { success: false, error: err.message || 'Subscription inactive or payment required' };
  }

  // Enforce branch limit
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { enabledModules: true, maxBranches: true },
  });

  const existingBranchCount = await prisma.branch.count({
    where: { tenantId, status: 'active' },
  });

  if (sub && sub.maxBranches > 0 && existingBranchCount >= sub.maxBranches) {
    return {
      success: false,
      error: `Branch limit reached (${existingBranchCount}/${sub.maxBranches}). Upgrade your subscription plan to add more branches.`,
    };
  }

  const name = (formData.get('name') as string)?.trim();
  const rawCode = (formData.get('code') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim() || null;
  const address = (formData.get('address') as string)?.trim() || null;

  if (!name) {
    return { success: false, error: 'Branch name is required.' };
  }

  const code = rawCode ? rawCode.toUpperCase() : null;

  if (code) {
    const existingCode = await prisma.branch.findFirst({
      where: { tenantId, code },
      select: { id: true },
    });
    if (existingCode) {
      return { success: false, error: `Branch code "${code}" already exists for your business.` };
    }
  }

  // Validate modules against tenant subscription
  const { normalizeModuleList } = await import('@/types/modules');
  const planModules = normalizeModuleList(sub?.enabledModules);
  const selectedModules = normalizeModuleList(formData.getAll('enabledModules'));

  // If no modules selected, default to tenant plan modules
  const finalModules = selectedModules.length > 0
    ? selectedModules.filter((m) => planModules.includes(m))
    : planModules;

  if (finalModules.length === 0) {
    return { success: false, error: 'At least one valid module from your subscription must be enabled for this branch.' };
  }

  try {
    const branch = await prisma.$transaction(async (tx) => {
      const b = await tx.branch.create({
        data: {
          tenantId,
          superadminId: userId,
          name,
          code,
          phone,
          address,
          status: 'active',
          enabledModules: JSON.stringify(finalModules),
        },
      });

      // Link creating user in SuperadminBranch so the branch is immediately available in switcher
      await tx.superadminBranch.create({
        data: {
          superadminId: userId,
          branchId: b.id,
          assignedById: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'create',
          entityType: 'branch',
          entityId: b.id,
          newValue: JSON.stringify({ name, code, phone, address, enabledModules: finalModules }),
        },
      });

      return b;
    });

    revalidatePath('/settings');
    revalidatePath('/portal');
    return { success: true, branch: { id: branch.id, name: branch.name } };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'Branch code already exists for this business.' };
    }
    return { success: false, error: error.message || 'Failed to create branch.' };
  }
}

/**
 * Update an existing branch in Settings.
 */
export async function updateTenantBranch(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized: Only business owners (superadmin) can manage branches.' };
  }

  const tenantId = await getDefaultTenantId();
  const branchId = formData.get('id') as string;
  if (!branchId) return { success: false, error: 'Branch ID is required.' };

  const targetBranch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
  });
  if (!targetBranch) return { success: false, error: 'Branch not found.' };

  const name = (formData.get('name') as string)?.trim();
  const rawCode = (formData.get('code') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim() || null;
  const address = (formData.get('address') as string)?.trim() || null;
  const status = (formData.get('status') as string)?.trim() || targetBranch.status;

  if (!name) return { success: false, error: 'Branch name is required.' };

  const code = rawCode ? rawCode.toUpperCase() : null;
  if (code && code !== targetBranch.code) {
    const conflict = await prisma.branch.findFirst({
      where: { tenantId, code, id: { not: branchId } },
      select: { id: true },
    });
    if (conflict) {
      return { success: false, error: `Branch code "${code}" is already in use by another branch.` };
    }
  }

  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { enabledModules: true },
  });
  const { normalizeModuleList } = await import('@/types/modules');
  const planModules = normalizeModuleList(sub?.enabledModules);
  const selectedModules = normalizeModuleList(formData.getAll('enabledModules'));
  const finalModules = selectedModules.length > 0
    ? selectedModules.filter((m) => planModules.includes(m))
    : normalizeModuleList(targetBranch.enabledModules);

  await prisma.branch.update({
    where: { id: branchId },
    data: {
      name,
      code,
      phone,
      address,
      status,
      enabledModules: JSON.stringify(finalModules),
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'branch',
      entityId: branchId,
      oldValue: JSON.stringify({ name: targetBranch.name, code: targetBranch.code, status: targetBranch.status }),
      newValue: JSON.stringify({ name, code, phone, address, status, enabledModules: finalModules }),
    },
  });

  revalidatePath('/settings');
  revalidatePath('/portal');
  return { success: true };
}

/**
 * Toggle branch status (active / inactive).
 */
export async function toggleBranchStatus(branchId: string, currentStatus: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }

  const tenantId = await getDefaultTenantId();
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

  if (newStatus === 'active') {
    const sub = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { maxBranches: true },
    });
    const activeCount = await prisma.branch.count({
      where: { tenantId, status: 'active' },
    });
    if (sub && sub.maxBranches > 0 && activeCount >= sub.maxBranches) {
      return {
        success: false,
        error: `Cannot activate branch. Plan limit reached (${activeCount}/${sub.maxBranches}). Upgrade your plan to activate more branches.`,
      };
    }
  }

  await prisma.branch.update({
    where: { id: branchId },
    data: { status: newStatus },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'branch',
      entityId: branchId,
      newValue: JSON.stringify({ status: newStatus }),
    },
  });

  revalidatePath('/settings');
  revalidatePath('/portal');
  return { success: true, status: newStatus };
}

