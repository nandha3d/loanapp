import Link from 'next/link';
import { PLAN_LABELS } from '@/lib/plans';

const PAID = ['basic', 'business', 'enterprise'];

/**
 * Sticky banner shown to a paid-plan tenant that is still inside its free trial
 * (no active paid period yet). Counts down the days and links to checkout.
 * Renders nothing for free/lifetime plans or once a paid period is active.
 */
export default function TrialBanner({ sub }: { sub: any }) {
  if (!sub || !PAID.includes(sub.plan)) return null;

  const now = Date.now();
  const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : 0;
  if (periodEnd > now) return null; // already paid → not in trial

  const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt).getTime() : 0;
  if (!trialEnd || trialEnd <= now) return null; // not in trial (expiry handled by the modal)

  const daysLeft = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000));
  const urgent = daysLeft <= 3;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      flexWrap: 'wrap',
      background: urgent ? 'linear-gradient(135deg,#b91c1c,#dc2626)' : 'linear-gradient(135deg,#b45309,#d97706)',
      color: '#fff', padding: '10px 16px', borderRadius: '10px', marginBottom: '16px',
      fontSize: '0.9rem', boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="material-icons-outlined" style={{ fontSize: '20px' }}>hourglass_bottom</span>
        <span>
          Free trial of <strong>{PLAN_LABELS[sub.plan] || sub.plan}</strong> —{' '}
          <strong>{daysLeft} day{daysLeft === 1 ? '' : 's'} left</strong>. Subscribe to keep access.
        </span>
      </div>
      <Link href="/portal/billing" style={{
        background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)',
        padding: '6px 14px', borderRadius: '6px', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        Subscribe now
      </Link>
    </div>
  );
}
