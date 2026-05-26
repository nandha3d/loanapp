'use client';
import React, { useState, useTransition, useEffect } from 'react';
import { formatIndianCurrency } from '@/lib/accounting/utils';
import {
  createBudget,
  getBudgetWithLines,
  updateBudgetLine,
  addBudgetLine,
  approveBudget,
  archiveBudget,
  getVarianceForPeriod,
  getActiveAccounts,
} from './actions';

// Indian FY order: April … March
const MONTHS_DISPLAY = [
  'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
  'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar',
];
// Corresponding DB field names (calendar months)
const MONTH_FIELDS = [
  'apr', 'may', 'jun', 'jul', 'aug', 'sep',
  'oct', 'nov', 'dec', 'jan', 'feb', 'mar',
];

const fmt = formatIndianCurrency;

type BudgetRow = {
  id: string;
  name: string;
  fiscalYear: string;
  status: string;
};

type View = 'editor' | 'variance';

interface Props {
  budgets: BudgetRow[];
  currentFy: string;
  currentPeriod: string;
}

export default function BudgetClient({ budgets, currentFy, currentPeriod }: Props) {
  const [view, setView] = useState<View>('editor');
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(
    budgets[0]?.id ?? null,
  );
  const [budgetDetail, setBudgetDetail] = useState<any>(null);
  const [varianceRows, setVarianceRows] = useState<any[]>([]);
  const [period, setPeriod] = useState(currentPeriod);
  const [isPending, startTransition] = useTransition();
  const [showNewModal, setShowNewModal] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState('');
  const [newBudgetFy, setNewBudgetFy] = useState(currentFy);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [addAccountId, setAddAccountId] = useState('');

  useEffect(() => {
    if (!selectedBudgetId) return;
    getBudgetWithLines(selectedBudgetId).then(setBudgetDetail);
  }, [selectedBudgetId]);

  useEffect(() => {
    if (!selectedBudgetId || view !== 'variance') return;
    getVarianceForPeriod(selectedBudgetId, period).then(setVarianceRows);
  }, [selectedBudgetId, period, view]);

  useEffect(() => {
    getActiveAccounts().then(setAccountsList);
  }, []);

  const refreshDetail = () => {
    if (selectedBudgetId) getBudgetWithLines(selectedBudgetId).then(setBudgetDetail);
  };

  const handleCellBlur = (lineId: string, field: string, value: string) => {
    const num = parseFloat(value) || 0;
    startTransition(async () => {
      await updateBudgetLine(lineId, field, num);
      refreshDetail();
    });
  };

  const handleApprove = () => {
    if (!selectedBudgetId) return;
    startTransition(async () => {
      await approveBudget(selectedBudgetId);
      refreshDetail();
    });
  };

  const handleArchive = () => {
    if (!selectedBudgetId) return;
    startTransition(async () => {
      await archiveBudget(selectedBudgetId);
      refreshDetail();
    });
  };

  const handleAddAccount = () => {
    if (!selectedBudgetId || !addAccountId) return;
    startTransition(async () => {
      await addBudgetLine(selectedBudgetId, addAccountId);
      refreshDetail();
      setAddAccountId('');
    });
  };

  const isApproved = budgetDetail?.status === 'approved';

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
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Budget</h1>
        <select
          className="input"
          value={selectedBudgetId ?? ''}
          onChange={(e) => setSelectedBudgetId(e.target.value || null)}
          style={{ minWidth: 220 }}
        >
          <option value="">— select budget —</option>
          {budgets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.fiscalYear}) · {b.status}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => setShowNewModal(true)}>
          + New budget
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            className={`btn${view === 'editor' ? ' btn-primary' : ''}`}
            onClick={() => setView('editor')}
          >
            Editor
          </button>
          <button
            className={`btn${view === 'variance' ? ' btn-primary' : ''}`}
            onClick={() => setView('variance')}
          >
            Variance
          </button>
        </div>
      </div>

      {/* Editor view */}
      {budgetDetail && view === 'editor' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 12,
                background: isApproved ? '#d1fae5' : '#fef3c7',
                fontSize: 13,
              }}
            >
              {isApproved ? '✔ Approved' : budgetDetail.status}
            </span>
            {!isApproved && (
              <button className="btn btn-primary" onClick={handleApprove} disabled={isPending}>
                Approve
              </button>
            )}
            <button className="btn" onClick={handleArchive} disabled={isPending}>
              Archive
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: '#f9fafb' }}>
                  <th
                    style={{ textAlign: 'left', padding: '8px 10px', minWidth: 180 }}
                  >
                    Account
                  </th>
                  {MONTHS_DISPLAY.map((m) => (
                    <th
                      key={m}
                      style={{ textAlign: 'right', padding: '8px 6px', minWidth: 80 }}
                    >
                      {m}
                    </th>
                  ))}
                  <th
                    style={{ textAlign: 'right', padding: '8px 10px', minWidth: 100 }}
                  >
                    Annual
                  </th>
                </tr>
              </thead>
              <tbody>
                {budgetDetail.lines.map((line: any) => (
                  <tr key={line.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px', fontSize: 13 }}>
                      {line.account?.code} {line.account?.name}
                    </td>
                    {MONTH_FIELDS.map((field) => (
                      <td key={field} style={{ padding: '2px 4px' }}>
                        <input
                          type="number"
                          defaultValue={Number(line[field] ?? 0)}
                          disabled={isApproved}
                          onBlur={(e) => handleCellBlur(line.id, field, e.target.value)}
                          style={{
                            width: 76,
                            textAlign: 'right',
                            border: '1px solid transparent',
                            borderRadius: 4,
                            padding: '4px 6px',
                            background: 'transparent',
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = 'var(--primary)';
                          }}
                          onBlurCapture={(e) => {
                            e.target.style.borderColor = 'transparent';
                          }}
                        />
                      </td>
                    ))}
                    <td
                      style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}
                    >
                      {fmt(Number(line.annual ?? 0))}
                    </td>
                  </tr>
                ))}
                {budgetDetail.lines.length === 0 && (
                  <tr>
                    <td
                      colSpan={14}
                      style={{
                        textAlign: 'center',
                        padding: 24,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      No budget lines yet. Add accounts below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!isApproved && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <select
                className="input"
                value={addAccountId}
                onChange={(e) => setAddAccountId(e.target.value)}
                style={{ minWidth: 220 }}
              >
                <option value="">+ Add account</option>
                {accountsList
                  .filter(
                    (a) => !budgetDetail.lines.find((l: any) => l.accountId === a.id),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} {a.name}
                    </option>
                  ))}
              </select>
              <button
                className="btn"
                onClick={handleAddAccount}
                disabled={!addAccountId || isPending}
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* Variance view */}
      {view === 'variance' && (
        <div>
          <div
            style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}
          >
            <input
              type="month"
              className="input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
          {varianceRows.length === 0 ? (
            <div
              className="card"
              style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              No budget lines. Select an approved budget and a period.
            </div>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table
                style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '2px solid var(--border)',
                      background: '#f9fafb',
                    }}
                  >
                    {['Account', 'Budget', 'Actual', 'Var ₹', 'Var %'].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === 'Account' ? 'left' : 'right',
                          padding: '8px 10px',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {varianceRows.map((r) => {
                    const isIncomeLine = r.classType === 'income';
                    const unfav = isIncomeLine ? r.varAmt < 0 : r.varAmt > 0;
                    const varColor = unfav ? '#ef4444' : '#22c55e';
                    return (
                      <tr
                        key={r.accountId}
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        <td style={{ padding: '6px 10px' }}>
                          {r.code} {r.name}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px 10px' }}>
                          {fmt(r.budgetAmt)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px 10px' }}>
                          {fmt(r.actualAmt)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            padding: '6px 10px',
                            color: varColor,
                            fontWeight: 600,
                          }}
                        >
                          {fmt(r.varAmt)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            padding: '6px 10px',
                            color: varColor,
                          }}
                        >
                          {Math.abs(r.varPct) > 15 ? '△ ' : ''}
                          {r.varPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedBudgetId && (
        <div
          className="card"
          style={{
            padding: 32,
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          No budget selected. Create a budget to get started.
        </div>
      )}

      {/* New budget modal */}
      {showNewModal && (
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
            <h3 style={{ marginBottom: 16 }}>New Budget</h3>
            <label style={{ display: 'block', marginBottom: 4 }}>Name</label>
            <input
              className="input"
              style={{ width: '100%', marginBottom: 12 }}
              value={newBudgetName}
              onChange={(e) => setNewBudgetName(e.target.value)}
              placeholder="FY 2026-27 Operating Budget"
            />
            <label style={{ display: 'block', marginBottom: 4 }}>Fiscal Year</label>
            <input
              className="input"
              style={{ width: '100%', marginBottom: 16 }}
              value={newBudgetFy}
              onChange={(e) => setNewBudgetFy(e.target.value)}
              placeholder="2026-27"
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowNewModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!newBudgetName || isPending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await createBudget({
                      name: newBudgetName,
                      fiscalYear: newBudgetFy,
                    });
                    if (res.ok && res.data) {
                      window.location.reload();
                    }
                  });
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
