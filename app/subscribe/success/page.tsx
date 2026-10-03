import Link from 'next/link';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getDictionary, getDictionarySync } from '@/lib/i18n';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { modulePath } from '@/types/modules';
import { formatDate } from '@/lib/utils';
import { normalizeBillingCycle } from '@/lib/razorpay';
import { PLAN_FEATURES, parseFeatureKeys } from '@/lib/planFeatures';

export const dynamic = 'force-dynamic';

/**
 * Where Razorpay Checkout returns after a successful subscription payment
 * (see app/subscribe/page.tsx). Everything shown is read on the server: the plan,
 * cycle, price and renewal date come from the catalog / subscription row.
 *
 * Public on purpose: a brand-new tenant lands here straight after registering,
 * before having a session. Signed-in users see their own subscription; anonymous
 * visitors only see the plan named by the (unguessable) Razorpay subscription id.
 */
export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>;
}) {
  const { sub: subParam } = await searchParams;
  const session = await auth();
  const user = session?.user as { role?: string; tenantId?: string | null } | undefined;

  let tenantId: string | null = null;
  if (user) {
    tenantId = user.role === 'developer'
      ? await getDefaultTenantId()
      : (user.tenantId || await getDefaultTenantId());
  }

  const subscription = tenantId
    ? await prisma.tenantSubscription.findUnique({ where: { tenantId } })
    : /^sub_[A-Za-z0-9]{6,40}$/.test(subParam ?? '')
      ? await prisma.tenantSubscription.findFirst({ where: { razorpaySubId: subParam } })
      : null;

  const catalog = subscription
    ? await prisma.subscriptionPlanCatalog.findFirst({ where: { plan: subscription.plan } })
    : null;

  const dict = tenantId ? await getDictionary(tenantId) : getDictionarySync('en');
  const d = dict.subscription || {};

  const cycle = normalizeBillingCycle(subscription?.billingCycle);
  const planName = catalog?.displayName ?? null;
  const amount = catalog
    ? (cycle === 'yearly' ? catalog.yearlyPrice : catalog.monthlyPrice)
    : null;
  const activated = Boolean(subscription && subscription.status === 'active' && subscription.plan !== 'free');
  const renewsOn = activated && subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null;
  const unlocked = PLAN_FEATURES.filter((f) => parseFeatureKeys(catalog?.includedFeatures).includes(f.key));

  const signedIn = Boolean(user);
  const subscriptionHref = !signedIn
    ? '/login'
    : user?.role === 'superadmin'
      ? modulePath(await getUserAppType(), '/subscription')
      : '/portal/billing';

  const summary: Array<[string, string]> = [];
  if (planName) summary.push([d.subscribePlanLabel || 'Plan', planName]);
  if (planName) summary.push([d.subscribeBillingLabel || 'Billing', cycle === 'yearly' ? (d.billingYearly || 'Yearly') : (d.billingMonthly || 'Monthly')]);
  if (amount) {
    summary.push([
      d.subscribeAmountLabel || 'Amount',
      `₹${amount.toLocaleString('en-IN')}${cycle === 'yearly' ? (d.perYear || '/yr') : (d.perMonth || '/mo')}`,
    ]);
  }
  if (renewsOn) summary.push([d.subscribeRenewsLabel || 'Next renewal', renewsOn]);

  return (
    <main className="sub-success">
      <style>{`
        .sub-success { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px 16px; background: var(--bg, #f8fafc); }
        .sub-success-card { width: 100%; max-width: 520px; background: var(--card-bg, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 20px; padding: 40px 32px 32px; text-align: center; box-shadow: 0 20px 45px -20px rgba(15, 23, 42, .25); }
        .sub-success-badge { width: 84px; height: 84px; margin: 0 auto 22px; border-radius: 50%; background: rgba(22, 163, 74, .1); display: flex; align-items: center; justify-content: center; position: relative; }
        .sub-success-badge::after { content: ''; position: absolute; inset: -8px; border-radius: 50%; border: 2px solid rgba(22, 163, 74, .25); animation: sub-ring 1.8s ease-out infinite; }
        .sub-success-badge svg circle { stroke-dasharray: 166; stroke-dashoffset: 166; animation: sub-draw .7s ease-out .1s forwards; }
        .sub-success-badge svg path { stroke-dasharray: 48; stroke-dashoffset: 48; animation: sub-draw .45s ease-out .65s forwards; }
        @keyframes sub-draw { to { stroke-dashoffset: 0; } }
        @keyframes sub-ring { 0% { transform: scale(.9); opacity: .9; } 100% { transform: scale(1.25); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .sub-success-badge::after { animation: none; }
          .sub-success-badge svg circle, .sub-success-badge svg path { animation: none; stroke-dashoffset: 0; }
        }
        .sub-success-title { font-size: 1.6rem; font-weight: 800; margin: 0 0 8px; color: var(--text-primary, #0f172a); }
        .sub-success-sub { margin: 0 0 24px; color: var(--text-secondary, #475569); font-size: .98rem; line-height: 1.5; }
        .sub-success-summary { text-align: left; border: 1px solid var(--border, #e2e8f0); border-radius: 14px; padding: 4px 18px; margin-bottom: 22px; background: var(--bg, #f8fafc); }
        .sub-success-row { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; font-size: .92rem; border-bottom: 1px solid var(--border, #e2e8f0); }
        .sub-success-row:last-child { border-bottom: none; }
        .sub-success-row span { color: var(--text-light, #64748b); }
        .sub-success-row strong { color: var(--text-primary, #0f172a); text-align: right; }
        .sub-success-unlocked { text-align: left; margin-bottom: 26px; }
        .sub-success-unlocked h2 { font-size: .76rem; letter-spacing: .6px; text-transform: uppercase; color: var(--text-light, #64748b); margin: 0 0 10px; }
        .sub-success-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .sub-success-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: .82rem; font-weight: 600; color: #166534; background: rgba(22, 163, 74, .1); }
        .sub-success-actions { display: flex; flex-direction: column; gap: 10px; }
        .sub-success-actions a { display: block; padding: 13px 18px; border-radius: 12px; font-weight: 700; font-size: .95rem; text-decoration: none; text-align: center; }
        .sub-success-note { margin: 0 0 18px; padding: 10px 14px; border-radius: 10px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: .85rem; text-align: left; }
      `}</style>

      <section className="sub-success-card" aria-live="polite">
        <div className="sub-success-badge" aria-hidden="true">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="26" cy="26" r="25" strokeWidth="2.5" />
            <path d="M14 27l8 8 16-17" />
          </svg>
        </div>

        <h1 className="sub-success-title">{d.subscribeThanksTitle || 'Thank you for your purchase!'}</h1>
        <p className="sub-success-sub">
          {planName
            ? (d.subscribeThanksSubtitle || 'Your {plan} plan is now active.').replace('{plan}', planName)
            : (d.subscribeThanksGeneric || 'Your payment was successful.')}
        </p>

        {planName && !activated && (
          <p className="sub-success-note">
            {d.subscribeActivating || 'Your plan is being activated and can take a few moments to show up. Refresh My Subscription if it has not updated.'}
          </p>
        )}

        {summary.length > 0 && (
          <div className="sub-success-summary">
            {summary.map(([label, value]) => (
              <div className="sub-success-row" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        )}

        {unlocked.length > 0 && (
          <div className="sub-success-unlocked">
            <h2>{d.subscribeUnlockedTitle || 'Now unlocked for you'}</h2>
            <div className="sub-success-chips">
              {unlocked.map((f) => (
                <span className="sub-success-chip" key={f.key}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                  {d[`featureName_${f.key}`] || f.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="sub-success-actions">
          <Link href={subscriptionHref} className="btn btn-primary">
            {signedIn ? (d.subscribeGoSubscription || 'Go to My Subscription') : (d.subscribeSignIn || 'Sign in to continue')}
          </Link>
          {signedIn && (
            <Link href="/portal" className="btn btn-secondary">
              {d.subscribeGoPortal || 'Go to Portal'}
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
