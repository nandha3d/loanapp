import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { modulePath } from '@/types/modules';
import { formatDate } from '@/lib/utils';
import Link from '@/components/layout/DashboardLink';
import { getDayClosingGate } from '../operations/actions';

/**
 * Pending Task Manager — the operational punch list an Auto Finance office
 * works through: missing paperwork, missing GPS, accounts whose tenure has
 * run out with a balance, and customers who have gone quiet.
 */

type TabId = 'documents' | 'gps' | 'termination' | 'dormant';

/**
 * The four tabs select different entities (loans vs customers), so the row
 * shape is a union with the fields each renderer reads.
 */
type PendingRow = {
  id: string;
  // loan-backed tabs
  loanCode?: string;
  endDate?: Date | null;
  totalPayable?: unknown;
  totalCollected?: unknown;
  customer?: {
    name: string;
    customerCode: string;
    phone?: string;
    profilePhoto?: string | null;
    aadharNumber?: string | null;
  };
  vehicle?: { registrationNo: string; rcDocPath?: string | null } | null;
  payments?: Array<{ paymentDate: Date }>;
  // customer-backed tab
  name?: string;
  customerCode?: string;
  phone?: string;
  address?: string | null;
  route?: { name: string } | null;
};

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'documents', label: 'Missing Photos / RC / IDs', icon: 'photo_camera' },
  { id: 'gps', label: 'Missing GPS', icon: 'location_off' },
  { id: 'termination', label: 'Termination Accounts', icon: 'event_busy' },
  { id: 'dormant', label: 'Non-Transaction 6–12m', icon: 'hourglass_disabled' },
];

export default async function PendingTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  if ((session.user as { role?: string })?.role === 'agent') {
    redirect(modulePath(appType, '/collection'));
  }

  try {
    await requireModule(tenantId, 'autofinance');
  } catch {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--border)' }}>lock</span>
        <h3 style={{ margin: '16px 0 8px' }}>Module Not Enabled</h3>
        <Link href="/subscription" className="btn btn-primary">View Subscription</Link>
      </div>
    );
  }

  const params = await searchParams;
  const tab: TabId = (TABS.find((t) => t.id === params.tab)?.id ?? 'documents');
  const monthsIdle = Number(params.months) === 12 ? 12 : 6;

  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const gate = await getDayClosingGate().catch(() => ({ blocked: false, pendingDate: null, message: null }));

  const now = new Date();
  const idleCutoff = new Date(now);
  idleCutoff.setMonth(idleCutoff.getMonth() - monthsIdle);

  const activeLoanWhere = { tenantId, appType, deletedAt: null, status: { in: ['active', 'overdue'] } };

  // Counts drive the tab badges; each is cheap and independent.
  const [docCount, gpsCount, terminationCount, dormantCount] = await Promise.all([
    prisma.loan.count({
      where: {
        ...activeLoanWhere,
        OR: [
          { vehicle: null },
          { vehicle: { rcDocPath: null } },
          { customer: { profilePhoto: null } },
          { customer: { aadharNumber: null } },
        ],
      },
    }).catch(() => 0),
    prisma.customer.count({
      where: { tenantId, appType, deletedAt: null, status: 'active', loans: { some: activeLoanWhere }, lat: null },
    }).catch(() => 0),
    prisma.loan.count({
      where: { ...activeLoanWhere, endDate: { lt: now } },
    }).catch(() => 0),
    prisma.loan.count({
      where: { ...activeLoanWhere, payments: { none: { paymentDate: { gte: idleCutoff } } } },
    }).catch(() => 0),
  ]);

  const counts: Record<TabId, number> = {
    documents: docCount,
    gps: gpsCount,
    termination: terminationCount,
    dormant: dormantCount,
  };

  const money = (n: unknown) => `${currencySymbol}${Math.round(Number(n)).toLocaleString('en-IN')}`;

  // Only the selected tab's rows are fetched.
  let rows: PendingRow[] = [];
  if (tab === 'documents') {
    rows = await prisma.loan.findMany({
      where: {
        ...activeLoanWhere,
        OR: [
          { vehicle: null },
          { vehicle: { rcDocPath: null } },
          { customer: { profilePhoto: null } },
          { customer: { aadharNumber: null } },
        ],
      },
      select: {
        id: true, loanCode: true,
        customer: { select: { name: true, customerCode: true, profilePhoto: true, aadharNumber: true } },
        vehicle: { select: { registrationNo: true, rcDocPath: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }).catch(() => []);
  } else if (tab === 'gps') {
    rows = await prisma.customer.findMany({
      where: { tenantId, appType, deletedAt: null, status: 'active', loans: { some: activeLoanWhere }, lat: null },
      select: {
        id: true, name: true, customerCode: true, phone: true, address: true,
        route: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
      take: 300,
    }).catch(() => []);
  } else if (tab === 'termination') {
    rows = await prisma.loan.findMany({
      where: { ...activeLoanWhere, endDate: { lt: now } },
      select: {
        id: true, loanCode: true, endDate: true, totalPayable: true, totalCollected: true,
        customer: { select: { name: true, customerCode: true, phone: true } },
        vehicle: { select: { registrationNo: true } },
      },
      orderBy: { endDate: 'asc' },
      take: 300,
    }).catch(() => []);
  } else {
    rows = await prisma.loan.findMany({
      where: { ...activeLoanWhere, payments: { none: { paymentDate: { gte: idleCutoff } } } },
      select: {
        id: true, loanCode: true, totalPayable: true, totalCollected: true,
        customer: { select: { name: true, customerCode: true, phone: true } },
        vehicle: { select: { registrationNo: true } },
        payments: { orderBy: { paymentDate: 'desc' }, take: 1, select: { paymentDate: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 300,
    }).catch(() => []);
  }

  const qs = (next: Partial<{ tab: TabId; months: number }>) => {
    const sp = new URLSearchParams();
    sp.set('tab', next.tab ?? tab);
    sp.set('months', String(next.months ?? monthsIdle));
    return `/pending-tasks?${sp.toString()}`;
  };

  return (
    <div>
      {gate.blocked && (
        <div className="card" style={{ background: 'var(--danger-bg, #fee2e2)', border: '1px solid var(--danger)', marginBottom: '16px', padding: '14px 18px' }}>
          <strong style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>lock_clock</span>
            {gate.message}
          </strong>
          <p style={{ margin: '6px 0 0', fontSize: '.82rem' }}>
            Close the day from the dashboard before working today&apos;s list.
          </p>
        </div>
      )}

      <div className="kpi-grid" style={{ marginBottom: '20px' }}>
        {TABS.map((t) => (
          <Link key={t.id} href={qs({ tab: t.id })} className="kpi-card" style={{ textDecoration: 'none' }}>
            <div className={`kpi-icon ${t.id === tab ? 'blue' : 'orange'}`}>
              <span className="material-icons-outlined">{t.icon}</span>
            </div>
            <div>
              <div className="kpi-value">{counts[t.id]}</div>
              <div className="kpi-label">{t.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <h3>📋 {TABS.find((t) => t.id === tab)!.label}</h3>
          {tab === 'dormant' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              {[6, 12].map((m) => (
                <Link key={m} href={qs({ months: m })}
                  className={`btn btn-sm ${monthsIdle === m ? 'btn-primary' : 'btn-secondary'}`}>
                  {m} months
                </Link>
              ))}
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">
            <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>task_alt</span>
            <p>Nothing pending here. </p>
          </div>
        ) : (
          <div className="table-wrapper">
            {tab === 'documents' && (
              <table>
                <thead><tr><th>Loan</th><th>Customer</th><th>Vehicle</th><th>Missing</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const missing = [
                      !r.vehicle && 'Vehicle record',
                      r.vehicle && !r.vehicle.rcDocPath && 'RC book',
                      !r.customer?.profilePhoto && 'Customer photo',
                      !r.customer?.aadharNumber && 'Aadhaar',
                    ].filter(Boolean) as string[];
                    return (
                      <tr key={r.id}>
                        <td><Link href={`/loans/${r.loanCode}`}>{r.loanCode}</Link></td>
                        <td>{r.customer?.name}<br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{r.customer?.customerCode}</span></td>
                        <td>{r.vehicle?.registrationNo ?? '—'}</td>
                        <td>{missing.map((m) => <span key={m} className="badge badge-warning" style={{ marginRight: '4px' }}>{m}</span>)}</td>
                        <td><Link href={`/loans/${r.loanCode}`} className="btn btn-ghost btn-sm">Open</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {tab === 'gps' && (
              <table>
                <thead><tr><th>Customer</th><th>Phone</th><th>Route</th><th>Address</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/customers/${r.customerCode}`}>{r.name}</Link></td>
                      <td>{r.phone}</td>
                      <td>{r.route?.name ?? '—'}</td>
                      <td style={{ maxWidth: '280px' }}>{r.address ?? '—'}</td>
                      <td><Link href={`/customers/${r.customerCode}`} className="btn btn-ghost btn-sm">Tag GPS</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'termination' && (
              <table>
                <thead><tr><th>Loan</th><th>Customer</th><th>Vehicle</th><th>Tenure Ended</th><th style={{ textAlign: 'right' }}>Balance</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ background: 'var(--danger-bg, #fee2e2)' }}>
                      <td><Link href={`/loans/${r.loanCode}`}>{r.loanCode}</Link></td>
                      <td>{r.customer?.name}<br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{r.customer?.phone}</span></td>
                      <td>{r.vehicle?.registrationNo ?? '—'}</td>
                      <td>{formatDate(r.endDate ?? null)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(Number(r.totalPayable) - Number(r.totalCollected))}</td>
                      <td><Link href={`/loans/${r.loanCode}`} className="btn btn-ghost btn-sm">Settle</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'dormant' && (
              <table>
                <thead><tr><th>Loan</th><th>Customer</th><th>Vehicle</th><th>Last Payment</th><th style={{ textAlign: 'right' }}>Balance</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/loans/${r.loanCode}`}>{r.loanCode}</Link></td>
                      <td>{r.customer?.name}<br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{r.customer?.phone}</span></td>
                      <td>{r.vehicle?.registrationNo ?? '—'}</td>
                      <td>{r.payments?.[0] ? formatDate(r.payments[0].paymentDate) : 'Never'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(Number(r.totalPayable) - Number(r.totalCollected))}</td>
                      <td>
                        <a href={`tel:${r.customer?.phone}`} className="btn btn-ghost btn-sm">Call</a>
                        <Link href={`/loans/${r.loanCode}`} className="btn btn-ghost btn-sm">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {rows.length >= 300 && (
          <p style={{ fontSize: '.78rem', color: 'var(--text-light)', marginTop: '10px' }}>
            Showing the first 300 rows — narrow the filter to see the rest.
          </p>
        )}
      </div>
    </div>
  );
}
