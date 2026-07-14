import { getSetting } from '@/lib/tenant';
import { getWebChitScope, canCollectChits } from '@/lib/chits/access';
import PaymentIntentsQueue from '@/components/chits/PaymentIntentsQueue';

// Tenant-wide "I've paid" inbox — the client runs 40+ chit groups, so a
// single cross-group queue is essential; per-group panels (embedded in
// ChitGroupDetailClient) exist for working a specific group in context.
export default async function ChitPaymentsPage() {
  const scope = await getWebChitScope();
  if (!canCollectChits(scope.role)) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>You don't have permission to review chit payments.</p>
      </div>
    );
  }
  const currencySymbol = await getSetting(scope.tenantId, 'currency_symbol', '₹');

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '4px' }}>Payment proofs</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '18px' }}>
        Review and approve customer-submitted "I've paid" claims across all chit groups.
      </p>
      <PaymentIntentsQueue currencySymbol={currencySymbol} />
    </div>
  );
}
