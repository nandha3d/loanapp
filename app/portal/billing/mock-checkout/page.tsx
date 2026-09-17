import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { calculateVerticalSubscriptionPricing } from '@/lib/pricing';
import { normalizeEnabledModules } from '@/lib/subscription';
import { revalidatePath } from 'next/cache';

export default async function MockRazorpayCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ subscription?: string; plan?: string }>;
}) {
  const { subscription, plan: requestedPlan } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const sessionUser = session.user as { role?: string; tenantId?: string | null };
  const role = sessionUser.role;
  const tenantId = role === 'developer'
    ? await getDefaultTenantId()
    : (sessionUser.tenantId || await getDefaultTenantId());

  const current = tenantId ? await prisma.tenantSubscription.findUnique({ where: { tenantId } }) : null;

  // Determine target plan: either explicit param, or last part of subscription, or default to business
  const catalogPlans = await prisma.subscriptionPlanCatalog.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  let targetPlanKey = requestedPlan;
  if (!targetPlanKey && subscription) {
    const matched = catalogPlans.find((p) => subscription.includes(p.plan));
    if (matched) targetPlanKey = matched.plan;
  }
  if (!targetPlanKey) {
    targetPlanKey = 'business';
  }

  const targetCatalog = catalogPlans.find((p) => p.plan === targetPlanKey) || catalogPlans[0];

  async function activateSimulatedSubscription() {
    'use server';
    const s = await auth();
    if (!s?.user) redirect('/login');
    const u = s.user as { role?: string; tenantId?: string | null };
    const tId = u.role === 'developer'
      ? await getDefaultTenantId()
      : (u.tenantId || await getDefaultTenantId());
    if (!tId) redirect('/portal/billing');

    const cur = await prisma.tenantSubscription.findUnique({ where: { tenantId: tId } });
    if (!cur) redirect('/portal/billing');

    const enabledModules = normalizeEnabledModules(cur.enabledModules);
    const pricing = calculateVerticalSubscriptionPricing(
      targetCatalog.monthlyPrice,
      enabledModules,
      cur.addonsPrice,
    );

    const oneMonthLater = new Date();
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    await prisma.tenantSubscription.update({
      where: { tenantId: tId },
      data: {
        plan: targetCatalog.plan,
        status: 'active',
        maxBranches: targetCatalog.maxBranches,
        maxActiveLoans: targetCatalog.maxActiveLoans,
        maxAgents: targetCatalog.maxAgents,
        currentPeriodEnd: oneMonthLater,
        trialEndsAt: null,
        basePlanPrice: pricing.basePlanPrice,
        modulesPrice: pricing.modulesPrice,
        addonsPrice: pricing.addonsPrice,
        totalMonthlyPrice: pricing.totalMonthlyPrice,
      },
    });

    if (targetCatalog.monthlyPrice > 0) {
      await prisma.billingInvoice.create({
        data: {
          tenantId: tId,
          subscriptionId: cur.id,
          amount: pricing.totalMonthlyPrice,
          tax: 0,
          total: pricing.totalMonthlyPrice,
          status: 'paid',
          dueDate: oneMonthLater,
          paidAt: new Date(),
          billingPeriod: `${new Date().toLocaleDateString()} - ${oneMonthLater.toLocaleDateString()}`,
        },
      });
    }

    revalidatePath('/portal/billing');
    revalidatePath('/[module]/subscription', 'page');
    revalidatePath('/[module]/settings', 'page');

    redirect('/portal/billing');
  }

  return (
    <main style={{ maxWidth: 560, margin: '48px auto', padding: 24, background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontWeight: 800, fontSize: '1.2rem' }}>
          R
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Razorpay Mock Checkout</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Simulated recurring mandate payment pipeline</p>
        </div>
      </div>

      <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#64748b' }}>Plan:</span>
          <strong>{targetCatalog?.displayName} Plan (₹{targetCatalog?.monthlyPrice}/mo)</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#64748b' }}>Branches Limit:</span>
          <strong style={{ color: '#16a34a' }}>{targetCatalog?.maxBranches >= 999 ? 'Unlimited' : targetCatalog?.maxBranches} Branches</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#64748b' }}>Active Loans Limit:</span>
          <strong>{targetCatalog?.maxActiveLoans >= 999999 ? 'Unlimited' : targetCatalog?.maxActiveLoans.toLocaleString()} Loans</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>Subscription ID:</span>
          <code>{subscription || 'mock_sub'}</code>
        </div>
      </div>

      <form action={activateSimulatedSubscription} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="submit" className="btn btn-primary" style={{ padding: '12px', fontSize: '1rem', fontWeight: 700 }}>
          Simulate Successful Payment & Activate Plan
        </button>
        <a className="btn btn-secondary" href="/portal/billing" style={{ textAlign: 'center', padding: '10px' }}>
          Cancel & Return to Billing
        </a>
      </form>
    </main>
  );
}
