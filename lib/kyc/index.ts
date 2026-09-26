import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import {
  initiateAadhaarOtp,
  verifyAadhaarOtp,
  createVideoKycSession,
  getVideoKycStatus,
} from './digio';

export type KycActor = {
  tenantId: string;
  appType: string;
  branchId: string | null;
  userId: string;
  role: string;
};

export class KycNotFoundError extends Error {}

export function kycCustomerWhere(actor: KycActor, customerId?: string): Prisma.CustomerWhereInput {
  return {
    ...(customerId ? { id: customerId } : {}),
    tenantId: actor.tenantId,
    appType: actor.appType,
    ...(actor.role === 'agent'
      ? { AND: [buildAgentCustomerAccessWhere({ userId: actor.userId })] }
      : actor.branchId ? { branchId: actor.branchId } : {}),
  };
}

async function assertScopedCustomer(actor: KycActor, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: kycCustomerWhere(actor, customerId),
  });
  if (!customer) throw new KycNotFoundError('Customer not found');
  return customer;
}

// ── Helper: Gating Check ──────────────────────────────────────────────────────

async function assertKycSubscription(tenantId: string) {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { kycEnabled: true },
  });
  if (!sub || !sub.kycEnabled) {
    throw new Error('KYC Verification module is not enabled for your subscription.');
  }
}

// ── Aadhaar OTP flow ──────────────────────────────────────────────────────────

export async function startAadhaarOtpKyc(
  customerId: string,
  actor: KycActor,
  aadhaarNumber: string,
) {
  if (!/^\d{12}$/.test(aadhaarNumber)) throw new Error('Valid 12-digit Aadhaar number required');
  await assertKycSubscription(actor.tenantId);
  const customer = await assertScopedCustomer(actor, customerId);

  const result = await initiateAadhaarOtp(actor.tenantId, aadhaarNumber, customer.name);
  if (!result.success) throw new Error(result.error);

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.kycSession.create({
      data: {
        tenantId: actor.tenantId,
        customerId,
        method: 'aadhaar_otp',
        status: 'otp_sent',
        digioRequestId: result.requestId,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        initiatedById: actor.userId,
      },
    });
    await tx.customer.update({
      where: { id: customerId },
      data: { kycStatus: 'otp_initiated', kycMethod: 'aadhaar_otp' },
    });
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'kyc_initiated',
        entityType: 'customer',
        entityId: customerId,
        newValue: JSON.stringify({ method: 'aadhaar_otp' }),
      },
    });
    return created;
  });

  return { sessionId: session.id, requestId: result.requestId };
}

export async function confirmAadhaarOtp(
  sessionId: string,
  actor: KycActor,
  otp: string,
) {
  if (!/^\d{4,8}$/.test(otp)) throw new Error('Valid OTP required');
  await assertKycSubscription(actor.tenantId);

  const session = await prisma.kycSession.findFirst({
    where: {
      id: sessionId,
      tenantId: actor.tenantId,
      method: 'aadhaar_otp',
      status: 'otp_sent',
      customer: { is: kycCustomerWhere(actor) },
    },
  });
  if (!session) throw new KycNotFoundError('KYC session not found or already used');
  if (!session.digioRequestId) throw new Error('Invalid session state');

  // Check OTP expiry
  if (session.otpExpiresAt && new Date() > session.otpExpiresAt) {
    throw new Error('OTP has expired. Please initiate a new request.');
  }

  const claimed = await prisma.kycSession.updateMany({
    where: { id: sessionId, tenantId: actor.tenantId, status: 'otp_sent' },
    data: { status: 'otp_verifying' },
  });
  if (claimed.count !== 1) throw new KycNotFoundError('KYC session not found or already used');

  let result;
  try {
    result = await verifyAadhaarOtp(actor.tenantId, session.digioRequestId, otp);
  } catch (error) {
    await prisma.kycSession.update({ where: { id: sessionId }, data: { status: 'failed' } });
    throw error;
  }
  if (!result.success) {
    await prisma.kycSession.update({
      where: { id: sessionId },
      data:  { status: 'failed' },
    });
    throw new Error(result.error || 'OTP verification failed');
  }

  const kycData = result.kycData!;

  // Save photo to disk if returned as base64
  let photoPath: string | null = null;
  if (kycData.photo && kycData.photo.startsWith('data:')) {
    const base64Data = kycData.photo.split(',')[1];
    const fs = await import('fs/promises');
    const path = await import('path');
    const dir  = path.join(process.cwd(), 'public', 'kyc-photos');
    await fs.mkdir(dir, { recursive: true });
    const fileName = `${session.customerId}-aadhaar-photo.jpg`;
    await fs.writeFile(path.join(dir, fileName), Buffer.from(base64Data, 'base64'));
    photoPath = `/kyc-photos/${fileName}`;
  }

  await prisma.$transaction(async (tx) => {
    // Update customer with verified UIDAI data (Aadhaar needs to be encrypted at rest in Customer table)
    await tx.customer.update({
      where: { id: session.customerId },
      data: {
        kycStatus:       'verified',
        kycMethod:       'aadhaar_otp',
        kycVerifiedAt:   new Date(),
        kycVerifiedById: actor.userId,
        aadhaarVerified: true,
        aadhaarName:     kycData.name,
        aadhaarDob:      kycData.dob,
        aadhaarAddress:  kycData.address,
        ...(photoPath ? { aadhaarPhoto: photoPath } : {}),
        // Update name if customer consents
        name:            kycData.name || undefined,
      },
    });

    // Mark session as verified
    await tx.kycSession.update({
      where: { id: sessionId },
      data: {
        status:       'otp_verified',
        responseData: JSON.stringify(kycData),
        reviewedAt:   new Date(),
        reviewedById: actor.userId,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId:     actor.userId,
        action:     'kyc_verified',
        entityType: 'customer',
        entityId:   session.customerId,
        newValue:   JSON.stringify({ method: 'aadhaar_otp', aadhaarName: kycData.name }),
      },
    });
  });

  return { verified: true, aadhaarName: kycData.name };
}

// ── Video KYC flow ────────────────────────────────────────────────────────────

export async function startVideoKyc(
  customerId: string,
  actor: KycActor,
) {
  await assertKycSubscription(actor.tenantId);
  const customer = await assertScopedCustomer(actor, customerId);

  const result = await createVideoKycSession({
    tenantId: actor.tenantId,
    customerName:  customer.name,
    customerPhone: customer.phone,
    referenceId:   customer.customerCode,
  });

  if (!result.success) throw new Error(result.error);

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.kycSession.create({
      data: {
        tenantId: actor.tenantId,
        customerId,
        method: 'video_kyc',
        status: 'initiated',
        digioRequestId: result.sessionId,
        initiatedById: actor.userId,
      },
    });
    await tx.customer.update({
      where: { id: customerId },
      data: { kycStatus: 'video_submitted', kycMethod: 'video_kyc' },
    });
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'kyc_initiated',
        entityType: 'customer',
        entityId: customerId,
        newValue: JSON.stringify({ method: 'video_kyc' }),
      },
    });
    return created;
  });

  return {
    sessionId:  session.id,
    sessionUrl: result.sessionUrl,
  };
}

export async function reviewVideoKyc(
  sessionId: string,
  actor: KycActor,
  decision: 'approved' | 'rejected',
  notes: string = ''
) {
  if (!['admin', 'superadmin', 'developer'].includes(actor.role)) throw new Error('Forbidden');
  await assertKycSubscription(actor.tenantId);

  const session = await prisma.kycSession.findFirst({
    where: {
      id: sessionId,
      tenantId: actor.tenantId,
      method: 'video_kyc',
      customer: { is: kycCustomerWhere(actor) },
    },
  });
  if (!session) throw new KycNotFoundError('Session not found');

  const newKycStatus = decision === 'approved' ? 'verified' : 'rejected';

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: session.customerId },
      data: {
        kycStatus:       newKycStatus,
        kycVerifiedAt:   decision === 'approved' ? new Date() : null,
        kycVerifiedById: decision === 'approved' ? actor.userId : null,
        kycRejectedReason: decision === 'rejected' ? notes : null,
      },
    });

    await tx.kycSession.update({
      where: { id: sessionId },
      data: {
        status:      decision === 'approved' ? 'video_approved' : 'video_rejected',
        reviewedById: actor.userId,
        reviewedAt:   new Date(),
        reviewNotes:  notes,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId:     actor.userId,
        action:     `kyc_${decision}`,
        entityType: 'customer',
        entityId:   session.customerId,
        newValue:   JSON.stringify({ method: 'video_kyc', decision, notes }),
      },
    });
  });
}
