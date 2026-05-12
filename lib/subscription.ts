import prisma from '@/lib/db';

export async function checkLimit(tenantId: string, resource: 'loans' | 'agents') {
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  // If no subscription record exists, apply permissive defaults
  if (!sub) return;
  if (sub.status !== 'active') {
    throw new Error('Your subscription is inactive. Please contact the administrator.');
  }

  if (resource === 'loans') {
    const count = await prisma.loan.count({ where: { tenantId, status: 'active' } });
    if (count >= sub.maxActiveLoans) {
      throw new Error(`Active loan limit reached (${sub.maxActiveLoans}). Upgrade your plan to create more loans.`);
    }
  }

  if (resource === 'agents') {
    const count = await prisma.user.count({ where: { tenantId, role: 'agent', status: 'active' } });
    if (count >= sub.maxAgents) {
      throw new Error(`Agent limit reached (${sub.maxAgents}). Upgrade your plan to add more agents.`);
    }
  }
}

export async function getSubscription(tenantId: string) {
  return prisma.tenantSubscription.findUnique({ where: { tenantId } });
}

export async function upsertSubscription(tenantId: string, data: {
  plan: string;
  status: string;
  maxActiveLoans: number;
  maxAgents: number;
  enabledModules: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  razorpaySubId?: string | null;
}) {
  return prisma.tenantSubscription.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
  });
}
