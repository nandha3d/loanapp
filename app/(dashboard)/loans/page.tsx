import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { formatCurrency, formatDate, getBadgeClass, parsePagination, paginatedResponse, calcPercentage } from '@/lib/utils';
import Link from 'next/link';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';

export default async function LoansPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);
  const branchId = await getActiveBranchId();

  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';
  const status = resolvedParams.status || '';
  const frequency = resolvedParams.frequency || '';
  const { page, limit, skip } = parsePagination(resolvedParams);

  const where: any = { tenantId, appType, AND: [] };
  if (branchId) {
    where.AND.push({ branchId });
  }
  if (q) {
    where.AND.push({
      OR: [
        { loanCode: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { customerCode: { contains: q } } }
      ]
    });
  }
  if (status) where.status = status;
  if (frequency) where.frequency = frequency;
  if (where.AND.length === 0) delete where.AND;

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
        <h3>💰 {dict.loansList.title}</h3>
        <Link href="/loans/new" className="btn btn-primary btn-sm">
          <span className="material-icons-outlined" style={{fontSize:'16px'}}>add</span> {dict.loansList.newLoan}
        </Link>
      </div>

      <form className="filter-bar" method="GET">
        <div className="search-input">
          <span className="material-icons-outlined">search</span>
          <input 
            type="text" 
            name="q" 
            className="form-control" 
            placeholder={dict.loansList.searchPlaceholder} 
            defaultValue={q}
          />
        </div>
        <select name="status" className="form-control" style={{width:'auto'}} defaultValue={status}>
          <option value="">{dict.loansList.allStatus}</option>
          <option value="active">{dict.loansList.active}</option>
          <option value="pending_review">Pending Review</option>
          <option value="overdue">{dict.loansList.overdue}</option>
          <option value="settled">{dict.loansList.settled}</option>
          <option value="closed">{dict.loansList.closed}</option>
        </select>
        <select name="frequency" className="form-control" style={{width:'auto'}} defaultValue={frequency}>
          <option value="">{dict.loansList.allFrequencies}</option>
          <option value="daily">{dict.loansList.daily}</option>
          <option value="weekly">{dict.loansList.weekly}</option>
          <option value="monthly">{dict.loansList.monthly}</option>
        </select>
        <button type="submit" className="btn btn-secondary">{dict.loansList.filter}</button>
        {(q || status || frequency) && (
          <Link href="/loans" className="btn btn-ghost">{dict.loansList.clear}</Link>
        )}
      </form>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>{dict.loansList.loanId}</th>
              <th>{dict.loansList.customer}</th>
              <th>{dict.loansList.principal}</th>
              <th>{dict.loansList.frequency}</th>
              <th>{dict.loansList.startDate}</th>
              <th>{dict.loansList.progress}</th>
              <th>{dict.loansList.status}</th>
              <th>{dict.loansList.action}</th>
            </tr>
          </thead>
          <tbody>
            {loans.map(l => {
              const pct = calcPercentage(l.paidCount, l.totalInstalments);
              return (
                <tr key={l.id}>
                  <td><strong>{l.loanCode}</strong></td>
                  <td>
                    <Link href={`/customers/${l.customer.customerCode}`}>{l.customer.name}</Link>
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
                      {l.status === 'pending_review' ? 'Pending Review' : l.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link href={`/loans/${l.id}`} className="btn btn-ghost btn-sm">{dict.loansList.view}</Link>
                      <Link href={`/loans/${l.id}/edit`} className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }}>{dict.loansList.edit}</Link>
                    </div>
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
          <span>Showing {skip + 1}–{Math.min(skip + limit, total)} of {total} {dict.loansList.title.toLowerCase()}</span>
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
