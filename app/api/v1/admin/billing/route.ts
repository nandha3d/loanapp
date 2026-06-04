import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    if (ctx.role === 'developer') {
      const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: 'asc' },
        include: { subscription: true },
      });
      return ok({ role: 'developer', tenants });
    }

    // Otherwise, return scoped subscription and invoices
    const subscription = await prisma.tenantSubscription.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    const invoices = await prisma.billingInvoice.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return ok({ role: ctx.role, subscription, invoices });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role !== 'developer') {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { updateSubscription } = await import('@/app/admin/billing/billingActions');

    const formData = new FormData();
    formData.append('tenantId', body.tenantId || ctx.tenantId);
    formData.append('plan', body.plan);
    formData.append('status', body.status || 'active');
    formData.append('maxActiveLoans', String(body.maxActiveLoans ?? 100));
    formData.append('maxAgents', String(body.maxAgents ?? 5));
    formData.append('maxBranches', String(body.maxBranches ?? 3));
    if (body.enabledModules && Array.isArray(body.enabledModules)) {
      body.enabledModules.forEach((m: string) => formData.append('enabledModules', m));
    }
    formData.append('whatsappSmsEnabled', String(body.whatsappSmsEnabled === true));
    formData.append('receiptPdfAllowed', String(body.receiptPdfAllowed === true));
    formData.append('bureauEnabled', String(body.bureauEnabled === true));
    formData.append('npaEnabled', String(body.npaEnabled === true));
    formData.append('kycEnabled', String(body.kycEnabled === true));
    formData.append('gpsTrackingEnabled', String(body.gpsTrackingEnabled === true));
    formData.append('premiumAccountingEnabled', String(body.premiumAccountingEnabled === true));
    formData.append('bureauPullsIncluded', String(body.bureauPullsIncluded ?? 0));
    if (body.trialEndsAt) formData.append('trialEndsAt', body.trialEndsAt);
    if (body.currentPeriodEnd) formData.append('currentPeriodEnd', body.currentPeriodEnd);
    if (body.razorpaySubId) formData.append('razorpaySubId', body.razorpaySubId);

    const res = await updateSubscription(formData);
    if (res.success) {
      return ok(res);
    } else {
      return fail(res.error || 'Failed to update subscription', 400);
    }
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
