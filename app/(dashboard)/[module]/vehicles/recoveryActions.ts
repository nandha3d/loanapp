'use server';

import prisma from '@/lib/db';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { modulePath } from '@/types/modules';

/**
 * Vehicle recovery: seizure and release.
 *
 * Replaces the flat `Vehicle.repoFlag` toggle with an auditable episode
 * (`VehicleRecovery`) carrying the yard location, the seizing agent and the
 * itemised seizing charges. `repoFlag` is kept in sync so every existing
 * screen, report and mobile payload keeps working unchanged.
 */

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user) redirect('/login');
  if (role === 'agent') redirect(modulePath(await getUserAppType(), '/collection'));
  return session;
}

const seizeSchema = z.object({
  vehicleId: z.string().min(1),
  seizedAt: z.string().min(1, 'Date of seizure is required'),
  seizedById: z.string().optional().nullable(),
  seizedByName: z.string().optional().nullable(),
  yardLocation: z.string().min(1, 'Godown / yard location is required'),
  seizingCharges: z.coerce.number().min(0).default(0),
  remarks: z.string().optional().nullable(),
});

export async function seizeVehicle(formData: FormData) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'autofinance');
  const userId = session.user?.id as string;

  const raw = Object.fromEntries(formData.entries()) as Record<string, unknown>;
  for (const key of Object.keys(raw)) if (raw[key] === '') raw[key] = null;

  const parsed = seizeSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: data.vehicleId, tenantId, appType },
    select: { id: true, registrationNo: true, loanId: true },
  });
  if (!vehicle) return { error: 'Vehicle not found in your workspace' };
  if (!vehicle.loanId) return { error: 'This vehicle is not linked to a loan, so it cannot be seized.' };

  // Guard against double-seizing from two tabs.
  const openEpisode = await prisma.vehicleRecovery.findFirst({
    where: { vehicleId: vehicle.id, status: 'seized' },
    select: { id: true },
  });
  if (openEpisode) return { error: 'This vehicle is already recorded as seized.' };

  // The seizing agent, when given, must be a user in this tenant.
  if (data.seizedById) {
    const agent = await prisma.user.findFirst({
      where: { id: data.seizedById, tenantId },
      select: { id: true },
    });
    if (!agent) return { error: 'Selected agent not found in your workspace' };
  }

  const seizedAt = new Date(data.seizedAt);
  if (Number.isNaN(seizedAt.getTime())) return { error: 'Invalid seizure date' };

  await prisma.$transaction(async (tx) => {
    await tx.vehicleRecovery.create({
      data: {
        tenantId,
        vehicleId: vehicle.id,
        loanId: vehicle.loanId!,
        seizedAt,
        seizedById: data.seizedById || null,
        seizedByName: data.seizedByName || null,
        yardLocation: data.yardLocation,
        seizingCharges: data.seizingCharges,
        remarks: data.remarks || null,
        status: 'seized',
      },
    });

    // Keep the legacy flag consistent for existing screens and reports.
    await tx.vehicle.update({
      where: { id: vehicle.id },
      data: {
        repoFlag: true,
        repoFlaggedAt: seizedAt,
        repoFlaggedById: userId,
        status: 'seized',
      },
    });

    await tx.loan.update({
      where: { id: vehicle.loanId! },
      data: { status: 'seized' },
    });
  });

  await prisma.systemNotification.create({
    data: {
      tenantId,
      appType,
      type: 'danger',
      icon: 'car_crash',
      title: 'Vehicle seized',
      message: `${vehicle.registrationNo} was seized and moved to ${data.yardLocation}.`,
      link: modulePath(appType, `/vehicles/${vehicle.id}`),
    },
  }).catch(() => null);

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'seize',
      entityType: 'vehicle',
      entityId: vehicle.id,
      newValue: JSON.stringify({
        yardLocation: data.yardLocation,
        seizingCharges: data.seizingCharges,
        seizedAt: seizedAt.toISOString(),
      }),
    },
  });

  revalidatePath(modulePath(appType, `/vehicles/${vehicle.id}`));
  revalidatePath(modulePath(appType, '/vehicles'));
  revalidatePath(modulePath(appType, '/loans'));
  return { success: true };
}

const releaseSchema = z.object({
  recoveryId: z.string().min(1),
  releasedAt: z.string().optional().nullable(),
  /** Cash actually collected towards the seizing charges at release time. */
  chargesCollected: z.coerce.number().min(0).default(0),
  paymentMode: z.string().optional().nullable(),
  releaseRemarks: z.string().optional().nullable(),
});

export async function releaseVehicle(formData: FormData) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'autofinance');
  const userId = session.user?.id as string;

  const raw = Object.fromEntries(formData.entries()) as Record<string, unknown>;
  for (const key of Object.keys(raw)) if (raw[key] === '') raw[key] = null;

  const parsed = releaseSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const recovery = await prisma.vehicleRecovery.findFirst({
    where: { id: data.recoveryId, tenantId, status: 'seized' },
    include: {
      vehicle: { select: { id: true, registrationNo: true, appType: true } },
      loan: { select: { id: true, loanCode: true, status: true } },
    },
  });
  if (!recovery) return { error: 'No open seizure found for this vehicle' };
  if (recovery.vehicle.appType !== appType) return { error: 'Vehicle belongs to a different module' };

  const releasedAt = data.releasedAt ? new Date(data.releasedAt) : new Date();
  if (Number.isNaN(releasedAt.getTime())) return { error: 'Invalid release date' };

  const collected = data.chargesCollected;

  await prisma.$transaction(async (tx) => {
    let paymentId: string | null = null;

    // Seizing charges recovered at release are money in, so they are booked as
    // a payment against the loan — tagged `charges` so they never look like an
    // EMI receipt in collection reporting.
    if (collected > 0) {
      const payment = await tx.payment.create({
        data: {
          tenantId,
          loanId: recovery.loanId,
          amount: collected,
          paymentMode: data.paymentMode || 'cash',
          paymentDate: releasedAt,
          paymentType: 'charges',
          referenceNumber: `SEIZE-${recovery.id.slice(-8).toUpperCase()}`,
        },
      });
      paymentId = payment.id;
    }

    await tx.vehicleRecovery.update({
      where: { id: recovery.id },
      data: {
        status: 'released',
        releasedAt,
        releasedById: userId,
        releasePaymentId: paymentId,
        releaseRemarks: data.releaseRemarks || null,
      },
    });

    await tx.vehicle.update({
      where: { id: recovery.vehicle.id },
      data: {
        repoFlag: false,
        repoFlaggedAt: null,
        repoFlaggedById: null,
        status: 'active',
      },
    });

    // Only revive the loan if the seizure is what closed it.
    if (recovery.loan.status === 'seized') {
      await tx.loan.update({ where: { id: recovery.loanId }, data: { status: 'active' } });
    }
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'release',
      entityType: 'vehicle',
      entityId: recovery.vehicle.id,
      newValue: JSON.stringify({
        recoveryId: recovery.id,
        chargesCollected: collected,
        releasedAt: releasedAt.toISOString(),
      }),
    },
  });

  revalidatePath(modulePath(appType, `/vehicles/${recovery.vehicle.id}`));
  revalidatePath(modulePath(appType, '/vehicles'));
  revalidatePath(modulePath(appType, `/loans/${recovery.loan.loanCode}`));
  return { success: true };
}
