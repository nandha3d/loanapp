'use client';

import React, { useState, useEffect } from 'react';
import FilterBar, { FilterValues } from './FilterBar';
import { ReportPayload, getReportLabel } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/utils';

interface ReportShellProps {
  slug: string;
  title: string;
  supportedFilters: string[];
  initialFilters: FilterValues;
  dict: any;
  subscription: any;
}

export default function ReportShell({
  slug,
  title,
  supportedFilters,
  initialFilters,
  dict,
  subscription
}: ReportShellProps) {
  const d = dict?.reports ?? {};
  
  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch report data based on filters
  const fetchData = async (currentFilters: FilterValues) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      Object.entries(currentFilters).forEach(([key, val]) => {
        if (val) q.set(key, val);
      });

      const res = await fetch(`/api/v1/reports/${slug}?${q.toString()}`);
      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        setPayload(data.data);
      } else {
        throw new Error(data.message || 'Failed to load report data');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(filters);
  }, [filters]);

  const handleApplyFilters = (newFilters: FilterValues) => {
    setFilters(newFilters);
  };

  const getExportUrl = (format: 'pdf' | 'excel' | 'csv') => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val) q.set(key, val);
    });
    q.set('format', format);
    return `/api/v1/reports/${slug}/export?${q.toString()}`;
  };

  const formatCell = (val: any, type?: string, currencySymbol = '₹') => {
    if (val === undefined || val === null) return '—';
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    
    if (type === 'currency' && typeof val === 'number') {
      return formatCurrency(val, currencySymbol);
    }
    if (type === 'percent' && typeof val === 'number') {
      return `${val}%`;
    }
    if (type === 'badge') {
      let badgeClass = 'badge badge-secondary';
      if (['active', 'paid', 'success', 'good'].includes(String(val).toLowerCase())) {
        badgeClass = 'badge badge-success';
      } else if (['overdue', 'missed', 'failed', 'bad', 'danger'].includes(String(val).toLowerCase())) {
        badgeClass = 'badge badge-danger';
      } else if (['partial', 'pending', 'warn', 'warning'].includes(String(val).toLowerCase())) {
        badgeClass = 'badge badge-warning';
      }
      return <span className={badgeClass}>{String(val)}</span>;
    }
    return String(val);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>{getReportLabel(dict?.reports?.title?.[slug] || payload?.title || title, dict)}</h2>
        <button onClick={handlePrint} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>print</span>
          {d.print || 'Print'}
        </button>
      </div>

      <FilterBar
        supportedFilters={supportedFilters}
        filters={filters}
        onApply={handleApplyFilters}
        dict={dict}
      />

      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
          {d.loading || 'Loading report...'}
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <>
          {/* KPI summaries */}
          {payload.kpis && payload.kpis.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              {payload.kpis.map((kpi, idx) => (
                <div key={idx} className="card" style={{ flex: '1 1 200px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{getReportLabel(kpi.label, dict)}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{kpi.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Export Row */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <a href={getExportUrl('csv')} className="btn btn-secondary btn-sm" download>
              <span className="material-icons-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>download</span>
              {d.csvExport || 'Export CSV'}
            </a>
            {subscription?.receiptPdfAllowed ? (
              <>
                <a href={getExportUrl('excel')} className="btn btn-secondary btn-sm" download>
                  <span className="material-icons-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>download</span>
                  {d.excelExport || 'Export Excel'}
                </a>
                <a href={getExportUrl('pdf')} className="btn btn-primary btn-sm" target="_blank" rel="noopener noreferrer">
                  <span className="material-icons-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>picture_as_pdf</span>
                  {d.pdfExport || 'Export PDF'}
                </a>
              </>
            ) : (
              <>
                <button disabled className="btn btn-secondary btn-sm" style={{ opacity: 0.6, cursor: 'not-allowed' }} title={d.unlockExcel || 'Unlock Excel under Premium Subscription'}>
                  <span className="material-icons-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>lock</span>
                  Export Excel
                </button>
                <button disabled className="btn btn-secondary btn-sm" style={{ opacity: 0.6, cursor: 'not-allowed' }} title={d.unlockPdf || 'Unlock PDF under Premium Subscription'}>
                  <span className="material-icons-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>lock</span>
                  Export PDF
                </button>
              </>
            )}
          </div>

          {/* Data Table */}
          <div className="card">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    {payload.columns.map((col, idx) => (
                      <th key={idx} style={{ textAlign: col.align || 'left' }}>
                        {getReportLabel(col.label, dict)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload.rows.length === 0 ? (
                    <tr>
                      <td colSpan={payload.columns.length} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-light)' }}>
                        {d.noData || 'No matching records found'}
                      </td>
                    </tr>
                  ) : (
                    payload.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {payload.columns.map((col, cIdx) => (
                          <td key={cIdx} style={{ textAlign: col.align || 'left' }}>
                            {formatCell(row[col.key], col.type, payload.meta.currencySymbol)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {payload.totals && payload.rows.length > 0 && (
                  <tfoot>
                    <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)', background: 'var(--bg-card)' }}>
                      {payload.columns.map((col, idx) => {
                        if (idx === 0) {
                          return <td key={idx}>{d.totals || 'TOTAL'}</td>;
                        }
                        const totalVal = col.total && payload.totals ? payload.totals[col.key] : null;
                        return (
                          <td key={idx} style={{ textAlign: col.align || 'left' }}>
                            {totalVal !== null ? formatCell(totalVal, col.type, payload.meta.currencySymbol) : ''}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
