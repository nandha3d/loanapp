import Link from 'next/link';
import { PLAN_LABELS } from '@/lib/plans';
import { getEffectiveTrialEndsAt, type TenantSubscriptionAccess } from '@/lib/subscription';
import { formatDate } from '@/lib/utils';

/**
 * Sticky banner for a SaaS tenant that is still inside its free trial. The
 * enclosing layout blocks expired trials before this component is rendered.
 */
export default function TrialBanner({ sub }: { sub: TenantSubscriptionAccess | null }) {
  if (!sub || sub.plan === 'lifetime' || sub.tenant?.customDomain) return null;

  const effectiveTrialEnd = getEffectiveTrialEndsAt(sub);
  if (!effectiveTrialEnd) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      flexWrap: 'wrap',
      background: 'linear-gradient(135deg,#b45309,#d97706)',
      color: '#fff', padding: '10px 16px', borderRadius: '10px', marginBottom: '16px',
      fontSize: '0.9rem', boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="material-icons-outlined" style={{ fontSize: '20px' }}>hourglass_bottom</span>
        <span>
          Free trial of <strong>{PLAN_LABELS[sub.plan] || sub.plan}</strong> ends on{' '}
          <strong>{formatDate(effectiveTrialEnd)}</strong>. Subscribe to keep access.
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
