'use client';
import React, { useState, useTransition } from 'react';
import { formatIndianCurrency } from '@/lib/accounting/utils';
import { createBankAccount, getLedgerAccounts } from './actions';
import Link from 'next/link';

const fmt = formatIndianCurrency;

interface BankAccountRow {
  id: string;
  name: string;
  bankName: string;
  accountNo: string;
  ledgerCode: string;
  ledgerName: string;
  bookBalance: number;
  lastStatement: { statementTo: Date; status: string; closingBalance: number } | null;
}

interface Props {
  accounts: BankAccountRow[];
  module: string;
}

export default function BankRecListClient({ accounts, module }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: '', bankName: '', accountNo: '', ifsc: '', ledgerAccountId: '', openingBalance: '0', openingAsOf: new Date().toISOString().split('T')[0] });

  const handleOpenNew = () => {
    getLedgerAccounts().then(setLedgerAccounts);
    setShowNew(true);
  };

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createBankAccount({ ...form, openingBalance: parseFloat(form.openingBalance) || 0 });
      if (res.ok) window.location.reload();
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Bank Reconciliation</h1>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={handleOpenNew}>+ New Bank Account</button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: '#f9fafb' }}>
              {['Bank','A/c No','Ledger','Book Balance','Last Statement','Status'].map(h => (
                <th key={h} style={{ textAlign: h==='Book Balance'||h==='Status'?'right':'left', padding: '8px 12px', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>No bank accounts. Add one to get started.</td></tr>
            ) : accounts.map(ba => (
              <tr key={ba.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => window.location.href = `bank-rec/${ba.id}`}>
                <td style={{ padding: '10px 12px' }}>{ba.name}<br/><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ba.bankName}</span></td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>XXX-{ba.accountNo.slice(-4)}</td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{ba.ledgerCode} {ba.ledgerName}</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700 }}>{fmt(ba.bookBalance)}</td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>
                  {ba.lastStatement ? new Date(ba.lastStatement.statementTo).toLocaleDateString('en-IN') : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                  {!ba.lastStatement && <span style={{ color: '#6b7280' }}>●</span>}
                  {ba.lastStatement?.status === 'reconciled' && <span style={{ color: 'green' }}>✔</span>}
                  {ba.lastStatement?.status === 'imported' && <span style={{ color: 'orange' }}>⚠ needs reconciliation</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New bank account modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: 28, width: 440, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 16 }}>New Bank Account</h3>
            {[
              { label: 'Display Name', key: 'name', placeholder: 'HDFC Current' },
              { label: 'Bank Name', key: 'bankName', placeholder: 'HDFC Bank' },
              { label: 'Account No', key: 'accountNo', placeholder: '000123456789' },
              { label: 'IFSC', key: 'ifsc', placeholder: 'HDFC0001234' },
              { label: 'Opening Balance (₹)', key: 'openingBalance', placeholder: '0' },
              { label: 'Opening As Of', key: 'openingAsOf', type: 'date', placeholder: '' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>{label}</label>
                <input className="input" type={type ?? 'text'} style={{ width: '100%' }} placeholder={placeholder} value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Ledger Account (CoA)</label>
              <select className="input" style={{ width: '100%' }} value={form.ledgerAccountId} onChange={e => setForm(p => ({ ...p, ledgerAccountId: e.target.value }))}>
                <option value="">— select ledger account —</option>
                {ledgerAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!form.name || !form.ledgerAccountId || isPending} onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
