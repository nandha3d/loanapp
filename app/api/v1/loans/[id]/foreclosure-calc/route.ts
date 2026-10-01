import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { calculateForeclosure } from '@/lib/foreclosure';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { getSetting } from '@/lib/tenant';
import { AGENT_PRECLOSE_FLAG } from '@/lib/loanPreclosePolicy';

/**
 * DEC-01: the one preclose quote both clients render (payoff, penalty due,
 * discount) — the same calculation `POST .../preclose` enforces.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  if (ctx.role === 'agent') {
    // Agents only quote for a preclose request (D6).
    if (await getSetting(ctx.tenantId, AGENT_PRECLOSE_FLAG, '0') !== '1') return fail('Forbidden', 403);
  } else {
    const sub = await prisma.tenantSubscription.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { foreclosureEnabled: true },
    });
    if (!sub?.foreclosureEnabled) {
      return fail('Preclose & Early Settlement add-on is not active under your plan subscription.', 403);
    }
  }

  const raw = Number(new URL(req.url).searchParams.get('discount') || '0');
  // Agents never discount; the server ignores it for them.
  const discount = ctx.role === 'agent' || !Number.isFinite(raw) ? 0 : Math.max(0, raw);
  const access = {
    appType: ctx.appType,
    ...(ctx.role === 'agent'
      ? { customer: buildAgentCustomerAccessWhere({ userId: ctx.userId }) }
      : scopedBranchWhere(ctx)),
  };

  try {
    return ok(await calculateForeclosure(id, ctx.tenantId, discount, access));
  } catch (error: any) {
    const message = error?.message || 'Foreclosure calculation failed';
    return fail(message, message === 'Loan not found' ? 404 : 500);
  }
}
