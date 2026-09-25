import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { resolveActor } from '@/lib/api/dualAuth';
import { ok, fail } from '@/lib/api/v1-envelope';
import { getReportsForAppType } from '@/lib/reports/catalog';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import type { AppType } from '@/lib/appConfig';

export async function GET(req: NextRequest) {
  try {
    const context = await resolveActor(req);
    if (!context) return fail('Unauthorized', 401);
    if (context.role === 'agent') return fail('Forbidden', 403);

    const { searchParams } = new URL(req.url);
    const requestedAppType = searchParams.get('appType');
    if (requestedAppType && requestedAppType !== context.appType) return fail('Report not found', 404);
    const effectiveAppType = context.appType;
    const { tenantId, branchId } = context;
    const premiumAccountingEnabled = await isPremiumAccountingEnabled(tenantId);
    const reports = getReportsForAppType(effectiveAppType as AppType, { premiumAccountingEnabled: true })
      .map(({ slug, name, category, addon }) => ({
        slug,
        name,
        category,
        addon,
        locked: addon === 'premium_accounting' && !premiumAccountingEnabled,
      }));

    const [branches, agents, loans, payments, chitGroups, customers] = await Promise.all([
      prisma.branch.findMany({
        where: { tenantId, ...(branchId ? { id: branchId } : {}) },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { tenantId, appType: effectiveAppType, role: 'agent', status: 'active', ...(branchId ? { branchId } : {}) },
        select: { id: true, name: true },
      }),
      prisma.loan.findMany({
        where: { tenantId, appType: effectiveAppType, ...(branchId ? { branchId } : {}) },
        select: { loanType: true, status: true, frequency: true },
      }),
      prisma.payment.findMany({
        where: { tenantId, loan: { appType: effectiveAppType, ...(branchId ? { branchId } : {}) } },
        select: { paymentMode: true },
      }),
      effectiveAppType === 'chitfunds'
        ? prisma.chitGroup.findMany({
            where: { tenantId, appType: effectiveAppType, deletedAt: null, ...(branchId ? { branchId } : {}) },
            select: { id: true, name: true, groupCode: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
      prisma.customer.findMany({
        where: { tenantId, appType: effectiveAppType, status: 'active', ...(branchId ? { branchId } : {}) },
        select: { id: true, name: true, customerCode: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
    ]);

    const loanTypes = Array.from(new Set(loans.map(l => l.loanType).filter(Boolean)));
    const statuses = Array.from(new Set(loans.map(l => l.status).filter(Boolean)));
    const frequencies = Array.from(new Set(loans.map(l => l.frequency).filter(Boolean)));
    const paymentModes = Array.from(new Set(payments.map(p => p.paymentMode).filter(Boolean)));

    return ok({
      reports,
      branches,
      agents,
      loanTypes,
      statuses,
      frequencies,
      paymentModes,
      chitGroups: chitGroups.map((g) => ({ id: g.id, name: g.groupCode ? `${g.name} (${g.groupCode})` : g.name })),
      customers: customers.map((c) => ({ id: c.id, name: `${c.name} (${c.customerCode})` })),
    });
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
