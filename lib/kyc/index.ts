import prisma from '@/lib/db';
import { encryptAadharNumber } from '@/lib/pii';
import {
  initiateAadhaarOtp,
  verifyAadhaarOtp,
  createVideoKycSession,
  getVideoKycStatus,
} from './digio';

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
  tenantId: string,
  aadhaarNumber: string,
  agentId: string
) {
  // Check subscription
  await assertKycSubscription(tenantId);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
  });
  if (!customer) throw new Error('Customer not found');

  const result = await initiateAadhaarOtp(aadhaarNumber, customer.name);
  if (!result.success) throw new Error(result.error);

  // Store the KYC session
  const session = await prisma.kycSession.create({
    data: {
      tenantId,
      customerId,
      method:       'aadhaar_otp',
      status:       'otp_sent',
      digioRequestId: result.requestId,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      initiatedById: agentId,
    },
  });

  // Update customer KYC status
  await prisma.customer.update({
    where: { id: customerId },
    data: { kycStatus: 'otp_initiated', kycMethod: 'aadhaar_otp' },
  });

  return { sessionId: session.id, requestId: result.requestId };
}

export async function confirmAadhaarOtp(
  sessionId: string,
  tenantId: string,
  otp: string,
  agentId: string
) {
  // Check subscription
  await assertKycSubscription(tenantId);

  const session = await prisma.kycSession.findFirst({
    where: { id: sessionId, tenantId, method: 'aadhaar_otp', status: 'otp_sent' },
  });
  if (!session) throw new Error('KYC session not found or already used');
  if (!session.digioRequestId) throw new Error('Invalid session state');

  // Check OTP expiry
  if (session.otpExpiresAt && new Date() > session.otpExpiresAt) {
    throw new Error('OTP has expired. Please initiate a new request.');
  }

  const result = await verifyAadhaarOtp(session.digioRequestId, otp);
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
        kycVerifiedById: agentId,
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
        reviewedById: agentId,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId:     agentId,
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
  tenantId: string,
  agentId: string
) {
  // Check subscription
  await assertKycSubscription(tenantId);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
  });
  if (!customer) throw new Error('Customer not found');

  const result = await createVideoKycSession({
    customerName:  customer.name,
    customerPhone: customer.phone,
    referenceId:   customer.customerCode,
  });

  if (!result.success) throw new Error(result.error);

  const session = await prisma.kycSession.create({
    data: {
      tenantId,
      customerId,
      method:        'video_kyc',
      status:        'initiated',
      digioRequestId: result.sessionId,
      initiatedById: agentId,
    },
  });

  await prisma.customer.update({
    where: { id: customerId },
    data: { kycStatus: 'video_submitted', kycMethod: 'video_kyc' },
  });

  return {
    sessionId:  session.id,
    sessionUrl: result.sessionUrl,
  };
}

export async function reviewVideoKyc(
  sessionId: string,
  tenantId: string,
  adminId: string,
  decision: 'approved' | 'rejected',
  notes: string = ''
) {
  // Check subscription
  await assertKycSubscription(tenantId);

  const session = await prisma.kycSession.findFirst({
    where: { id: sessionId, tenantId, method: 'video_kyc' },
  });
  if (!session) throw new Error('Session not found');

  const newKycStatus = decision === 'approved' ? 'verified' : 'rejected';

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: session.customerId },
      data: {
        kycStatus:       newKycStatus,
        kycVerifiedAt:   decision === 'approved' ? new Date() : null,
        kycVerifiedById: decision === 'approved' ? adminId : null,
        kycRejectedReason: decision === 'rejected' ? notes : null,
      },
    });

    await tx.kycSession.update({
      where: { id: sessionId },
      data: {
        status:      decision === 'approved' ? 'video_approved' : 'video_rejected',
        reviewedById: adminId,
        reviewedAt:   new Date(),
        reviewNotes:  notes,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId:     adminId,
        action:     `kyc_${decision}`,
        entityType: 'customer',
        entityId:   session.customerId,
        newValue:   JSON.stringify({ method: 'video_kyc', decision, notes }),
      },
    });
  });
}
