import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const userRole = (session?.user as any)?.role;

  if (!session) redirect('/login');
  if (userRole === 'agent') redirect('/collection');

  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';
  const filter = resolvedParams.filter || ''; // '' | 'repo' | 'insurance_expiring'

  const where: any = { tenantId, appType: 'autofinance' };
  if (q) {
    where.OR = [
      { registrationNo: { contains: q } },
      { make: { contains: q } },
      { model: { contains: q } },
      { customer: { name: { contains: q } } },
    ];
  }
  if (filter === 'repo') where.repoFlag = true;
  if (filter === 'insurance_expiring') {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    where.insuranceExpiry = { lte: in30, gte: new Date() };
  }

  let vehicles: any[] = [];
  let repoCount = 0;
  let insuranceExpiringCount = 0;
  let dbError: string | null = null;

  try {
    [vehicles, repoCount, insuranceExpiringCount] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
          loan: { select: { id: true, loanCode: true, status: true } },
        },
      }),
      prisma.vehicle.count({ where: { tenantId, appType: 'autofinance', repoFlag: true } }),
      prisma.vehicle.count({
        where: {
          tenantId,
          appType: 'autofinance',
          insuranceExpiry: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), gte: new Date() },
        },
      }),
    ]);
  } catch (e: any) {
    dbError = e.message || 'Database tables not yet migrated. Run: npx prisma migrate deploy';
  }

  if (dbError) {
    return (
      <div className="card" style={{ padding: '24px', color: '#b91c1c' }}>
        <strong>Database not ready:</strong> {dbError}
      </div>
    );
  }

  return (
    <div>
      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="material-icons-outlined">directions_car</span></div>
          <div><div className="kpi-value">{vehicles.length}</div><div className="kpi-label">Total Vehicles</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon red"><span className="material-icons-outlined">car_crash</span></div>
          <div><div className="kpi-value">{repoCount}</div><div className="kpi-label">Repo Flagged</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">policy</span></div>
          <div><div className="kpi-value">{insuranceExpiringCount}</div><div className="kpi-label">Insurance Expiring (30d)</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>🚗 Vehicle Registry</h3>
          <Link href="/vehicles/new" className="btn btn-primary btn-sm">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span> Add Vehicle
          </Link>
        </div>

        {/* Filters */}
        <form method="GET" className="filter-bar" style={{ marginBottom: '16px' }}>
          <input name="q" type="text" className="form-control" placeholder="Search reg, make, customer..." defaultValue={q} style={{ maxWidth: '280px' }} />
          <select name="filter" className="form-control" style={{ width: 'auto' }} defaultValue={filter}>
            <option value="">All Vehicles</option>
            <option value="repo">Repo Flagged</option>
            <option value="insurance_expiring">Insurance Expiring (30d)</option>
          </select>
          <button type="submit" className="btn btn-secondary">Filter</button>
        </form>

        {vehicles.length === 0 ? (
          <div className="empty-state">
            <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>directions_car</span>
            <p>No vehicles found.</p>
            <Link href="/vehicles/new" className="btn btn-primary btn-sm">Add First Vehicle</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th>Customer</th>
                  <th>Loan</th>
                  <th>Insurance Expiry</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} style={v.repoFlag ? { background: 'var(--danger-light, #fff0f0)' } : {}}>
                    <td>
                      <strong>{v.registrationNo}</strong>
                      {v.repoFlag && (
                        <span className="badge badge-danger" style={{ marginLeft: '6px', fontSize: '.65rem' }}>REPO</span>
                      )}
                    </td>
                    <td>{v.make} {v.model} {v.year ? `(${v.year})` : ''}</td>
                    <td><span className="badge badge-info">{v.vehicleType.replace('_', ' ')}</span></td>
                    <td>
                      <Link href={`/customers/${v.customer.id}`}>{v.customer.name}</Link>
                      <br /><span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>{v.customer.customerCode}</span>
                    </td>
                    <td>
                      {v.loan ? (
                        <Link href={`/loans/${v.loan.id}`}>{v.loan.loanCode}</Link>
                      ) : '—'}
                    </td>
                    <td>
                      {v.insuranceExpiry ? (
                        <span style={{ color: new Date(v.insuranceExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'var(--danger)' : 'inherit' }}>
                          {formatDate(v.insuranceExpiry)}
                        </span>
                      ) : '—'}
                    </td>
                    <td><span className={`badge badge-${v.repoFlag ? 'danger' : v.status === 'active' ? 'success' : 'secondary'}`}>{v.repoFlag ? 'Repo' : v.status}</span></td>
                    <td><Link href={`/vehicles/${v.id}`} className="btn btn-ghost btn-sm">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
