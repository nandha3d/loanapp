'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { requireModule } from '@/lib/moduleGate';
import { modulePath } from '@/types/modules';

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || role === 'agent') redirect(modulePath(await getUserAppType(), '/collection'));
  return session;
}

import { z } from 'zod';

const vehicleSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  loanId: z.string().optional().nullable(),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  registrationNo: z.string().min(1, 'Registration Number is required'),
  vehicleType: z.string().default('two_wheeler'),
  engineNo: z.string().optional().nullable(),
  chassisNo: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  rcDocPath: z.string().optional().nullable(),
  insurancePath: z.string().optional().nullable(),
  insuranceExpiry: z.string().optional().nullable(),
});

export async function createVehicle(formData: FormData) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'autofinance');

  const rawData = Object.fromEntries(formData.entries());
  
  // Convert empty strings to null for optional fields to avoid validation/DB errors
  for (const key of Object.keys(rawData)) {
    if (rawData[key] === '') rawData[key] = null as any;
  }

  const parsed = vehicleSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }
  const data = parsed.data;

  // Security: verify customer belongs to this tenant
  const customer = await prisma.customer.findFirst({ where: { id: data.customerId, tenantId } });
  if (!customer) throw new Error('Customer not found or not in your tenant');

  // Security: if loanId given, verify it belongs to this tenant's customer
  if (data.loanId) {
    const loan = await prisma.loan.findFirst({ where: { id: data.loanId, tenantId } });
    if (!loan) throw new Error('Loan not found or not in your tenant');
  }

  const insuranceExpiry = data.insuranceExpiry ? new Date(data.insuranceExpiry) : null;

  const vehicle = await prisma.vehicle.create({
    data: {
      tenantId,
      appType,
      customerId: data.customerId,
      loanId: data.loanId || null,
      make: data.make,
      model: data.model,
      year: data.year,
      registrationNo: data.registrationNo,
      vehicleType: data.vehicleType,
      engineNo: data.engineNo || null,
      chassisNo: data.chassisNo || null,
      color: data.color || null,
      rcDocPath: data.rcDocPath || null,
      insurancePath: data.insurancePath || null,
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
      newValue: JSON.stringify({ registrationNo: data.registrationNo, make: data.make, model: data.model }),
    },
  });

  revalidatePath(modulePath(appType, '/vehicles'));
  redirect(modulePath(appType, `/vehicles/${vehicle.id}`));
}

export async function updateVehicle(formData: FormData) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  await requireModule(tenantId, 'autofinance');
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
  const appType = await getUserAppType();
  await requireModule(tenantId, 'autofinance');
  const userId = session.user?.id as string;

  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } });
  if (!vehicle) throw new Error('Vehicle not found or not in your tenant');

  await prisma.vehicle.update({
    where: { id: vehicleId, tenantId },
    data: {
      repoFlag: true,
      repoFlaggedAt: new Date(),
      repoFlaggedById: userId,
    },
  });

  await prisma.systemNotification.create({
    data: {
      tenantId,
      appType,
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
  await requireModule(tenantId, 'autofinance');

  await prisma.vehicle.update({
    where: { id: vehicleId, tenantId },
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
