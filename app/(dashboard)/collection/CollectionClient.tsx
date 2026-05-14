'use client';

import { useMemo, useState } from 'react';
import { formatCurrency, formatDate, getBadgeClass, getInitials } from '@/lib/utils';
import { submitCollectionEntry, requestCollectionEdit } from './actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
};

type RouteOption = {
  id: string;
  name: string;
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
}: {
  todayInstalments: CollectionRow[];
  overdueInstalments: CollectionRow[];
  routes: RouteOption[];
  agentName: string;
  agentRole: string;
  routeName: string;
  currencySymbol: string;
  dict: any;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'today' | 'overdue'>('today');
  const [modal, setModal] = useState<CollectionRow | null>(null);
  const [overdueDetail, setOverdueDetail] = useState<CollectionRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState('cash');
  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const isAdmin = agentRole === 'admin' || agentRole === 'superadmin';

  const sourceRows = activeTab === 'today' ? todayInstalments : overdueInstalments;

  const filteredRows = useMemo(() => {
    return sourceRows.filter((row) => {
      const dueDate = new Date(row.dueDate).toISOString().slice(0, 10);
      const matchesDate = !dateFilter || dueDate === dateFilter;
      const search = customerFilter.trim().toLowerCase();
      const matchesCustomer = !search
        || row.loan.customer.name.toLowerCase().includes(search)
        || row.loan.customer.customerCode.toLowerCase().includes(search)
        || row.loan.loanCode.toLowerCase().includes(search);
      const matchesRoute = !routeFilter || row.loan.customer.route?.id === routeFilter;
      const matchesStatus = !statusFilter || row.status === statusFilter;
      return matchesDate && matchesCustomer && matchesRoute && matchesStatus;
    });
  }, [customerFilter, dateFilter, routeFilter, sourceRows, statusFilter]);

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

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

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
  };

  const clearFilters = () => {
    setDateFilter('');
    setCustomerFilter('');
    setRouteFilter('');
    setStatusFilter('');
  };

  const renderRows = (rows: CollectionRow[]) => (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>{dict.customers.title}</th>
            <th>{dict.sidebar.loans}</th>
            <th>Due Date</th>
            <th>Due</th>
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
                  <Link href={`/loans/${instalment.loan.id}`}>{instalment.loan.loanCode}</Link>
                  <br />
                  <span style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>#{instalment.instalmentNo}</span>
                </td>
                <td>{formatDate(instalment.dueDate)}</td>
                <td>{formatCurrency(instalment.dueAmount, currencySymbol)}</td>
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
                  {isPaid ? (
                    isAdmin ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => openModal(instalment)}>
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span> Edit
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => openModal(instalment)}>
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>history_edu</span> Request
                      </button>
                    )
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => openModal(instalment)}>
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>payments</span> Pay
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)' }}>
                {activeTab === 'today' ? dict.collection.noCollections : 'No overdue instalments match these filters.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderOverdueCards = (rows: CollectionRow[]) => {
    if (rows.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-light)' }}>
          <span className="material-icons-outlined" style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>check_circle</span>
          No overdue instalments match these filters.
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((instalment) => {
          const isPaid = instalment.receivedAmount > 0;
          const isSettled = instalment.outstandingAmount <= 0;
          return (
            <div
              key={instalment.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                opacity: isSettled ? 0.62 : 1,
                transition: 'box-shadow .15s',
              }}
            >
              {/* Avatar */}
              <div
                className="profile-avatar"
                style={{ width: '38px', height: '38px', fontSize: '.8rem', flexShrink: 0 }}
              >
                {getInitials(instalment.loan.customer.name)}
              </div>

              {/* Customer info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/customers/${instalment.loan.customer.customerCode}`} style={{ fontWeight: 600, fontSize: '.92rem' }}>
                  {instalment.loan.customer.name}
                </Link>
                <div style={{ fontSize: '.72rem', color: 'var(--text-light)', marginTop: '2px' }}>
                  {instalment.loan.customer.customerCode} · {instalment.loan.customer.route?.name || '-'}
                  {' · '}
                  <Link href={`/loans/${instalment.loan.id}`} style={{ color: 'var(--primary)' }}>
                    {instalment.loan.loanCode}
                  </Link>
                  {' #'}{instalment.instalmentNo}
                </div>
              </div>

              {/* Days overdue badge */}
              {instalment.daysOverdue > 0 && (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: '.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '20px',
                    background: 'rgba(var(--danger-rgb, 239,68,68),.12)',
                    color: 'var(--danger)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {instalment.daysOverdue}d overdue
                </span>
              )}

              {/* Outstanding amount */}
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '80px' }}>
                <div style={{ fontWeight: 700, color: instalment.outstandingAmount > 0 ? 'var(--danger)' : 'var(--success)', fontSize: '.92rem' }}>
                  {formatCurrency(instalment.outstandingAmount, currencySymbol)}
                </div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-light)' }}>outstanding</div>
              </div>

              {/* Details button */}
              <button
                className="btn btn-ghost btn-sm"
                style={{ flexShrink: 0 }}
                onClick={() => setOverdueDetail(instalment)}
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>info</span>
                Details
              </button>
            </div>
          );
        })}
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
        <span className="badge badge-active" style={{ fontSize: '.8rem', padding: '6px 14px' }}>Online</span>
      </div>

      <div className="summary-bar" style={{ marginBottom: '20px' }}>
        <div className="summary-item">
          <div className="summary-value">{formatCurrency(todayTotals.due, currencySymbol)}</div>
          <div className="summary-label">Today Due</div>
        </div>
        <div className="summary-item">
          <div className="summary-value" style={{ color: 'var(--success)' }}>{formatCurrency(todayTotals.collected, currencySymbol)}</div>
          <div className="summary-label">Adjusted Today</div>
        </div>
        <div className="summary-item">
          <div className="summary-value" style={{ color: 'var(--warning, #F59E0B)' }}>{formatCurrency(todayTotals.outstanding, currencySymbol)}</div>
          <div className="summary-label">Today Balance</div>
        </div>
        <div className="summary-item">
          <div className="summary-value" style={{ color: 'var(--danger)' }}>{formatCurrency(overdueTotals.amount, currencySymbol)}</div>
          <div className="summary-label">Overdue ({overdueTotals.count})</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">{overdueTotals.maxDays}d</div>
          <div className="summary-label">Oldest Due</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="tabs" style={{ marginBottom: '16px' }}>
          <button type="button" className={`tab ${activeTab === 'today' ? 'active' : ''}`} onClick={() => setActiveTab('today')}>
            Today's Collection ({todayInstalments.length})
          </button>
          <button type="button" className={`tab ${activeTab === 'overdue' ? 'active' : ''}`} onClick={() => setActiveTab('overdue')}>
            Overdue ({overdueInstalments.length})
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(140px, 1fr)) auto', gap: '10px', alignItems: 'end', marginBottom: '16px' }}>
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
          <button type="button" className="btn btn-ghost" onClick={clearFilters}>Clear</button>
        </div>

        {activeTab === 'today' ? renderRows(filteredRows) : renderOverdueCards(filteredRows)}
      </div>

      {/* ── Overdue Detail Popup ─────────────────────────────── */}
      {overdueDetail && (
        <div
          className="modal-overlay show"
          onClick={(e) => { if (e.target === e.currentTarget) setOverdueDetail(null); }}
        >
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1rem' }}>Instalment Details</h3>
              <button className="modal-close material-icons-outlined" onClick={() => setOverdueDetail(null)}>close</button>
            </div>
            <div className="modal-body" style={{ padding: '16px 20px' }}>
              {/* Customer & loan */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div className="profile-avatar" style={{ width: '42px', height: '42px', fontSize: '.85rem', flexShrink: 0 }}>
                  {getInitials(overdueDetail.loan.customer.name)}
                </div>
                <div>
                  <Link
                    href={`/customers/${overdueDetail.loan.customer.customerCode}`}
                    style={{ fontWeight: 700, fontSize: '.95rem' }}
                    onClick={() => setOverdueDetail(null)}
                  >
                    {overdueDetail.loan.customer.name}
                  </Link>
                  <div style={{ fontSize: '.75rem', color: 'var(--text-light)', marginTop: '2px' }}>
                    {overdueDetail.loan.customer.customerCode} · {overdueDetail.loan.customer.route?.name || '-'}
                  </div>
                </div>
              </div>

              {/* Key-value grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                background: 'var(--bg)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                marginBottom: '16px',
              }}>
                {[
                  { label: 'Loan', value: <Link href={`/loans/${overdueDetail.loan.id}`} style={{ color: 'var(--primary)' }} onClick={() => setOverdueDetail(null)}>{overdueDetail.loan.loanCode}</Link> },
                  { label: 'Instalment', value: `#${overdueDetail.instalmentNo}` },
                  { label: 'Due Date', value: formatDate(overdueDetail.dueDate) },
                  { label: 'Days Overdue', value: <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{overdueDetail.daysOverdue}d</span> },
                  { label: 'Due Amount', value: formatCurrency(overdueDetail.dueAmount, currencySymbol) },
                  { label: 'Received', value: overdueDetail.receivedAmount > 0 ? formatCurrency(overdueDetail.receivedAmount, currencySymbol) : '-' },
                  { label: 'Outstanding', value: <span style={{ color: overdueDetail.outstandingAmount > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>{formatCurrency(overdueDetail.outstandingAmount, currencySymbol)}</span> },
                  { label: 'Overdue Amount', value: overdueDetail.overdueAmount > 0 ? <span style={{ color: 'var(--danger)' }}>{formatCurrency(overdueDetail.overdueAmount, currencySymbol)}</span> : '-' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-light)', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '.85rem', fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Status */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span className={getBadgeClass(overdueDetail.status)} style={{ textTransform: 'capitalize', fontSize: '.8rem', padding: '4px 14px' }}>
                  {overdueDetail.status}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOverdueDetail(null)}>Close</button>
              <button
                className="btn btn-primary"
                onClick={() => { setOverdueDetail(null); openModal(overdueDetail); }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>payments</span>
                {overdueDetail.receivedAmount > 0 ? (isAdmin ? 'Edit Payment' : 'Request Edit') : 'Pay Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay show" onClick={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <div className="modal">
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
      )}
    </>
  );
}
