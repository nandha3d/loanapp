'use client';

import { useMemo, useState } from 'react';
import { formatCurrency, formatDate, getBadgeClass, getInitials } from '@/lib/utils';
import { submitCollectionEntry } from './actions';
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
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState('cash');
  const [remarks, setRemarks] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
    const defaultAmount = instalment.outstandingAmount > 0 ? instalment.outstandingAmount : instalment.dueAmount;
    setAmount(defaultAmount);
    setMode('cash');
    setRemarks('');
    setModal(instalment);
  };

  const handleSubmit = async () => {
    if (!modal || amount <= 0) return;
    setLoading(true);
    const fd = new FormData();
    fd.set('instalmentId', modal.id);
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
                    <span>
                      {instalment.daysOverdue}d · {formatCurrency(instalment.overdueAmount, currencySymbol)}
                    </span>
                  ) : '-'}
                </td>
                <td>
                  <span className={getBadgeClass(instalment.status)} style={{ textTransform: 'capitalize' }}>
                    {instalment.status}
                  </span>
                </td>
                <td>
                  {isSettled ? (
                    <span style={{ color: 'var(--text-light)', fontSize: '.8rem' }}>Adjusted</span>
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

        {renderRows(filteredRows)}
      </div>

      {modal && (
        <div className="modal-overlay show" onClick={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>{dict.collection.title}</h3>
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
                  <span>Outstanding: <strong style={{ color: 'var(--text)' }}>{formatCurrency(modal.outstandingAmount, currencySymbol)}</strong></span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{dict.collection.collected} ({currencySymbol}) *</label>
                <input type="number" className="form-control" value={amount} onChange={(event) => setAmount(Number(event.target.value))} min={1} required />
                <p style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Extra amount will auto-adjust previous overdue first, then future instalments.
                </p>
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
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>{dict.loans.cancel}</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || amount <= 0}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span>
                {loading ? dict.collection.receiving : 'Submit Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
