'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || role === 'agent') redirect('/collection');
  return session;
}

export async function createVehicle(formData: FormData) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();

  const customerId = formData.get('customerId') as string;
  const loanId = (formData.get('loanId') as string) || null;

  // Security: verify customer belongs to this tenant
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) return { error: 'Customer not found or not in your tenant' };

  // Security: if loanId given, verify it belongs to this tenant's customer
  if (loanId) {
    const loan = await prisma.loan.findFirst({ where: { id: loanId, tenantId } });
    if (!loan) return { error: 'Loan not found or not in your tenant' };
  }
  const make = formData.get('make') as string;
  const model = formData.get('model') as string;
  const year = formData.get('year') ? parseInt(formData.get('year') as string) : null;
  const registrationNo = formData.get('registrationNo') as string;
  const vehicleType = (formData.get('vehicleType') as string) || 'two_wheeler';
  const engineNo = (formData.get('engineNo') as string) || null;
  const chassisNo = (formData.get('chassisNo') as string) || null;
  const color = (formData.get('color') as string) || null;
  const rcDocPath = (formData.get('rcDocPath') as string) || null;
  const insurancePath = (formData.get('insurancePath') as string) || null;
  const insuranceExpiryStr = formData.get('insuranceExpiry') as string | null;
  const insuranceExpiry = insuranceExpiryStr ? new Date(insuranceExpiryStr) : null;

  const vehicle = await prisma.vehicle.create({
    data: {
      tenantId,
      customerId,
      loanId,
      make,
      model,
      year,
      registrationNo,
      vehicleType,
      engineNo,
      chassisNo,
      color,
      rcDocPath,
      insurancePath,
      insuranceExpiry,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user?.id,
      action: 'create',
      entityType: 'vehicle',
      entityId: vehicle.id,
      newValue: JSON.stringify({ registrationNo, make, model }),
    },
  });

  revalidatePath('/vehicles');
  redirect(`/vehicles/${vehicle.id}`);
}

export async function updateVehicle(formData: FormData) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  const vehicleId = formData.get('vehicleId') as string;

  // Security: verify vehicle belongs to this tenant
  const existing = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } });
  if (!existing) return { error: 'Vehicle not found or not in your tenant' };

  const make = formData.get('make') as string;
  const model = formData.get('model') as string;
  const year = formData.get('year') ? parseInt(formData.get('year') as string) : null;
  const vehicleType = (formData.get('vehicleType') as string) || 'two_wheeler';
  const engineNo = (formData.get('engineNo') as string) || null;
  const chassisNo = (formData.get('chassisNo') as string) || null;
  const color = (formData.get('color') as string) || null;
  const rcDocPath = (formData.get('rcDocPath') as string) || null;
  const insurancePath = (formData.get('insurancePath') as string) || null;
  const insuranceExpiryStr = formData.get('insuranceExpiry') as string | null;
  const insuranceExpiry = insuranceExpiryStr ? new Date(insuranceExpiryStr) : null;
  const loanId = (formData.get('loanId') as string) || null;

  await prisma.vehicle.update({
    where: { id: vehicleId, tenantId },
    data: { make, model, year, vehicleType, engineNo, chassisNo, color, rcDocPath, insurancePath, insuranceExpiry, loanId },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user?.id,
      action: 'update',
      entityType: 'vehicle',
      entityId: vehicleId,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath('/vehicles');
}

export async function flagForRepo(vehicleId: string, reason: string) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  const userId = session.user?.id as string;

  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } });
  if (!vehicle) throw new Error('Vehicle not found or not in your tenant');

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      repoFlag: true,
      repoFlaggedAt: new Date(),
      repoFlaggedById: userId,
    },
  });

  await prisma.systemNotification.create({
    data: {
      tenantId,
      appType: 'autofinance',
      type: 'danger',
      icon: 'directions_car',
      title: 'Repo Flag Set',
      message: `Vehicle ${vehicle.registrationNo} flagged for repossession. Reason: ${reason}`,
      link: `/vehicles/${vehicleId}`,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'flag_repo',
      entityType: 'vehicle',
      entityId: vehicleId,
      newValue: JSON.stringify({ reason }),
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath('/vehicles');
}

export async function clearRepoFlag(vehicleId: string) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      repoFlag: false,
      repoFlaggedAt: null,
      repoFlaggedById: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user?.id,
      action: 'clear_repo_flag',
      entityType: 'vehicle',
      entityId: vehicleId,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath('/vehicles');
}
