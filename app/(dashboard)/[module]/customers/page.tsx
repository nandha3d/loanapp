import { serverFetch } from '@/lib/api-client/server';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { formatCurrency, getBadgeClass, parsePagination, paginatedResponse, getPaginationPages, getInitials } from '@/lib/utils';
import Link from '@/components/layout/DashboardLink';
import { calculateCreditScore } from '@/lib/creditScore';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';

export default async function CustomersPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'agent';
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);
  
  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';
  const routeId = resolvedParams.routeId || '';
  const status = resolvedParams.status || '';
  const { page, limit, skip } = parsePagination(resolvedParams);

  const routesRes = await serverFetch<any>('/routes');
  const routes = routesRes?.data || routesRes || [];

  const queryParams: Record<string, string> = {
    q,
    routeId,
    status,
    page: String(page),
    limit: String(limit),
  };
  const qs = new URLSearchParams(queryParams).toString();
  const res = await serverFetch<any>(`/customers?${qs}`);
  const customers = res?.data || [];
  const total = res?.pagination?.total || 0;

  const { pagination } = paginatedResponse(customers, total, page, limit);

  return (
    <div className="card">
      <div className="card-header">
        <h3>👥 {dict.customersList.title}</h3>
        <Link href="/customers/new" className="btn btn-primary btn-sm">
          <span className="material-icons-outlined" style={{fontSize:'16px'}}>add</span> {dict.customersList.newCustomer}
        </Link>
      </div>

      <form className="filter-bar" method="GET">
        <div className="search-input">
          <span className="material-icons-outlined">search</span>
          <input 
            type="text" 
            name="q" 
            className="form-control" 
            placeholder={dict.customersList.searchPlaceholder} 
            defaultValue={q}
          />
        </div>
        <select name="routeId" className="form-control" style={{width:'auto'}} defaultValue={routeId}>
          <option value="">{dict.customersList.allRoutes}</option>
          {routes.map((r: any) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select name="status" className="form-control" style={{width:'auto'}} defaultValue={status}>
          <option value="">{dict.customersList.allStatus}</option>
          <option value="active">{dict.customersList.active}</option>
          <option value="pending_review">{dict.approvals.pendingReview}</option>
          <option value="overdue">{dict.customersList.overdue}</option>
          <option value="closed">{dict.customersList.closed}</option>
          <option value="blacklisted">{dict.customersList.blacklisted}</option>
        </select>
        <button type="submit" className="btn btn-secondary">{dict.customersList.filter}</button>
        {(q || routeId || status) && (
          <Link href="/customers" className="btn btn-ghost">{dict.customersList.clear}</Link>
        )}
      </form>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>{dict.customersList.customerId}</th>
              <th>{dict.customersList.name}</th>
              <th>{dict.customersList.phone}</th>
              <th>{dict.customersList.route}</th>
              <th>{dict.customersList.score}</th>
              {appType !== 'chitfunds' && <th>{dict.customersList.activeLoan}</th>}
              <th>{dict.customersList.status}</th>
              <th>{dict.customersList.action}</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c: any) => {
              const activeLoan = c.loans.find((l: any) => !['closed', 'settled'].includes(l.status));
              const { score, grade } = calculateCreditScore(c.loans);
              
              return (
                <tr key={c.id}>
                  <td data-label={dict.customersList.customerId}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="profile-avatar" style={{ width: '32px', height: '32px', fontSize: '.75rem', flexShrink: 0 }}>
                        {c.profilePhoto ? (
                          <img src={c.profilePhoto} alt={c.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                        ) : (
                          getInitials(c.name)
                        )}
                      </div>
                      <strong>{c.customerCode}</strong>
                    </div>
                  </td>
                  <td data-label={dict.customersList.name}>{c.name}</td>
                  <td data-label={dict.customersList.phone}>{c.phone}</td>
                  <td data-label={dict.customersList.route}>{c.route?.name || '—'}</td>
                  <td data-label={dict.customersList.score}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ 
                        fontWeight: 700, 
                        color: score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)' 
                      }}>
                        {score}
                      </span>
                      <span style={{ fontSize: '.7rem', padding: '1px 4px', background: 'var(--bg)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        {grade}
                      </span>
                    </div>
                  </td>
                  {appType !== 'chitfunds' && (
                    <td data-label={dict.customersList.activeLoan}>
                      {activeLoan ? (
                        <>
                          <Link href={`/loans/${activeLoan.loanCode}`}>{activeLoan.loanCode}</Link>
                          <br />
                          <span style={{fontSize:'.75rem', color:'var(--text-light)'}}>
                            {formatCurrency(Number(activeLoan.principal), currencySymbol)}
                          </span>
                        </>
                      ) : (
                        <span style={{color:'var(--text-light)'}}>{dict.customersList.none}</span>
                      )}
                    </td>
                  )}
                  <td data-label={dict.customersList.status}>
                    <span className={getBadgeClass(c.status)} style={{textTransform:'capitalize'}}>
                      {c.status === 'pending_review' ? dict.approvals.pendingReview : c.status}
                    </span>
                  </td>
                  <td data-label={dict.customersList.action}>
                    <Link href={`/customers/${c.customerCode}`} className="btn btn-ghost btn-sm">{dict.customersList.view}</Link>
                    {userRole !== 'agent' && (
                      <Link href={`/customers/new?edit=${c.id}`} className="btn btn-ghost btn-sm">{dict.customersList.edit}</Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={appType !== 'chitfunds' ? 8 : 7} style={{textAlign:'center', padding:'32px', color:'var(--text-light)'}}>
                  {dict.customersList.noCustomers}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="pagination">
          <span>{dict.accounting.showing} {skip + 1}–{Math.min(skip + limit, total)} {dict.accounting.of} {total} {dict.customersList.title.toLowerCase()}</span>
          <div className="pages">
            <Link 
              href={`/customers?page=${page > 1 ? page - 1 : 1}&q=${q}&routeId=${routeId}&status=${status}`} 
              className={`page-btn ${!pagination.hasPrev ? 'disabled' : ''}`}
            >
              &lsaquo;
            </Link>
            {getPaginationPages(page, pagination.totalPages).map((pageItem, index) => (
              pageItem === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="page-btn dots">…</span>
              ) : pageItem === page ? (
                <button key={pageItem} className="page-btn active">{pageItem}</button>
              ) : (
                <Link
                  key={pageItem}
                  href={`/customers?page=${pageItem}&q=${q}&routeId=${routeId}&status=${status}`}
                  className="page-btn"
                >
                  {pageItem}
                </Link>
              )
            ))}
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
