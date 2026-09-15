'use server';

import prisma from '@/lib/db';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { modulePath } from '@/types/modules';

/** Brokers and dealers are master data — admins only. */
async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user) redirect('/login');
  if (role === 'agent') redirect(modulePath(await getUserAppType(), '/collection'));
  return session;
}

const partnerSchema = z.object({
  type: z.enum(['broker', 'dealer']),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  commissionRate: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function saveFinancePartner(formData: FormData) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'autofinance');

  const raw = Object.fromEntries(formData.entries()) as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (raw[key] === '') raw[key] = null;
  }

  const parsed = partnerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const partnerId = (formData.get('partnerId') as string) || null;

  try {
    if (partnerId) {
      // Security: only touch a row that belongs to this tenant.
      const existing = await prisma.financePartner.findFirst({
        where: { id: partnerId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) return { error: 'Partner not found in your workspace' };

      await prisma.financePartner.update({
        where: { id: partnerId },
        data: {
          type: data.type,
          name: data.name,
          phone: data.phone || null,
          address: data.address || null,
          commissionRate: data.commissionRate ?? null,
          notes: data.notes || null,
        },
      });
    } else {
      await prisma.financePartner.create({
        data: {
          tenantId,
          appType,
          branchId: (session.user as any)?.branchId ?? null,
          type: data.type,
          name: data.name,
          phone: data.phone || null,
          address: data.address || null,
          commissionRate: data.commissionRate ?? null,
          notes: data.notes || null,
        },
      });
    }
  } catch (e: any) {
    // The unique index is (tenant, appType, type, name).
    if (e?.code === 'P2002') {
      return { error: `A ${data.type} named "${data.name}" already exists.` };
    }
    throw e;
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user?.id,
      action: partnerId ? 'update' : 'create',
      entityType: 'finance_partner',
      entityId: partnerId ?? data.name,
      newValue: JSON.stringify({ type: data.type, name: data.name }),
    },
  });

  revalidatePath(modulePath(appType, '/finance-partners'));
  return { success: true };
}

export async function setFinancePartnerStatus(partnerId: string, status: 'active' | 'inactive') {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'autofinance');

  const existing = await prisma.financePartner.findFirst({
    where: { id: partnerId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return { error: 'Partner not found in your workspace' };

  await prisma.financePartner.update({ where: { id: partnerId }, data: { status } });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user?.id,
      action: 'update',
      entityType: 'finance_partner',
      entityId: partnerId,
      newValue: JSON.stringify({ status }),
    },
  });

  revalidatePath(modulePath(appType, '/finance-partners'));
  return { success: true };
}

export async function deleteFinancePartner(partnerId: string) {
  const session = await requireAdmin();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'autofinance');

  const existing = await prisma.financePartner.findFirst({
    where: { id: partnerId, tenantId, deletedAt: null },
    select: { id: true, _count: { select: { brokerLoans: true, dealerLoans: true } } },
  });
  if (!existing) return { error: 'Partner not found in your workspace' };

  // Loans keep pointing at the partner for history, so this is a soft delete.
  await prisma.financePartner.update({
    where: { id: partnerId },
    data: { deletedAt: new Date(), status: 'inactive' },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user?.id,
      action: 'delete',
      entityType: 'finance_partner',
      entityId: partnerId,
    },
  });

  revalidatePath(modulePath(appType, '/finance-partners'));
  return { success: true };
}
