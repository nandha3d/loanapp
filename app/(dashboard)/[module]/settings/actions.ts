'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, setSetting, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { hash } from 'bcryptjs';
import { auth } from '@/lib/auth';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { encryptAadharNumber, encryptField } from '@/lib/pii';
import fs from 'fs';
import path from 'path';
import { getRouteDeletionBlockReason } from '@/lib/routePolicy';
import { getActiveBranchId, getBranchEnabledModules } from '@/lib/branch';
import { findUserUniqueConflicts } from '@/lib/userUniqueness';
import { uploadBaseDir } from '@/lib/fileUpload';

const UPLOAD_DIR = uploadBaseDir();

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

  // Save QR code image
  if (qrFile && qrFile.size > 0) {
    const dir = path.join(UPLOAD_DIR, tenantId, 'settings');
    fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(qrFile.name).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase() || '.png';
    const safeName = `upi_qr_${Date.now()}${ext}`;
    const filePath = path.join(dir, safeName);
    const buffer = Buffer.from(await qrFile.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    const publicPath = `/api/files/${tenantId}/settings/${safeName}`;
    await setSetting(tenantId, 'upi_qr_url', publicPath, 'payment');
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
  const branchId = await getActiveBranchId();
  
  const primaryAgentId = formData.get('primaryAgentId') as string || null;
  const agentIds = formData.getAll('agentIds') as string[];
  // Filter out the primary agent from shared agents to avoid duplication
  const sharedAgentIds = agentIds.filter(id => id !== primaryAgentId);
  
  const newRoute = await prisma.route.create({
    data: {
      tenantId,
      branchId,
      name: formData.get('name') as string,
      appType,
      status: 'active',
      assignedAgentId: primaryAgentId || null,
      routeAgents: {
        create: sharedAgentIds.map(id => ({
          agentId: id,
          isPrimary: false
        }))
      }
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

  const activeCustomerCount = await prisma.customer.count({
    where: { routeId: id, tenantId, appType, status: 'active' },
  });
  const blockReason = getRouteDeletionBlockReason({ activeCustomerCount });
  if (blockReason) return { success: false, error: blockReason };

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

export async function setPrimaryAgent(routeId: string, agentId: string | null) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;
  if (!userId || (role !== 'admin' && role !== 'superadmin' && role !== 'developer')) {
    return { success: false, error: 'Unauthorized' };
  }

  const tenantId = await getDefaultTenantId();

  const route = await prisma.route.findFirst({ where: { id: routeId, tenantId } });
  if (!route) return { success: false, error: 'Route not found' };

  if (agentId) {
    const agent = await prisma.user.findFirst({ where: { id: agentId, tenantId, role: 'agent' } });
    if (!agent) return { success: false, error: 'Agent not found' };
  }

  await prisma.route.update({
    where: { id: routeId },
    data: { assignedAgentId: agentId || null },
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
  const valid = ['en', 'ta', 'hi', 'te', 'kn', 'ml'];
  if (!valid.includes(lang)) return { success: false, error: 'Unsupported language' };
  const tenantId = await getDefaultTenantId();
  await setSetting(tenantId, 'language', lang, 'system');
  revalidatePath('/');
  return { success: true };
}

export async function generate2faSecret() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  const secret = generateSecret();
  const username = (session.user as any).username;
  const otpauth = generateURI({ secret, label: username, issuer: 'LoanTrack' });
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  return { secret, qrCodeUrl };
}

export async function verifyAndEnable2fa(secret: string, code: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  const { valid: isValid } = verifySync({ token: code, secret });
  if (!isValid) return { success: false, error: 'Invalid verification code' };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: secret },
  });

  revalidatePath('/settings');
  return { success: true };
}

export async function disable2fa() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: null },
  });

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

  const msg91AuthKey = (formData.get('msg91_auth_key') as string) || '';
  const msg91SenderId = (formData.get('msg91_sender_id') as string) || 'LNTRCK';
  const msg91WhatsappNumber = (formData.get('msg91_whatsapp_number') as string) || '';

  const smtpHost = (formData.get('smtp_host') as string) || '';
  const smtpPort = (formData.get('smtp_port') as string) || '587';
  const smtpUser = (formData.get('smtp_user') as string) || '';
  const smtpPass = (formData.get('smtp_pass') as string) || '';
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
    setSetting(tenantId, 'msg91_auth_key', msg91AuthKey, 'notification'),
    setSetting(tenantId, 'msg91_sender_id', msg91SenderId, 'notification'),
    setSetting(tenantId, 'msg91_whatsapp_number', msg91WhatsappNumber, 'notification'),
    setSetting(tenantId, 'smtp_host', smtpHost, 'notification'),
    setSetting(tenantId, 'smtp_port', smtpPort, 'notification'),
    setSetting(tenantId, 'smtp_user', smtpUser, 'notification'),
    setSetting(tenantId, 'smtp_pass', smtpPass, 'notification'),
    setSetting(tenantId, 'smtp_from_name', smtpFromName, 'notification'),
  ]);

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
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['admin', 'superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }
  const tenantId = await getDefaultTenantId();

  await prisma.notificationTemplate.upsert({
    where: {
      tenantId_name_channel_lang: {
        tenantId,
        name: data.name,
        channel: data.channel,
        lang: data.lang,
      },
    },
    update: {
      subject: data.subject || null,
      body: data.body,
      isActive: data.isActive ?? true,
    },
    create: {
      tenantId,
      name: data.name,
      channel: data.channel,
      lang: data.lang,
      subject: data.subject || null,
      body: data.body,
      isActive: data.isActive ?? true,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'update',
      entityType: 'notification_template',
      newValue: JSON.stringify({ name: data.name, channel: data.channel, lang: data.lang }),
    },
  });

  revalidatePath('/settings');
  return { success: true };
}

