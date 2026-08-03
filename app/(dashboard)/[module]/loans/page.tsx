import { serverFetch } from '@/lib/api-client/server';
import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { formatCurrency, formatDate, getBadgeClass, parsePagination, paginatedResponse, getPaginationPages, calcPercentage } from '@/lib/utils';
import Link from '@/components/layout/DashboardLink';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';

import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';

/** Shape the Auto Finance grid view reads off each loan row. */
type LoanCard = {
  id: string;
  loanCode: string;
  status: string;
  paidCount: number;
  totalInstalments: number;
  totalPayable: number | string;
  totalCollected: number | string;
  customer: { name: string; phone: string };
  vehicle: {
    registrationNo: string; make: string; model: string; repoFlag: boolean;
  } | null;
};

export default async function LoansPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'agent';
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  // Chitfunds is chit-only — no loan origination.
  if (appType === 'chitfunds') notFound();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const dict = await getDictionary(tenantId);
  const branchId = await getActiveBranchId();

  const resolvedParams = await searchParams;
  const q = resolvedParams.q || '';
  const status = resolvedParams.status || '';
  const frequency = resolvedParams.frequency || '';
  const sort = resolvedParams.sort || 'createdAt';
  const dir: 'asc' | 'desc' = resolvedParams.dir === 'asc' ? 'asc' : 'desc';
  const { page, limit, skip } = parsePagination(resolvedParams);

  // Auto Finance universal directory: extra filter axes + a grid/list toggle.
  const isAutoFinance = appType === 'autofinance';
  const vehicleType = isAutoFinance ? (resolvedParams.vehicleType || '') : '';
  const dealerId = isAutoFinance ? (resolvedParams.dealerId || '') : '';
  const brokerId = isAutoFinance ? (resolvedParams.brokerId || '') : '';
  const seized = isAutoFinance ? (resolvedParams.seized || '') : '';
  const view = isAutoFinance && resolvedParams.view === 'grid' ? 'grid' : 'table';

  const partners = isAutoFinance
    ? await prisma.financePartner.findMany({
      where: { tenantId, appType, status: 'active', deletedAt: null },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    }).catch(() => [])
    : [];
  const brokers = partners.filter((p) => p.type === 'broker');
  const dealers = partners.filter((p) => p.type === 'dealer');

  // Whitelist of sortable columns → Prisma orderBy. Keeps the URL param safe
  // (no arbitrary field injection) and centralises the column→field mapping.
  const orderByMap: Record<string, any> = {
    loanCode: { loanCode: dir },
    customer: { customer: { name: dir } },
    principal: { principal: dir },
    frequency: { frequency: dir },
    startDate: { startDate: dir },
    paid: { totalCollected: dir },
    progress: { paidCount: dir },
    status: { status: dir },
    createdAt: { createdAt: dir },
  };
  const orderBy = orderByMap[sort] || { createdAt: 'desc' };

  // Preserve all active filters/sort when building header + pagination links.
  const buildQuery = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (status) p.set('status', status);
    if (frequency) p.set('frequency', frequency);
    if (vehicleType) p.set('vehicleType', vehicleType);
    if (dealerId) p.set('dealerId', dealerId);
    if (brokerId) p.set('brokerId', brokerId);
    if (seized) p.set('seized', seized);
    if (isAutoFinance) p.set('view', view);
    if (sort) p.set('sort', sort);
    p.set('dir', dir);
    for (const [k, v] of Object.entries(overrides)) p.set(k, v);
    return p.toString();
  };

  const queryParams: Record<string, string> = {
    q,
    status,
    frequency,
    sort,
    dir,
    page: String(page),
    limit: String(limit),
    ...(vehicleType ? { vehicleType } : {}),
    ...(dealerId ? { dealerId } : {}),
    ...(brokerId ? { brokerId } : {}),
    ...(seized ? { seized } : {}),
  };
  const qs = new URLSearchParams(queryParams).toString();
  const res = await serverFetch<any>(`/loans?${qs}`);
  const loans = res?.data || [];
  const total = res?.pagination?.total || 0;

  const { pagination } = paginatedResponse(loans, total, page, limit);

  // Reusable sortable column header. Clicking toggles asc/desc; resets to page 1.
  const SortableTh = ({ label, field }: { label: string; field: string }) => {
    const active = sort === field;
    const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
    const arrow = active ? (dir === 'asc' ? '▲' : '▼') : '⇅';
    return (
      <th>
        <Link
          href={`/loans?${buildQuery({ sort: field, dir: nextDir, page: '1' })}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'inherit', textDecoration: 'none', cursor: 'pointer', userSelect: 'none' }}
        >
          {label}
          <span style={{ fontSize: '.7rem', color: active ? 'var(--primary)' : 'var(--text-light)', opacity: active ? 1 : 0.5 }}>{arrow}</span>
        </Link>
      </th>
    );
  };

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
          <option value="pending_review">{dict.approvals.pendingReview}</option>
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
        {/* Auto Finance universal directory: status × vehicle type × dealer ×
            broker × seized, all combinable in one pass. */}
        {isAutoFinance && (
          <>
            <select name="vehicleType" className="form-control" style={{ width: 'auto' }} defaultValue={vehicleType}>
              <option value="">All vehicle types</option>
              <option value="two_wheeler">Two Wheeler</option>
              <option value="three_wheeler">Three Wheeler</option>
              <option value="four_wheeler">Four Wheeler</option>
              <option value="commercial">Commercial</option>
            </select>
            <select name="dealerId" className="form-control" style={{ width: 'auto' }} defaultValue={dealerId}>
              <option value="">All dealers</option>
              {dealers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select name="brokerId" className="form-control" style={{ width: 'auto' }} defaultValue={brokerId}>
              <option value="">All brokers</option>
              {brokers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select name="seized" className="form-control" style={{ width: 'auto' }} defaultValue={seized}>
              <option value="">Seized &amp; not</option>
              <option value="true">Seized only</option>
              <option value="false">Not seized</option>
            </select>
            <input type="hidden" name="view" value={view} />
          </>
        )}
        <button type="submit" className="btn btn-secondary">{dict.loansList.filter}</button>
        {(q || status || frequency || vehicleType || dealerId || brokerId || seized) && (
          <Link href="/loans" className="btn btn-ghost">{dict.loansList.clear}</Link>
        )}
        {isAutoFinance && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '4px' }}>
            <Link href={`/loans?${buildQuery({ view: 'table', page: '1' })}`}
              className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-secondary'}`} title="List view">
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>view_list</span>
            </Link>
            <Link href={`/loans?${buildQuery({ view: 'grid', page: '1' })}`}
              className={`btn btn-sm ${view === 'grid' ? 'btn-primary' : 'btn-secondary'}`} title="Grid view">
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>grid_view</span>
            </Link>
          </span>
        )}
      </form>

      {isAutoFinance && view === 'grid' ? (
        <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {loans.length === 0 && (
            <p style={{ color: 'var(--text-light)' }}>{dict.loansList.noLoans ?? 'No loans found.'}</p>
          )}
          {(loans as LoanCard[]).map((l) => {
            const pct = calcPercentage(l.paidCount, l.totalInstalments);
            const balance = Number(l.totalPayable || 0) - Number(l.totalCollected || 0);
            return (
              <Link key={l.id} href={`/loans/${l.loanCode}`}
                className="card"
                style={{ padding: '14px', textDecoration: 'none', color: 'inherit', borderLeft: `4px solid ${l.vehicle?.repoFlag ? 'var(--danger)' : 'var(--primary)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <strong style={{ fontSize: '.95rem' }}>{l.vehicle?.registrationNo || l.loanCode}</strong>
                  <span className={`badge ${getBadgeClass(l.status)}`}>{l.vehicle?.repoFlag ? 'seized' : l.status}</span>
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {l.vehicle ? `${l.vehicle.make} ${l.vehicle.model}` : '—'}
                </div>
                <div style={{ fontSize: '.82rem', marginTop: '8px' }}>{l.customer.name}</div>
                <div style={{ fontSize: '.74rem', color: 'var(--text-light)' }}>{l.customer.phone}</div>
                <div style={{ marginTop: '10px', height: '6px', background: 'var(--bg)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.74rem', marginTop: '6px' }}>
                  <span>{l.paidCount}/{l.totalInstalments} paid</span>
                  <strong>{formatCurrency(balance, currencySymbol)}</strong>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <SortableTh label={dict.loansList.loanId} field="loanCode" />
              <SortableTh label={dict.loansList.customer} field="customer" />
              <SortableTh label={dict.loansList.principal} field="principal" />
              <SortableTh label={dict.loanDetail.paid} field="paid" />
              <SortableTh label={dict.loansList.frequency} field="frequency" />
              <SortableTh label={dict.loansList.startDate} field="startDate" />
              <SortableTh label={dict.loansList.progress} field="progress" />
              <SortableTh label={dict.loansList.status} field="status" />
              <th>{dict.loansList.action}</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l: any) => {
              const pct = calcPercentage(l.paidCount, l.totalInstalments);
              const totalRepayable = Number(l.perInstalment) * l.totalInstalments;
              const paid = Number(l.totalCollected || 0);
              const initials = (l.customer.name || '?').trim().charAt(0).toUpperCase();
              return (
                <tr key={l.id}>
                  <td data-label={dict.loansList.loanId}><strong>{l.loanCode}</strong></td>
                  <td data-label={dict.loansList.customer}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                        background: l.customer.profilePhoto ? 'transparent' : 'var(--primary)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '.85rem', fontWeight: 700, overflow: 'hidden',
                      }}>
                        {l.customer.profilePhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.customer.profilePhoto} alt={l.customer.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : initials}
                      </div>
                      <div>
                        <Link href={`/customers/${l.customer.customerCode}`} style={{ fontWeight: 600 }}>{l.customer.name}</Link>
                        <br />
                        <span style={{fontSize:'.75rem', color:'var(--text-light)'}}>{l.customer.customerCode}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label={dict.loansList.principal}>{formatCurrency(l.principal, currencySymbol)}</td>
                  <td data-label={dict.loanDetail.paid}>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(paid, currencySymbol)}</span>
                    <br />
                    <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>of {formatCurrency(totalRepayable, currencySymbol)}</span>
                  </td>
                  <td data-label={dict.loansList.frequency} style={{textTransform:'capitalize'}}>{l.frequency}</td>
                  <td data-label={dict.loansList.startDate}>{formatDate(l.startDate)}</td>
                  <td data-label={dict.loansList.progress}>
                    <div className="progress" style={{ width: '100px' }}>
                      <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="progress-text">{pct}% ({l.paidCount}/{l.totalInstalments})</span>
                  </td>
                  <td data-label={dict.loansList.status}>
                    <span className={getBadgeClass(l.status)} style={{textTransform:'capitalize'}}>
                      {l.status === 'pending_review' ? dict.approvals.pendingReview : l.status}
                    </span>
                  </td>
                  <td data-label={dict.loansList.action}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link href={`/loans/${l.loanCode}`} className="btn btn-ghost btn-sm">{dict.loansList.view}</Link>
                      <Link href={`/loans/${l.loanCode}/edit`} className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }}>{dict.loansList.edit}</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {loans.length === 0 && (
              <tr>
                <td colSpan={9} style={{textAlign:'center', padding:'32px', color:'var(--text-light)'}}>
                  {dict.loansList.noLoans}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {total > 0 && (
        <div className="pagination">
          <span>{dict.accounting.showing} {skip + 1}–{Math.min(skip + limit, total)} {dict.accounting.of} {total} {dict.loansList.title.toLowerCase()}</span>
          <div className="pages">
            <Link
              href={`/loans?${buildQuery({ page: String(page > 1 ? page - 1 : 1) })}`}
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
                  href={`/loans?${buildQuery({ page: String(pageItem) })}`}
                  className="page-btn"
                >
                  {pageItem}
                </Link>
              )
            ))}
            <Link
              href={`/loans?${buildQuery({ page: String(pagination.hasNext ? page + 1 : page) })}`}
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
