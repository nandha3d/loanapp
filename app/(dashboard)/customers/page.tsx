import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { formatCurrency, getBadgeClass, parsePagination, paginatedResponse } from '@/lib/utils';
import Link from 'next/link';

export default async function CustomersPage({
  searchParams
}: {
  searchParams: { [key: string]: string | undefined }
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'agent';
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  
  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';
  const routeId = resolvedParams.routeId || '';
  const status = resolvedParams.status || '';
  const { page, limit, skip } = parsePagination(resolvedParams);

  const branchId = (session?.user as any)?.branchId as string | undefined;

  // Build where clause
  const where: any = { tenantId, appType };
  // Admins are branch-scoped; superadmin/developer see all
  if (userRole === 'admin' && branchId) {
    where.branchId = branchId;
  }
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { customerCode: { contains: q } },
      { phone: { contains: q } }
    ];
  }
  if (routeId) where.routeId = routeId;
  if (status) where.status = status;

  // Fetch routes for filter
  const routes = await prisma.route.findMany({
    where: { tenantId, appType, status: 'active' },
    orderBy: { name: 'asc' }
  });

  // Fetch customers
  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        route: true,
        loans: {
          where: { status: { notIn: ['closed', 'settled'] } },
          take: 1
        }
      }
    })
  ]);

  const { pagination } = paginatedResponse(customers, total, page, limit);

  return (
    <div className="card">
      <div className="card-header">
        <h3>👥 Customer Directory</h3>
        <Link href="/customers/new" className="btn btn-primary btn-sm">
          <span className="material-icons-outlined" style={{fontSize:'16px'}}>add</span> New Customer
        </Link>
      </div>

      <form className="filter-bar" method="GET">
        <div className="search-input">
          <span className="material-icons-outlined">search</span>
          <input 
            type="text" 
            name="q" 
            className="form-control" 
            placeholder="Search by name, ID, or phone..." 
            defaultValue={q}
          />
        </div>
        <select name="routeId" className="form-control" style={{width:'auto'}} defaultValue={routeId}>
          <option value="">All Routes</option>
          {routes.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select name="status" className="form-control" style={{width:'auto'}} defaultValue={status}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="overdue">Overdue</option>
          <option value="closed">Closed</option>
          <option value="blacklisted">Blacklisted</option>
        </select>
        <button type="submit" className="btn btn-secondary">Filter</button>
        {(q || routeId || status) && (
          <Link href="/customers" className="btn btn-ghost">Clear</Link>
        )}
      </form>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Route</th>
              <th>Active Loan</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => {
              const loan = c.loans[0];
              return (
                <tr key={c.id}>
                  <td><strong>{c.customerCode}</strong></td>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td>{c.route?.name || '—'}</td>
                  <td>
                    {loan ? (
                      <>
                        <Link href={`/loans/${loan.id}`}>{loan.loanCode}</Link>
                        <br />
                        <span style={{fontSize:'.75rem', color:'var(--text-light)'}}>
                          {formatCurrency(loan.principal, '₹')}
                        </span>
                      </>
                    ) : (
                      <span style={{color:'var(--text-light)'}}>None</span>
                    )}
                  </td>
                  <td>
                    <span className={getBadgeClass(c.status)} style={{textTransform:'capitalize'}}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <Link href={`/customers/${c.id}`} className="btn btn-ghost btn-sm">View</Link>
                    {userRole !== 'agent' && (
                      <Link href={`/customers/new?edit=${c.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                    )}
                    {c.status === 'pending_review' && userRole !== 'agent' && (
                      <form action={async () => {
                        'use server';
                        const { approveCustomerCreation } = await import('../approvals/actions');
                        await approveCustomerCreation(c.id);
                      }} style={{display: 'inline'}}>
                        <button type="submit" className="btn btn-primary btn-sm" style={{marginLeft: '8px'}}>Approve</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} style={{textAlign:'center', padding:'32px', color:'var(--text-light)'}}>
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="pagination">
          <span>Showing {skip + 1}–{Math.min(skip + limit, total)} of {total} customers</span>
          <div className="pages">
            <Link 
              href={`/customers?page=${page > 1 ? page - 1 : 1}&q=${q}&routeId=${routeId}&status=${status}`} 
              className={`page-btn ${!pagination.hasPrev ? 'disabled' : ''}`}
            >
              &lsaquo;
            </Link>
            <button className="page-btn active">{page}</button>
            <Link 
              href={`/customers?page=${pagination.hasNext ? page + 1 : page}&q=${q}&routeId=${routeId}&status=${status}`} 
              className={`page-btn ${!pagination.hasNext ? 'disabled' : ''}`}
            >
              &rsaquo;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
