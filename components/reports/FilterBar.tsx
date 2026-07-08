'use client';

import React, { useState, useEffect } from 'react';

export type FilterValues = {
  from: string;
  to: string;
  branchId?: string;
  agentId?: string;
  routeId?: string;
  customerId?: string;
  loanType?: string;
  status?: string;
  frequency?: string;
  minAmount?: string;
  maxAmount?: string;
  paymentMode?: string;
  paymentStatus?: string;
  loanId?: string;
};

interface FilterBarProps {
  supportedFilters: string[];
  filters: FilterValues;
  onApply: (vals: FilterValues) => void;
  dict?: any;
}

export default function FilterBar({ supportedFilters, filters: initialFilters, onApply, dict }: FilterBarProps) {
  const d = dict?.reports ?? {};
  
  const [filters, setFilters] = useState<FilterValues>({
    from: initialFilters.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: initialFilters.to || new Date().toISOString().slice(0, 10),
    branchId: initialFilters.branchId || '',
    agentId: initialFilters.agentId || '',
    customerId: initialFilters.customerId || '',
    loanType: initialFilters.loanType || '',
    status: initialFilters.status || '',
    frequency: initialFilters.frequency || '',
    minAmount: initialFilters.minAmount || '',
    maxAmount: initialFilters.maxAmount || '',
    paymentMode: initialFilters.paymentMode || '',
    paymentStatus: initialFilters.paymentStatus || '',
  });

  const [branches, setBranches] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [frequencies, setFrequencies] = useState<string[]>([]);
  const [paymentModes, setPaymentModes] = useState<string[]>([]);

  // Fetch filter options dynamically
  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch('/api/v1/reports/options');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setBranches(data.data.branches || []);
            setAgents(data.data.agents || []);
            setLoanTypes(data.data.loanTypes || []);
            setStatuses(data.data.statuses || []);
            setFrequencies(data.data.frequencies || []);
            setPaymentModes(data.data.paymentModes || []);
          }
        }
      } catch (err) {
        console.error('Failed to load filter options', err);
      }
    }
    loadOptions();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handlePreset = (preset: string) => {
    const today = new Date();
    let fromDate: string;
    const toDate = today.toISOString().slice(0, 10);

    if (preset === 'today') {
      fromDate = toDate;
    } else if (preset === 'week') {
      const w = new Date(today);
      w.setDate(w.getDate() - 7);
      fromDate = w.toISOString().slice(0, 10);
    } else {
      const m = new Date(today);
      m.setMonth(m.getMonth() - 1);
      fromDate = m.toISOString().slice(0, 10);
    }

    const updated = { ...filters, from: fromDate, to: toDate };
    setFilters(updated);
    onApply(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(filters);
  };

  const isSupported = (name: string) => supportedFilters.includes(name);

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <form onSubmit={handleSubmit} className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: 0 }}>
        
        {/* Date presets */}
        {isSupported('date') && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handlePreset('today')}>{d.today || 'Today'}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handlePreset('week')}>{d.thisWeek || 'Week'}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handlePreset('month')}>{d.thisMonth || 'Month'}</button>
          </div>
        )}

        {/* Date fields */}
        {isSupported('date') && (
          <>
            <input type="date" name="from" className="form-control" style={{ width: 'auto' }} value={filters.from} onChange={handleChange} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>{d.to || 'to'}</span>
            <input type="date" name="to" className="form-control" style={{ width: 'auto' }} value={filters.to} onChange={handleChange} />
          </>
        )}

        {/* Branch select */}
        {isSupported('branch') && branches.length > 0 && (
          <select name="branchId" className="form-control" style={{ width: 'auto' }} value={filters.branchId} onChange={handleChange}>
            <option value="">{d.allBranches || 'All Branches'}</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

        {/* Agent select */}
        {isSupported('agent') && (
          <select name="agentId" className="form-control" style={{ width: 'auto' }} value={filters.agentId} onChange={handleChange}>
            <option value="">{d.allAgents || 'All Agents'}</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}

        {/* Loan Type select */}
        {isSupported('loanType') && (
          <select name="loanType" className="form-control" style={{ width: 'auto' }} value={filters.loanType} onChange={handleChange}>
            <option value="">{d.allTypes || 'All Types'}</option>
            {loanTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        {/* Status select */}
        {isSupported('status') && (
          <select name="status" className="form-control" style={{ width: 'auto' }} value={filters.status} onChange={handleChange}>
            <option value="">{d.allStatuses || 'All Statuses'}</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {/* Frequency select */}
        {isSupported('frequency') && (
          <select name="frequency" className="form-control" style={{ width: 'auto' }} value={filters.frequency} onChange={handleChange}>
            <option value="">{d.allFrequencies || 'All Frequencies'}</option>
            {frequencies.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}

        {/* Collection/Payment Mode select */}
        {isSupported('paymentMode') && (
          <select name="paymentMode" className="form-control" style={{ width: 'auto' }} value={filters.paymentMode} onChange={handleChange}>
            <option value="">{d.allModes || 'All Modes'}</option>
            {paymentModes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        {/* Amount range */}
        {isSupported('amount') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type="number" name="minAmount" placeholder="Min" className="form-control" style={{ width: '80px' }} value={filters.minAmount} onChange={handleChange} />
            <span style={{ fontSize: '.8rem' }}>-</span>
            <input type="number" name="maxAmount" placeholder="Max" className="form-control" style={{ width: '80px' }} value={filters.maxAmount} onChange={handleChange} />
          </div>
        )}

        <button type="submit" className="btn btn-primary">{d.apply || 'Apply'}</button>
      </form>
    </div>
  );
}
