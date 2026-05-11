import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { formatCurrency, formatDate, getBadgeClass, parsePagination, paginatedResponse, calcPercentage } from '@/lib/utils';
import Link from 'next/link';

export default async function LoansPage({
  searchParams
}: {
  searchParams: { [key: string]: string | undefined }
}) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const userRole = (session?.user as any)?.role;
  const branchId = (session?.user as any)?.branchId as string | undefined;
  
  const q = searchParams.q || '';
  const status = searchParams.status || '';
  const frequency = searchParams.frequency || '';
  const { page, limit, skip } = parsePagination(searchParams);

  const where: any = { tenantId, appType };
  // Admins are branch-scoped; superadmin/developer see all
  if (userRole === 'admin' && branchId) {
    where.branchId = branchId;
  }
  if (q) {
    where.OR = [
      { loanCode: { contains: q } },
      { customer: { name: { contains: q } } },
      { customer: { customerCode: { contains: q } } }
    ];
  }
  if (status) where.status = status;
  if (frequency) where.frequency = frequency;

  const [total, loans] = await Promise.all([
    prisma.loan.count({ where }),
    prisma.loan.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
      }
    })
  ]);

  const { pagination } = paginatedResponse(loans, total, page, limit);

  return (
    <div className="card">
      <div className="card-header">
        <h3>💰 Loan Registry</h3>
        <Link href="/loans/new" className="btn btn-primary btn-sm">
          <span className="material-icons-outlined" style={{fontSize:'16px'}}>add</span> New Loan
        </Link>
      </div>

      <form className="filter-bar" method="GET">
        <div className="search-input">
          <span className="material-icons-outlined">search</span>
          <input 
            type="text" 
            name="q" 
            className="form-control" 
            placeholder="Search by Customer or Loan ID..." 
            defaultValue={q}
          />
        </div>
        <select name="status" className="form-control" style={{width:'auto'}} defaultValue={status}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="overdue">Overdue</option>
          <option value="settled">Settled</option>
          <option value="closed">Closed</option>
        </select>
        <select name="frequency" className="form-control" style={{width:'auto'}} defaultValue={frequency}>
          <option value="">All Frequencies</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button type="submit" className="btn btn-secondary">Filter</button>
        {(q || status || frequency) && (
          <Link href="/loans" className="btn btn-ghost">Clear</Link>
        )}
      </form>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Loan ID</th>
              <th>Customer</th>
              <th>Principal</th>
              <th>Frequency</th>
              <th>Start Date</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loans.map(l => {
              const pct = calcPercentage(l.paidCount, l.totalInstalments);
              return (
                <tr key={l.id}>
                  <td><strong>{l.loanCode}</strong></td>
                  <td>
                    <Link href={`/customers/${l.customer.id}`}>{l.customer.name}</Link>
                    <br />
                    <span style={{fontSize:'.75rem', color:'var(--text-light)'}}>{l.customer.customerCode}</span>
                  </td>
                  <td>{formatCurrency(l.principal, currencySymbol)}</td>
                  <td style={{textTransform:'capitalize'}}>{l.frequency}</td>
                  <td>{formatDate(l.startDate)}</td>
                  <td>
                    <div className="progress" style={{ width: '100px' }}>
                      <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="progress-text">{pct}% ({l.paidCount}/{l.totalInstalments})</span>
                  </td>
                  <td>
                    <span className={getBadgeClass(l.status)} style={{textTransform:'capitalize'}}>
                      {l.status}
                    </span>
                  </td>
                  <td>
                    <Link href={`/loans/${l.id}`} className="btn btn-ghost btn-sm">View</Link>
                  </td>
                </tr>
              );
            })}
            {loans.length === 0 && (
              <tr>
                <td colSpan={8} style={{textAlign:'center', padding:'32px', color:'var(--text-light)'}}>
                  No loans found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="pagination">
          <span>Showing {skip + 1}–{Math.min(skip + limit, total)} of {total} loans</span>
          <div className="pages">
            <Link 
              href={`/loans?page=${page > 1 ? page - 1 : 1}&q=${q}&status=${status}&frequency=${frequency}`} 
              className={`page-btn ${!pagination.hasPrev ? 'disabled' : ''}`}
            >
              &lsaquo;
            </Link>
            <button className="page-btn active">{page}</button>
            <Link 
              href={`/loans?page=${pagination.hasNext ? page + 1 : page}&q=${q}&status=${status}&frequency=${frequency}`} 
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
