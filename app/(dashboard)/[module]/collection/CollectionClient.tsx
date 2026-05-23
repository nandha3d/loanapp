'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency, formatDate, getBadgeClass, getInitials, getPaginationPages } from '@/lib/utils';
import { submitCollectionEntry, requestCollectionEdit, requestCashHandover } from './actions';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';

type CollectionRow = {
  id: string;
  instalmentNo: number;
  dueDate: string;
  dueAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  daysOverdue: number;
  status: string;
  loan: {
    id: string;
    loanCode: string;
    customer: {
      id: string;
      name: string;
      customerCode: string;
      route?: { id: string; name: string } | null;
    };
  };
  collectionEntry?: { id: string } | null;
};

type RouteOption = {
  id: string;
  name: string;
};

type CustomerOverdueGroup = {
  customerId: string;
  customerName: string;
  customerCode: string;
  routeName: string;
  instalments: CollectionRow[];
  loanCodes: string[];
  earliestDueDate: string;
  dueToday: number;
  receivedAmount: number;
  totalOutstanding: number;
  totalOverdue: number;
  maxDaysOverdue: number;
  statusLabel: string;
};

export default function CollectionClient({
  todayInstalments,
  overdueInstalments,
  routes,
  agentName,
  agentRole,
  routeName,
  currencySymbol,
  dict,
  dailyCollection,
  receiptPdfEnabled = false,
}: {
  todayInstalments: CollectionRow[];
  overdueInstalments: CollectionRow[];
  routes: RouteOption[];
  agentName: string;
  agentRole: string;
  routeName: string;
  currencySymbol: string;
  dict: any;
  dailyCollection: { id: string; status: string; totalCollected: number } | null;
  receiptPdfEnabled?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState<CollectionRow | null>(null);
  const [overdueCustomerGroup, setOverdueCustomerGroup] = useState<CustomerOverdueGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState('cash');
  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState(() => searchParams.get('date') || '');
  const [customerFilter, setCustomerFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'today' | 'overdue'>(
    () => {
      const tab = searchParams.get('tab');
      if (tab === 'overdue') return 'overdue';
      if (tab === 'today') return 'today';
      return 'all';
    },
  );
  const [overdueMinDays, setOverdueMinDays] = useState('');
  const [overdueMaxDays, setOverdueMaxDays] = useState('');

  const isAdmin = agentRole === 'admin' || agentRole === 'superadmin';
  const modalRef = useRef<HTMLDivElement>(null);

  // DEF-031 / DEF-032: Trap focus within modal and close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modal) {
          setModal(null);
        } else if (overdueCustomerGroup) {
          setOverdueCustomerGroup(null);
        }
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };
    
    if (modal || overdueCustomerGroup) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus first element on open
      setTimeout(() => {
        if (modalRef.current) {
          const firstInput = modalRef.current.querySelector('input, button, a') as HTMLElement;
          if (firstInput) firstInput.focus();
        }
      }, 50);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [modal, overdueCustomerGroup]);

  // Merge both arrays, deduplicate by id
  const allInstalments = useMemo(() => {
    const map = new Map<string, CollectionRow & { source: 'today' | 'overdue' }>();
    for (const row of todayInstalments) {
      map.set(row.id, { ...row, source: 'today' as const });
    }
    for (const row of overdueInstalments) {
      if (!map.has(row.id)) {
        map.set(row.id, { ...row, source: 'overdue' as const });
      }
    }
    return Array.from(map.values());
  }, [todayInstalments, overdueInstalments]);

  const filteredRows = useMemo(() => {
    return allInstalments.filter((row) => {
      // Type filter
      if (typeFilter === 'today' && row.source !== 'today') return false;
      if (typeFilter === 'overdue' && row.source !== 'overdue') return false;

      const dueDate = new Date(row.dueDate).toISOString().slice(0, 10);
      const matchesDate = !dateFilter || dueDate === dateFilter;
      const search = customerFilter.trim().toLowerCase();
      const matchesCustomer = !search
        || row.loan.customer.name.toLowerCase().includes(search)
        || row.loan.customer.customerCode.toLowerCase().includes(search)
        || row.loan.loanCode.toLowerCase().includes(search);
      const matchesRoute = !routeFilter || row.loan.customer.route?.id === routeFilter;
      const matchesStatus = !statusFilter || row.status === statusFilter;

      // Overdue days range filter
      const minD = overdueMinDays ? Number(overdueMinDays) : 0;
      const maxD = overdueMaxDays ? Number(overdueMaxDays) : Infinity;
      const matchesOverdueDays = row.daysOverdue >= minD && row.daysOverdue <= maxD;

      return matchesDate && matchesCustomer && matchesRoute && matchesStatus && matchesOverdueDays;
    });
  }, [allInstalments, typeFilter, customerFilter, dateFilter, routeFilter, statusFilter, overdueMinDays, overdueMaxDays]);

  const todayTotals = useMemo(() => {
    return {
      due: todayInstalments.reduce((sum, row) => sum + row.dueAmount, 0),
      collected: todayInstalments.reduce((sum, row) => sum + Math.min(row.receivedAmount, row.dueAmount), 0),
      outstanding: todayInstalments.reduce((sum, row) => sum + row.outstandingAmount, 0),
    };
  }, [todayInstalments]);

  const overdueTotals = useMemo(() => {
    return {
      amount: overdueInstalments.reduce((sum, row) => sum + row.overdueAmount, 0),
      count: overdueInstalments.length,
      maxDays: overdueInstalments.reduce((max, row) => Math.max(max, row.daysOverdue), 0),
    };
  }, [overdueInstalments]);

  // Keep groupedOverdue for the detail popup (still used when clicking Details)
  const groupedOverdue = useMemo<CustomerOverdueGroup[]>(() => {
    const map = new Map<string, CustomerOverdueGroup>();
    const today = new Date().toISOString().slice(0, 10);
    const rows = filteredRows.filter(r => r.daysOverdue > 0 && r.outstandingAmount > 0);
    for (const row of rows) {
      const cid = row.loan.customer.id;
      if (!map.has(cid)) {
        map.set(cid, {
          customerId: cid,
          customerName: row.loan.customer.name,
          customerCode: row.loan.customer.customerCode,
          routeName: row.loan.customer.route?.name || '-',
          instalments: [],
          loanCodes: [],
          earliestDueDate: row.dueDate,
          dueToday: 0,
          receivedAmount: 0,
          totalOutstanding: 0,
          totalOverdue: 0,
          maxDaysOverdue: 0,
          statusLabel: row.status,
        });
      }
      const g = map.get(cid)!;
      g.instalments.push(row);
      if (!g.loanCodes.includes(row.loan.loanCode)) {
        g.loanCodes.push(row.loan.loanCode);
      }
      if (row.dueDate < g.earliestDueDate) {
        g.earliestDueDate = row.dueDate;
      }
      if (row.dueDate === today) {
        g.dueToday += row.dueAmount;
      }
      g.receivedAmount += row.receivedAmount;
      g.totalOutstanding += row.outstandingAmount;
      g.totalOverdue += row.overdueAmount;
      g.maxDaysOverdue = Math.max(g.maxDaysOverdue, row.daysOverdue);
      if (g.statusLabel !== row.status) {
        g.statusLabel = 'mixed';
      }
    }
    for (const g of map.values()) {
      g.instalments.sort((a, b) => b.daysOverdue - a.daysOverdue);
    }
    return Array.from(map.values()).sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue);
  }, [filteredRows]);

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const todayISO = new Date().toISOString().slice(0, 10);

  const openModal = (instalment: CollectionRow) => {
    const isPaid = instalment.receivedAmount > 0;
    setAmount(isPaid ? instalment.receivedAmount : (instalment.outstandingAmount > 0 ? instalment.outstandingAmount : instalment.dueAmount));
    setMode('cash');
    setRemarks('');
    setReason('');
    setModal(instalment);
  };

  const handleSubmit = async () => {
    if (!modal || amount < 0) return;
    setLoading(true);
    const fd = new FormData();
    fd.set('instalmentId', modal.id);

    const isEditRequest = modal.receivedAmount > 0 && !isAdmin;

    try {
      if (isEditRequest) {
        fd.set('requestedAmount', String(amount));
        fd.set('reason', reason);
        const result = await requestCollectionEdit(fd);
        setLoading(false);
        if (result.success) {
          setModal(null);
          alert('Edit request submitted successfully.');
        } else {
          alert(result.error || 'Failed to submit request');
        }
      } else {
        fd.set('receivedAmount', String(amount));
        fd.set('paymentMode', mode);
        fd.set('remarks', remarks);
        const result = await submitCollectionEntry(fd);
        setLoading(false);
        if (result.success) {
          setModal(null);
          router.refresh();
        } else {
          alert(result.error || 'Failed to submit');
        }
      }
    } catch (err) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      alert(message);
    }
  };

  const clearFilters = () => {
    setDateFilter('');
    setCustomerFilter('');
    setRouteFilter('');
    setStatusFilter('');
    setTypeFilter('all');
    setOverdueMinDays('');
    setOverdueMaxDays('');
  };

  useEffect(() => {
    setPage(1);
  }, [typeFilter, customerFilter, dateFilter, routeFilter, statusFilter, overdueMinDays, overdueMaxDays]);

  const hasActiveFilters = dateFilter || customerFilter || routeFilter || statusFilter || typeFilter !== 'all' || overdueMinDays || overdueMaxDays;

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const pageButtons = getPaginationPages(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const renderRows = (rows: CollectionRow[]) => (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>{dict.customers.title}</th>
            <th>{dict.sidebar.loans}</th>
            <th>Due Date</th>
            <th>Due Today</th>
            <th>Received</th>
            <th>Outstanding</th>
            <th>Overdue</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((instalment) => {
            const isSettled = instalment.outstandingAmount <= 0;
            const isPaid = instalment.receivedAmount > 0;
            return (
              <tr key={instalment.id} className="collection-entry" style={{ opacity: isSettled ? 0.62 : 1 }}>
                <td>
                  <Link href={`/customers/${instalment.loan.customer.customerCode}`}>
                    <strong>{instalment.loan.customer.name}</strong>
                  </Link>
                  <br />
                  <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>
                    {instalment.loan.customer.customerCode} · {instalment.loan.customer.route?.name || '-'}
                  </span>
                </td>
                <td>
                  <Link href={`/loans/${instalment.loan.loanCode}`}>{instalment.loan.loanCode}</Link>
                  <br />
                  <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>#{instalment.instalmentNo}</span>
                </td>
                <td>{formatDate(instalment.dueDate)}</td>
                <td>{instalment.dueDate === todayISO ? formatCurrency(instalment.dueAmount, currencySymbol) : '-'}</td>
                <td>{instalment.receivedAmount > 0 ? formatCurrency(instalment.receivedAmount, currencySymbol) : '-'}</td>
                <td style={{ fontWeight: 700, color: instalment.outstandingAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {formatCurrency(instalment.outstandingAmount, currencySymbol)}
                </td>
                <td>
                  {instalment.daysOverdue > 0 && instalment.overdueAmount > 0 ? (
                    <span>{instalment.daysOverdue}d · {formatCurrency(instalment.overdueAmount, currencySymbol)}</span>
                  ) : '-'}
                </td>
                <td>
                  <span className={getBadgeClass(instalment.status)} style={{ textTransform: 'capitalize' }}>
                    {instalment.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {isPaid ? (
                      <>
                        {isAdmin ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => openModal(instalment)}>
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span> Edit
                          </button>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => openModal(instalment)}>
                            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>history_edu</span> Request
                          </button>
                        )}
                        {receiptPdfEnabled && instalment.collectionEntry?.id && (
                          <a
                            href={`/api/receipts/${instalment.collectionEntry.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm"
                            title="Download Receipt"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                          >
                            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>receipt_long</span>
                            Receipt
                          </a>
                        )}
                      </>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => openModal(instalment)}>
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>payments</span> Pay
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)' }}>
                No instalments match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGroupedRows = (groups: CustomerOverdueGroup[]) => (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>{dict.customers.title}</th>
            <th>{dict.sidebar.loans}</th>
            <th>Due Date</th>
            <th>Due Today</th>
            <th>Received</th>
            <th>Outstanding</th>
            <th>Overdue</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.customerId} className="collection-entry">
              <td>
                <Link href={`/customers/${group.customerCode}`}>
                  <strong>{group.customerName}</strong>
                </Link>
                <br />
                <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>
                  {group.customerCode} · {group.routeName}
                </span>
              </td>
              <td>
                {group.loanCodes.length === 1 ? (
                  <Link href={`/loans/${group.loanCodes[0]}`}>{group.loanCodes[0]}</Link>
                ) : (
                  <details>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{group.loanCodes[0]} +{group.loanCodes.length - 1}</summary>
                    <ul style={{ margin: '8px 0 0', padding: '0 0 0 16px', listStyle: 'disc' }}>
                      {group.loanCodes.map((code) => (
                        <li key={code} style={{ fontSize: '.82rem' }}>
                          <Link href={`/loans/${code}`}>{code}</Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </td>
              <td>{formatDate(group.earliestDueDate)}</td>
              <td>{group.dueToday > 0 ? formatCurrency(group.dueToday, currencySymbol) : '-'}</td>
              <td>{group.receivedAmount > 0 ? formatCurrency(group.receivedAmount, currencySymbol) : '-'}</td>
              <td style={{ fontWeight: 700, color: group.totalOutstanding > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {formatCurrency(group.totalOutstanding, currencySymbol)}
              </td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => setOverdueCustomerGroup(group)}>
                  <span style={{ display: 'block', lineHeight: 1.2 }}>
                    {group.maxDaysOverdue}d · {group.instalments.length} inst
                  </span>
                  <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>
                    {formatCurrency(group.totalOverdue, currencySymbol)} overdue
                  </span>
                </button>
              </td>
              <td>
                <span className={getBadgeClass(group.statusLabel)} style={{ textTransform: 'capitalize' }}>
                  {group.statusLabel}
                </span>
              </td>
              <td>
                <button className="btn btn-primary btn-sm" onClick={() => setOverdueCustomerGroup(group)}>
                  Details
                </button>
              </td>
            </tr>
          ))}
          {groups.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)' }}>
                No instalments match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderOverdueCards = (groups: CustomerOverdueGroup[]) => {
    if (groups.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-light)' }}>
          <span className="material-icons-outlined" style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>check_circle</span>
          No overdue instalments match these filters.
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {groups.map((group) => (
          <div
            key={group.customerId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Avatar */}
            <div className="profile-avatar" style={{ width: '40px', height: '40px', fontSize: '.8rem', flexShrink: 0 }}>
              {getInitials(group.customerName)}
            </div>

            {/* Customer info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={`/customers/${group.customerCode}`} style={{ fontWeight: 600, fontSize: '.92rem' }}>
                {group.customerName}
              </Link>
              <div style={{ fontSize: '.72rem', color: 'var(--text-light)', marginTop: '2px' }}>
                {group.customerCode} · {group.routeName}
              </div>
            </div>

            {/* Missed count */}
            <span style={{
              flexShrink: 0,
              fontSize: '.72rem',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '20px',
              background: 'rgba(245,158,11,.12)',
              color: 'var(--warning, #D97706)',
              whiteSpace: 'nowrap',
            }}>
              {group.instalments.length} missed
            </span>

            {/* Max days overdue */}
            {group.maxDaysOverdue > 0 && (
              <span style={{
                flexShrink: 0,
                fontSize: '.72rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '20px',
                background: 'rgba(239,68,68,.1)',
                color: 'var(--danger)',
                whiteSpace: 'nowrap',
              }}>
                {group.maxDaysOverdue}d overdue
              </span>
            )}

            {/* Total outstanding */}
            <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '88px' }}>
              <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '.92rem' }}>
                {formatCurrency(group.totalOutstanding, currencySymbol)}
              </div>
              <div style={{ fontSize: '.7rem', color: 'var(--text-light)' }}>outstanding</div>
            </div>

            {/* Details button */}
            <button
              className="btn btn-ghost btn-sm"
              style={{ flexShrink: 0 }}
              onClick={() => setOverdueCustomerGroup(group)}
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>receipt_long</span>
              Details
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="profile-avatar" style={{ width: '48px', height: '48px', fontSize: '1rem' }}>{getInitials(agentName)}</div>
          <div>
            <h3 style={{ fontSize: '1rem' }}>{agentName} - {agentRole === 'admin' ? dict.roles.admin : dict.roles.agent}</h3>
            <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>
              {dict.collection.route}: <strong>{routeName}</strong> · Today: {todayStr}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span className="badge badge-active" style={{ fontSize: '.8rem', padding: '6px 14px' }}>Online</span>
          {agentRole === 'agent' && dailyCollection && dailyCollection.totalCollected > 0 && dailyCollection.status === 'open' && (
            <button 
              className="btn btn-primary btn-sm" 
              onClick={async () => {
                if (!confirm(`Submit handover of ${formatCurrency(dailyCollection.totalCollected, currencySymbol)}?`)) return;
                setLoading(true);
                const res = await requestCashHandover();
                setLoading(false);
                if (res.success) {
                  alert('Handover requested successfully');
                  router.refresh();
                } else {
                  alert(res.error || 'Failed to submit handover');
                }
              }}
              disabled={loading}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>payments</span>
              Submit Handover
            </button>
          )}
          {dailyCollection?.status === 'pending_handover' && (
            <span className="badge" style={{ fontSize: '.8rem', padding: '6px 14px', background: 'rgba(245,158,11,.1)', color: '#D97706' }}>
              Handover Pending
            </span>
          )}
          {dailyCollection?.status === 'settled' && (
            <span className="badge" style={{ fontSize: '.8rem', padding: '6px 14px', background: 'rgba(16,185,129,.1)', color: 'var(--success)' }}>
              Handover Settled
            </span>
          )}
        </div>
      </div>

      <div className="summary-bar" style={{ marginBottom: '20px' }}>
        <div className="summary-item">
          <div className="summary-item-icon" style={{ background: 'rgba(249,115,22,.12)' }}>
            <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: '18px' }}>today</span>
          </div>
          <div className="summary-label">Today Due</div>
          <div className="summary-value">{formatCurrency(todayTotals.due, currencySymbol)}</div>
        </div>
        <div className="summary-item">
          <div className="summary-item-icon" style={{ background: 'rgba(16,185,129,.12)' }}>
            <span className="material-icons-outlined" style={{ color: 'var(--success)', fontSize: '18px' }}>check_circle</span>
          </div>
          <div className="summary-label">Collected Today</div>
          <div className="summary-value" style={{ color: 'var(--success)' }}>{formatCurrency(todayTotals.collected, currencySymbol)}</div>
        </div>
        <div className="summary-item">
          <div className="summary-item-icon" style={{ background: 'rgba(245,158,11,.12)' }}>
            <span className="material-icons-outlined" style={{ color: '#D97706', fontSize: '18px' }}>account_balance_wallet</span>
          </div>
          <div className="summary-label">Today Balance</div>
          <div className="summary-value" style={{ color: '#D97706' }}>{formatCurrency(todayTotals.outstanding, currencySymbol)}</div>
        </div>
        <div className="summary-item">
          <div className="summary-item-icon" style={{ background: 'rgba(239,68,68,.12)' }}>
            <span className="material-icons-outlined" style={{ color: 'var(--danger)', fontSize: '18px' }}>warning_amber</span>
          </div>
          <div className="summary-label">Overdue ({overdueTotals.count})</div>
          <div className="summary-value" style={{ color: 'var(--danger)' }}>{formatCurrency(overdueTotals.amount, currencySymbol)}</div>
        </div>
        <div className="summary-item">
          <div className="summary-item-icon" style={{ background: 'rgba(99,102,241,.12)' }}>
            <span className="material-icons-outlined" style={{ color: '#6366F1', fontSize: '18px' }}>schedule</span>
          </div>
          <div className="summary-label">Oldest Due</div>
          <div className="summary-value" style={{ color: '#6366F1' }}>{overdueTotals.maxDays}d</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '1rem', margin: 0 }}>
            Collections
            <span style={{ fontSize: '.8rem', fontWeight: 400, color: 'var(--text-light)', marginLeft: '8px' }}>
              {filteredRows.length} of {allInstalments.length} instalments
            </span>
          </h3>
          {hasActiveFilters && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ color: 'var(--danger)' }}>
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>filter_list_off</span>
              Clear All Filters
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', alignItems: 'end', marginBottom: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Type</label>
            <select className="form-control" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | 'today' | 'overdue')}>
              <option value="all">All ({allInstalments.length})</option>
              <option value="today">Today ({todayInstalments.length})</option>
              <option value="overdue">Overdue ({overdueInstalments.length})</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Due Date</label>
            <input type="date" className="form-control" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Customer / Loan</label>
            <input className="form-control" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} placeholder="Search name, code, loan" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Route / Line</label>
            <select className="form-control" value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)}>
              <option value="">All routes</option>
              {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <select className="form-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All</option>
              <option value="upcoming">Upcoming</option>
              <option value="partial">Partial</option>
              <option value="missed">Missed</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Overdue Days (min)</label>
            <input type="number" className="form-control" value={overdueMinDays} onChange={(event) => setOverdueMinDays(event.target.value)} placeholder="0" min={0} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Overdue Days (max)</label>
            <input type="number" className="form-control" value={overdueMaxDays} onChange={(event) => setOverdueMaxDays(event.target.value)} placeholder="∞" min={0} />
          </div>
        </div>

        {typeFilter === 'overdue' ? renderGroupedRows(groupedOverdue) : renderRows(paginatedRows)}

        {totalPages > 1 && typeFilter !== 'overdue' && (
          <div className="pagination" style={{ justifyContent: 'center', marginTop: '12px' }}>
            <div className="pages">
              <button
                className={`page-btn ${page === 1 ? 'disabled' : ''}`}
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                &lsaquo;
              </button>
              {pageButtons.map((pageItem, index) => (
                pageItem === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`} className="page-btn dots">…</span>
                ) : (
                  <button
                    key={pageItem}
                    className={`page-btn ${pageItem === page ? 'active' : ''}`}
                    onClick={() => setPage(pageItem)}
                    disabled={pageItem === page}
                  >
                    {pageItem}
                  </button>
                )
              ))}
              <button
                className={`page-btn ${page === totalPages ? 'disabled' : ''}`}
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                &rsaquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Overdue Customer Detail Popup ─────────────────── */}
      {overdueCustomerGroup && (
        <div
          className="modal-overlay show"
          onClick={(e) => { if (e.target === e.currentTarget) setOverdueCustomerGroup(null); }}
        >
          <div className="modal" ref={modalRef} style={{ maxWidth: '620px', width: '95vw' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="profile-avatar" style={{ width: '36px', height: '36px', fontSize: '.8rem', flexShrink: 0 }}>
                  {getInitials(overdueCustomerGroup.customerName)}
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', margin: 0 }}>
                    <Link
                      href={`/customers/${overdueCustomerGroup.customerCode}`}
                      onClick={() => setOverdueCustomerGroup(null)}
                    >
                      {overdueCustomerGroup.customerName}
                    </Link>
                  </h3>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>
                    {overdueCustomerGroup.customerCode} · {overdueCustomerGroup.routeName}
                  </div>
                </div>
              </div>
              <button className="modal-close material-icons-outlined" onClick={() => setOverdueCustomerGroup(null)}>close</button>
            </div>

            <div className="modal-body" style={{ padding: '0', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Summary row */}
              <div style={{
                display: 'flex',
                gap: '0',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg)',
              }}>
                {[
                  { label: 'Missed Instalments', value: String(overdueCustomerGroup.instalments.length) },
                  { label: 'Oldest Due', value: `${overdueCustomerGroup.maxDaysOverdue}d` },
                  { label: 'Total Outstanding', value: formatCurrency(overdueCustomerGroup.totalOutstanding, currencySymbol), danger: true },
                ].map(({ label, value, danger }) => (
                  <div key={label} style={{ flex: 1, padding: '12px 16px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '.72rem', color: 'var(--text-light)', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: '.95rem', color: danger ? 'var(--danger)' : 'var(--text)' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Per-instalment list */}
              <div style={{ padding: '8px 0' }}>
                {overdueCustomerGroup.instalments.map((inst, idx) => {
                  const isPaid = inst.receivedAmount > 0;
                  return (
                    <div
                      key={inst.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 16px',
                        borderBottom: idx < overdueCustomerGroup.instalments.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      {/* Instalment number */}
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '.7rem',
                        fontWeight: 700,
                        flexShrink: 0,
                        color: 'var(--text-secondary)',
                      }}>
                        #{inst.instalmentNo}
                      </div>

                      {/* Date + loan */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '.85rem', fontWeight: 600 }}>{formatDate(inst.dueDate)}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-light)', marginTop: '1px' }}>
                          <Link href={`/loans/${inst.loan.loanCode}`} style={{ color: 'var(--primary)' }} onClick={() => setOverdueCustomerGroup(null)}>
                            {inst.loan.loanCode}
                          </Link>
                          {' · '}
                          <span className={getBadgeClass(inst.status)} style={{ textTransform: 'capitalize', fontSize: '.68rem', padding: '1px 6px' }}>
                            {inst.status}
                          </span>
                        </div>
                      </div>

                      {/* Due / outstanding */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>Due: {formatCurrency(inst.dueAmount, currencySymbol)}</div>
                        <div style={{ fontSize: '.82rem', fontWeight: 700, color: inst.outstandingAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {formatCurrency(inst.outstandingAmount, currencySymbol)}
                        </div>
                      </div>

                      {/* Days overdue */}
                      {inst.daysOverdue > 0 && (
                        <span style={{
                          flexShrink: 0,
                          fontSize: '.7rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '12px',
                          background: 'rgba(239,68,68,.1)',
                          color: 'var(--danger)',
                          whiteSpace: 'nowrap',
                        }}>
                          {inst.daysOverdue}d
                        </span>
                      )}

                      {/* Pay button */}
                      {isPaid ? (
                        isAdmin ? (
                          <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}
                            onClick={() => { setOverdueCustomerGroup(null); openModal(inst); }}>
                            <span className="material-icons-outlined" style={{ fontSize: '13px' }}>edit</span> Edit
                          </button>
                        ) : (
                          <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}
                            onClick={() => { setOverdueCustomerGroup(null); openModal(inst); }}>
                            <span className="material-icons-outlined" style={{ fontSize: '13px' }}>history_edu</span> Request
                          </button>
                        )
                      ) : (
                        <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}
                          onClick={() => { setOverdueCustomerGroup(null); openModal(inst); }}>
                          <span className="material-icons-outlined" style={{ fontSize: '13px' }}>payments</span> Pay
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOverdueCustomerGroup(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {modal && (() => {
        const uniqueRowsMap = new Map();
        [...todayInstalments, ...overdueInstalments]
          .filter(r => r.loan.id === modal.loan.id)
          .forEach(r => uniqueRowsMap.set(r.id, r));
        const uniqueRows = Array.from(uniqueRowsMap.values());
        const totalLoanOutstanding = uniqueRows.reduce((sum, r) => sum + r.outstandingAmount, 0);
        const hasOverdue = totalLoanOutstanding > modal.outstandingAmount && modal.receivedAmount === 0;

        return (
        <div className="modal-overlay show" onClick={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <div className="modal" ref={modalRef}>
            <div className="modal-header">
              <h3>{modal.receivedAmount > 0 ? (isAdmin ? 'Edit Collection' : 'Request Edit') : dict.collection.title}</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setModal(null)}>close</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem' }}>
                  <span><strong>{modal.loan.customer.name}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>{modal.loan.customer.customerCode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  <span>Loan: {modal.loan.loanCode} · #{modal.instalmentNo}</span>
                  <span>{modal.receivedAmount > 0 ? 'Previously Paid' : 'Outstanding'}: <strong style={{ color: 'var(--text)' }}>{formatCurrency(modal.receivedAmount > 0 ? modal.receivedAmount : modal.outstandingAmount, currencySymbol)}</strong></span>
                </div>
              </div>
              
              {hasOverdue && (
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.08)', 
                  border: '1px solid rgba(239, 68, 68, 0.16)', 
                  borderRadius: 'var(--radius-sm)', 
                  padding: '16px', 
                  marginBottom: '16px' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '.75rem', color: 'var(--danger)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Outstanding Balance</span>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--danger)', marginTop: '2px', lineHeight: 1.1 }}>
                        {formatCurrency(totalLoanOutstanding, currencySymbol)}
                      </div>
                      <span style={{ fontSize: '.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Includes previous overdue instalments</span>
                    </div>
                    <Link 
                      href={`/loans/${modal.loan.loanCode}`} 
                      className="btn" 
                      style={{ 
                        background: 'var(--primary)', 
                        color: '#fff', 
                        border: 'none', 
                        padding: '10px 16px', 
                        borderRadius: 'var(--radius-sm)', 
                        fontSize: '.85rem', 
                        fontWeight: 600, 
                        textDecoration: 'none',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      Outstanding Details
                    </Link>
                  </div>
                </div>
              )}
              
              {modal.receivedAmount > 0 && !isAdmin ? (
                <div className="form-group">
                  <label className="form-label">Correct Amount ({currencySymbol}) *</label>
                  <input type="number" className="form-control" value={amount} onChange={(event) => setAmount(Number(event.target.value))} min={0} required />
                  <div style={{ marginTop: '12px' }}>
                    <label className="form-label">Reason for change *</label>
                    <textarea className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this change is needed..." required rows={3} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">{modal.receivedAmount > 0 ? 'Corrected Total' : dict.collection.collected} ({currencySymbol}) *</label>
                    <input type="number" className="form-control" value={amount} onChange={(event) => setAmount(Number(event.target.value))} min={0} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select className="form-control" value={mode} onChange={(event) => setMode(event.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Remarks</label>
                    <input type="text" className="form-control" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional note" />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>{dict.loans.cancel}</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || amount < 0 || (modal.receivedAmount > 0 && !isAdmin && !reason.trim())}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span>
                {loading ? (modal.receivedAmount > 0 && !isAdmin ? 'Sending...' : dict.collection.receiving) : (modal.receivedAmount > 0 ? (isAdmin ? 'Update Payment' : 'Send Request') : 'Submit Payment')}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </>
  );
}
