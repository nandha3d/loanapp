'use client';
import React, { useState, useTransition } from 'react';
import { formatIndianCurrency } from '@/lib/accounting/utils';
import type { GstSummaryData } from './actions';
import { recomputeGstSummary, markGstFiled, recordChallan } from './actions';

type Tab = 'gstr3b' | 'gstr1' | 'tds' | 'payments';

interface Props {
  module: string;
  initialPeriod: string;
  initialSummary: GstSummaryData | null;
  tdsRows: any[];
  gstin: string | null;
}

export default function TaxClient({ module, initialPeriod, initialSummary, tdsRows, gstin }: Props) {
  const [tab, setTab] = useState<Tab>('gstr3b');
  const [period, setPeriod] = useState(initialPeriod);
  const [summary, setSummary] = useState(initialSummary);
  const [isPending, startTransition] = useTransition();
  const [ackNo, setAckNo] = useState('');
  const [showFiledModal, setShowFiledModal] = useState(false);
  const [challanModal, setChallanModal] = useState(false);
  const [challanInput, setChallanInput] = useState({
    challanNo: '',
    challanDate: '',
    amount: 0,
    deductionIds: [] as string[],
  });

  const fmt = formatIndianCurrency;

  const handleRecompute = () => {
    startTransition(async () => {
      const res = await recomputeGstSummary(period);
      if (res.ok && res.data) setSummary(res.data);
    });
  };

  const handleMarkFiled = async () => {
    if (!ackNo.trim()) return;
    const res = await markGstFiled(period, ackNo);
    if (res.ok) {
      setSummary((s) => (s ? { ...s, status: 'filed', filedAt: new Date() } : s));
      setShowFiledModal(false);
    }
  };

  if (!gstin) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ marginBottom: 12 }}>GSTIN not configured.</p>
        <a href={`/${module}/accounting/premium/settings?tab=gst`} className="btn btn-primary">
          Set up now
        </a>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'gstr3b', label: 'GSTR-3B' },
    { key: 'gstr1', label: 'GSTR-1' },
    { key: 'tds', label: 'TDS' },
    { key: 'payments', label: 'Payments' },
  ];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Tax, GST &amp; TDS</h1>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input"
          style={{ marginLeft: 'auto' }}
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '2px solid var(--border)',
          marginBottom: 20,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom:
                tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? 'var(--primary)' : 'inherit',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* GSTR-3B tab */}
      {tab === 'gstr3b' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="btn" onClick={handleRecompute} disabled={isPending}>
              {isPending ? 'Recomputing…' : 'Recompute'}
            </button>
            {summary?.status !== 'filed' && (
              <button className="btn btn-primary" onClick={() => setShowFiledModal(true)}>
                Mark as filed
              </button>
            )}
          </div>

          {summary ? (
            <div className="card" style={{ padding: 24 }}>
              {/* Output */}
              <section style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 8 }}>Outward Taxable Supplies (3.1)</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 8px' }}>
                        3.1(a) Taxable supplies (other than zero-rated)
                      </td>
                      <td style={{ textAlign: 'right' }}></td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 24px' }}>Output CGST</td>
                      <td style={{ textAlign: 'right' }}>{fmt(summary.outputCGST)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 24px' }}>Output SGST</td>
                      <td style={{ textAlign: 'right' }}>{fmt(summary.outputSGST)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 24px' }}>Output IGST</td>
                      <td style={{ textAlign: 'right' }}>{fmt(summary.outputIGST)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* Input */}
              <section style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 8 }}>Input Tax Credit (4)</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 24px' }}>Input CGST</td>
                      <td style={{ textAlign: 'right' }}>{fmt(summary.inputCGST)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 24px' }}>Input SGST</td>
                      <td style={{ textAlign: 'right' }}>{fmt(summary.inputSGST)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 24px' }}>Input IGST</td>
                      <td style={{ textAlign: 'right' }}>{fmt(summary.inputIGST)}</td>
                    </tr>
                    {summary.itcCarryForward > 0 && (
                      <tr>
                        <td style={{ padding: '4px 24px', color: 'var(--primary)' }}>
                          ITC carry-forward
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--primary)' }}>
                          {fmt(summary.itcCarryForward)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              {/* Net */}
              <section style={{ borderTop: '2px solid var(--border)', paddingTop: 12 }}>
                <h3 style={{ marginBottom: 8 }}>Tax Payable</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 8px' }}>Net CGST</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {fmt(summary.netCGST)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 8px' }}>Net SGST</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {fmt(summary.netSGST)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 8px' }}>Net IGST</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {fmt(summary.netIGST)}
                      </td>
                    </tr>
                    <tr style={{ background: '#f0fdf4' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 700 }}>Total Liability</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 18 }}>
                        {fmt(summary.totalLiability)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* Filed status */}
              <div style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
                {summary.status === 'filed' ? (
                  <span style={{ color: 'green' }}>
                    ✔ Filed{' '}
                    {summary.filedAt
                      ? new Date(summary.filedAt).toLocaleDateString('en-IN')
                      : ''}
                  </span>
                ) : (
                  <span>Not filed</span>
                )}
              </div>
            </div>
          ) : (
            <div
              className="card"
              style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}
            >
              No data. Click Recompute to generate.
            </div>
          )}
        </div>
      )}

      {/* GSTR-1 tab */}
      {tab === 'gstr1' && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 16 }}>GSTR-1 · {period}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Section</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: '4. B2B (Registered)', amt: 0 },
                { label: '5. B2C Large (≥ 2.5L inter-state)', amt: 0 },
                { label: '7. B2C (Others)', amt: summary?.outputTaxable ?? 0 },
                { label: '8. Nil-rated / Exempt / Non-GST', amt: 0 },
              ].map((r) => (
                <tr key={r.label} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }}>{r.label}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(r.amt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
            HSN-wise summary generated after recompute.
          </p>
        </div>
      )}

      {/* TDS tab */}
      {tab === 'tds' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setChallanModal(true)}>
              Record challan
            </button>
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Vendor', 'PAN', 'Section', 'Taxable', 'TDS%', 'TDS Amt', 'Status'].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign:
                            h === 'Vendor' || h === 'PAN' ? 'left' : 'right',
                          padding: '8px 10px',
                          fontSize: 13,
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {tdsRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: 'center',
                        padding: 24,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      No TDS deductions found.
                    </td>
                  </tr>
                ) : (
                  tdsRows.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px' }}>{r.vendorName}</td>
                      <td style={{ padding: '6px 10px' }}>{r.pan}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>{r.section}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                        {fmt(r.taxableAmount)}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>{r.ratePct}%</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>
                        {fmt(r.tdsAmount)}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                        <span style={{ color: r.status === 'remitted' ? 'green' : 'orange' }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments tab */}
      {tab === 'payments' && (
        <div className="card" style={{ padding: 24 }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            GST and TDS payments recorded as journal entries appear here.
          </p>
          <a
            href={`/${module}/accounting/premium/journal?sourceType=gst_payment&period=${period}`}
            className="btn"
            style={{ marginTop: 12 }}
          >
            View payment JEs →
          </a>
        </div>
      )}

      {/* Mark filed modal */}
      {showFiledModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div className="card" style={{ padding: 28, width: 380, maxWidth: '90vw' }}>
            <h3 style={{ marginBottom: 16 }}>Mark GSTR-3B as Filed</h3>
            <label style={{ display: 'block', marginBottom: 8 }}>Acknowledgement Number</label>
            <input
              className="input"
              style={{ width: '100%', marginBottom: 16 }}
              value={ackNo}
              onChange={(e) => setAckNo(e.target.value)}
              placeholder="Enter ACK number from GSTN portal"
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowFiledModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleMarkFiled}
                disabled={!ackNo.trim()}
              >
                Mark Filed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Challan modal */}
      {challanModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div className="card" style={{ padding: 28, width: 420, maxWidth: '90vw' }}>
            <h3 style={{ marginBottom: 16 }}>Record TDS Challan</h3>
            <label style={{ display: 'block', marginBottom: 4 }}>Challan No (CIN)</label>
            <input
              className="input"
              style={{ width: '100%', marginBottom: 12 }}
              value={challanInput.challanNo}
              onChange={(e) =>
                setChallanInput((p) => ({ ...p, challanNo: e.target.value }))
              }
            />
            <label style={{ display: 'block', marginBottom: 4 }}>Challan Date</label>
            <input
              className="input"
              type="date"
              style={{ width: '100%', marginBottom: 12 }}
              value={challanInput.challanDate}
              onChange={(e) =>
                setChallanInput((p) => ({ ...p, challanDate: e.target.value }))
              }
            />
            <label style={{ display: 'block', marginBottom: 4 }}>Select Deductions</label>
            <div
              style={{
                maxHeight: 160,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: 8,
                marginBottom: 12,
              }}
            >
              {tdsRows.filter((r) => r.status === 'deducted').map((r) => (
                <label
                  key={r.id}
                  style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}
                >
                  <input
                    type="checkbox"
                    checked={challanInput.deductionIds.includes(r.id)}
                    onChange={(e) =>
                      setChallanInput((p) => ({
                        ...p,
                        deductionIds: e.target.checked
                          ? [...p.deductionIds, r.id]
                          : p.deductionIds.filter((x) => x !== r.id),
                      }))
                    }
                  />
                  {r.vendorName} · {r.section} · {fmt(r.tdsAmount)}
                </label>
              ))}
              {tdsRows.filter((r) => r.status === 'deducted').length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  No pending deductions.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setChallanModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (
                    !challanInput.challanNo ||
                    !challanInput.challanDate ||
                    challanInput.deductionIds.length === 0
                  )
                    return;
                  const res = await recordChallan(challanInput);
                  if (res.ok) setChallanModal(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
