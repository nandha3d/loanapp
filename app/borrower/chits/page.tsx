import { redirect } from 'next/navigation';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getMyChitContributionsGrouped, getMyChitReceipts, type GroupedChitContributions } from '@/lib/chits/customerPortal';
import { buildMemberChitDividendStatement } from '@/lib/chits/memberDividendLedger';
import { getDictionary } from '@/lib/i18n';
import { getSetting } from '@/lib/tenant';
import { Collapse } from '@/components/ui/Collapse';
import PaymentProofButton from './PaymentProofButton';
import MemberDividendBreakdownCard from './MemberDividendBreakdownCard';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '14px',
  border: '1px solid #e2e8f0',
  padding: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const rowStyle: React.CSSProperties = {
  background: '#f8fafc',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  padding: '12px',
  marginBottom: '8px',
};

function statusBadge(status: string) {
  const bg = status === 'paid' ? '#dcfce7' : status === 'missed' ? '#fee2e2' : '#fef9c3';
  const fg = status === 'paid' ? '#166534' : status === 'missed' ? '#991b1b' : '#854d0e';
  return (
    <div style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: bg, color: fg, alignSelf: 'flex-start' }}>
      {status}
    </div>
  );
}

function PeriodRow({
  c,
  showProofButton,
  currencySymbol = '₹',
}: {
  c: GroupedChitContributions['current'];
  showProofButton?: boolean;
  currencySymbol?: string;
}) {
  if (!c) return null;
  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>Period {c.periodNumber}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Due {formatDate(c.dueDate)}</div>
        </div>
        {statusBadge(c.status)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginTop: '10px', fontSize: '0.82rem' }}>
        <div><span style={{ color: '#94a3b8' }}>Base: </span>{formatCurrency(c.baseDueAmount, currencySymbol)}</div>
        <div>
          <span style={{ color: '#94a3b8' }}>Dividend: </span>
          <span style={{ color: c.dividendForfeited ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
            {c.dividendForfeited ? 'Forfeited' : formatCurrency(c.dividendAmount, currencySymbol)}
          </span>
        </div>
        {c.deferredDividendAmount > 0 && (
          <div><span style={{ color: '#94a3b8' }}>Deferred: </span>{formatCurrency(c.deferredDividendAmount, currencySymbol)}</div>
        )}
        {c.premiumAmount > 0 && (
          <div><span style={{ color: '#94a3b8' }}>Premium: </span>{formatCurrency(c.premiumAmount, currencySymbol)}</div>
        )}
        {c.interestAmount > 0 && (
          <div><span style={{ color: '#94a3b8' }}>Interest: </span>{formatCurrency(c.interestAmount, currencySymbol)}</div>
        )}
        <div><span style={{ color: '#94a3b8' }}>Penalty: </span>{formatCurrency(c.penaltyAmount, currencySymbol)}</div>
        <div><span style={{ color: '#94a3b8' }}>Net Due: </span>{formatCurrency(c.netDue, currencySymbol)}</div>
        <div><span style={{ color: '#94a3b8' }}>Paid: </span>{formatCurrency(c.paidAmount, currencySymbol)}</div>
        <div style={{ fontWeight: 700 }}><span style={{ color: '#94a3b8', fontWeight: 400 }}>Outstanding: </span>{formatCurrency(c.outstanding, currencySymbol)}</div>
        {c.goldGramsCredited > 0 && (
          <div style={{ color: '#b45309', fontWeight: 600 }}><span style={{ color: '#94a3b8', fontWeight: 400 }}>Gold: </span>{c.goldGramsCredited.toFixed(4)} g</div>
        )}
      </div>
      {showProofButton && c.status !== 'paid' && c.outstanding > 0 && (
        <div style={{ marginTop: '10px' }}>
          <PaymentProofButton subscriptionId={c.subscriptionId} outstanding={c.outstanding} />
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, currencySymbol }: { group: GroupedChitContributions; currencySymbol: string }) {
  const allCaughtUp = !group.current && group.overdue.length === 0 && group.upcoming.length === 0;
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ fontWeight: 700, color: '#0f172a' }}>{group.groupName}</div>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {group.engineName} · {group.completedPeriodsCount}/{group.totalPeriods} done
        </span>
      </div>

      {group.current ? (
        <PeriodRow c={group.current} showProofButton currencySymbol={currencySymbol} />
      ) : allCaughtUp ? (
        <p style={{ color: '#166534', fontWeight: 600, fontSize: '0.85rem', margin: '4px 0 0' }}>You&apos;re all caught up.</p>
      ) : null}

      {group.overdue.length > 0 && (
        <Collapse summary="Overdue" badge={group.overdue.length} tone="danger">
          {group.overdue.map((c) => <PeriodRow key={c.subscriptionId} c={c} showProofButton currencySymbol={currencySymbol} />)}
        </Collapse>
      )}

      {group.upcoming.length > 0 && (
        <Collapse summary="Upcoming" badge={group.upcoming.length}>
          {group.upcoming.map((c) => <PeriodRow key={c.subscriptionId} c={c} currencySymbol={currencySymbol} />)}
        </Collapse>
      )}

      {group.history.length > 0 && (
        <Collapse summary="History" badge={group.history.length}>
          {group.history.map((c) => <PeriodRow key={c.subscriptionId} c={c} currencySymbol={currencySymbol} />)}
        </Collapse>
      )}
    </div>
  );
}

export default async function BorrowerChitsPage() {
  const session = await getBorrowerSession();
  if (!session) redirect('/borrower/login');

  const [groups, receipts, statements, dict, currencySymbol] = await Promise.all([
    getMyChitContributionsGrouped(session.customerId, session.tenantId),
    getMyChitReceipts(session.customerId, session.tenantId),
    buildMemberChitDividendStatement(session.customerId, session.tenantId),
    getDictionary(session.tenantId),
    getSetting(session.tenantId, 'currency_symbol', '₹'),
  ]);
  const dc = dict.chits || {};

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
        {dc.portalStatementsTitle || 'Chit Dividend Statements, Contributions & Receipts'}
      </h1>

      {statements.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
            {dc.memberDividendStatementTitle || 'Detailed Chit & Dividend Summary'}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {statements.map((stmt) => (
              <MemberDividendBreakdownCard
                key={stmt.groupId}
                statement={stmt}
                currencySymbol={currencySymbol}
                dict={dict}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>Contributions</h2>
        {groups.length === 0 ? (
          <div style={cardStyle}><p style={{ color: '#64748b', margin: 0 }}>No contributions yet.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {groups.map((g) => <GroupCard key={g.groupId} group={g} currencySymbol={currencySymbol} />)}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>Receipts</h2>
        {receipts.length === 0 ? (
          <div style={cardStyle}><p style={{ color: '#64748b', margin: 0 }}>No receipts yet.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {receipts.map((r) => (
              <div key={r.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.receiptNo}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {r.receiptType} · {r.paymentMode}{r.referenceNo ? ` · Ref ${r.referenceNo}` : ''} · {formatDate(r.issuedAt)}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(r.amount, currencySymbol)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
