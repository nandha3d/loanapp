'use client';
import React, { useState, useTransition } from 'react';
import { formatIndianCurrency } from '@/lib/accounting/utils';
import { createVendor, updateVendor, deactivateVendor, createBill, postBill, payBill, cancelBill, getAgeingReport, getExpenseAccounts, getBankAccounts } from './actions';
import {
  AcStyles, AcModal, AcButton, AcBadge, AcTable,
  AcField, AcTextarea, AcInput, AcSelect, AcPageHeader, AcTabs,
  AcSectionHead, AcAmt, AcEmpty, AcAlert,
} from '../ui';

const fmt = formatIndianCurrency;
type Tab = 'vendors' | 'bills' | 'payments';

interface Vendor {
  id: string; name: string; gstin: string | null; pan: string | null;
  phone: string | null; tdsSection: string | null; isActive: boolean;
  openAP: number; billCount: number;
}
interface Bill {
  id: string; billNo: string;
  vendor: { id: string; name: string };
  billDate: string | Date; dueDate: string | Date | null;
  totalAmount: number | string; paidAmount: number | string; status: string;
}
interface Props { vendors: Vendor[]; bills: Bill[]; }

export default function VendorsClient({ vendors: initialVendors, bills: initialBills }: Props) {
  const [tab, setTab] = useState<Tab>('vendors');
  const [vendors] = useState(initialVendors);
  const [bills, setBills] = useState(initialBills);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState('');

  // Vendor modal
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorForm, setVendorForm] = useState({
    name: '', gstin: '', pan: '', email: '', phone: '', address: '',
    tdsSection: '', bankName: '', bankAccountNo: '', bankIfsc: '',
  });

  // Bill modal
  const [showBillModal, setShowBillModal] = useState(false);
  const [billForm, setBillForm] = useState({
    vendorId: '', billNo: '', billDate: new Date().toISOString().split('T')[0], dueDate: '', category: '', description: '',
  });
  const [billLines, setBillLines] = useState<Array<{ accountId: string; description: string; amount: number; gstRate: number }>>([
    { accountId: '', description: '', amount: 0, gstRate: 0 },
  ]);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);

  // Pay modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingBill, setPayingBill]   = useState<Bill | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], payFromAccountId: '', tdsAmount: '0', reference: '', narration: '' });
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  // Ageing
  const [showAgeing, setShowAgeing] = useState(false);
  const [ageingRows, setAgeingRows] = useState<any[]>([]);

  const [searchVendor, setSearchVendor] = useState('');
  const [searchBill, setSearchBill]     = useState('');
  const [billStatusFilter, setBillStatusFilter] = useState('');

  const filteredVendors = vendors.filter(v => !searchVendor || v.name.toLowerCase().includes(searchVendor.toLowerCase()));
  const filteredBills = bills.filter(b => {
    if (searchBill && !b.billNo.toLowerCase().includes(searchBill.toLowerCase()) && !b.vendor.name.toLowerCase().includes(searchBill.toLowerCase())) return false;
    if (billStatusFilter && b.status !== billStatusFilter) return false;
    return true;
  });

  const billTotals = billLines.reduce((acc, l) => {
    const gst = l.amount * (l.gstRate / 100);
    return { subtotal: acc.subtotal + l.amount, gstAmount: acc.gstAmount + gst, total: acc.total + l.amount + gst };
  }, { subtotal: 0, gstAmount: 0, total: 0 });

  const openVendorModal = (vendor?: Vendor) => {
    if (vendor) {
      setEditingVendor(vendor);
      setVendorForm({ name: vendor.name, gstin: vendor.gstin ?? '', pan: vendor.pan ?? '', email: '', phone: vendor.phone ?? '', address: '', tdsSection: vendor.tdsSection ?? '', bankName: '', bankAccountNo: '', bankIfsc: '' });
    } else {
      setEditingVendor(null);
      setVendorForm({ name: '', gstin: '', pan: '', email: '', phone: '', address: '', tdsSection: '', bankName: '', bankAccountNo: '', bankIfsc: '' });
    }
    setShowVendorModal(true);
  };

  const saveVendor = () => {
    startTransition(async () => {
      const res = editingVendor ? await updateVendor(editingVendor.id, vendorForm) : await createVendor(vendorForm);
      if (!res.ok) { setErr(res.error ?? 'Error saving vendor'); return; }
      setShowVendorModal(false);
      window.location.reload();
    });
  };

  const openBillModal = async () => {
    setExpenseAccounts(await getExpenseAccounts());
    setBillLines([{ accountId: '', description: '', amount: 0, gstRate: 0 }]);
    setShowBillModal(true);
  };

  const createBillHandler = () => {
    startTransition(async () => {
      const res = await createBill({ ...billForm, lines: billLines });
      if (res.ok) {
        const vendor = vendors.find(v => v.id === billForm.vendorId);
        setBills(p => [{
          ...(res.data as any),
          vendor: vendor ? { id: vendor.id, name: vendor.name } : { id: billForm.vendorId, name: 'Vendor' },
          paidAmount: (res.data as any).paidAmount ?? 0,
        }, ...p]);
        setShowBillModal(false);
      }
      else setErr(res.error ?? 'Error creating bill');
    });
  };

  const handlePostBill = (billId: string) => {
    startTransition(async () => {
      const res = await postBill(billId);
      if (res.ok) setBills(p => p.map(b => b.id === billId ? { ...b, status: (res.data as any)?.pending ? 'pending_approval' : 'unpaid' } : b));
      else setErr(res.error ?? 'Error');
    });
  };

  const openPayModal = async (bill: Bill) => {
    const accts = await getBankAccounts();
    setBankAccounts(accts);
    setPayingBill(bill);
    setPayForm({ amount: (Number(bill.totalAmount) - Number(bill.paidAmount)).toFixed(2), date: new Date().toISOString().split('T')[0], payFromAccountId: accts[0]?.id ?? '', tdsAmount: '0', reference: '', narration: '' });
    setShowPayModal(true);
  };

  const doPay = () => {
    if (!payingBill) return;
    startTransition(async () => {
      const res = await payBill(payingBill.id, {
        amount: parseFloat(payForm.amount) || 0,
        date: payForm.date,
        payFromAccountId: payForm.payFromAccountId,
        tdsAmount: parseFloat(payForm.tdsAmount) || 0,
        reference: payForm.reference,
        narration: payForm.narration,
      });
      if (res.ok) {
        const amount = parseFloat(payForm.amount) || 0;
        setBills(p => p.map(b => {
          if (b.id !== payingBill.id) return b;
          const paidAmount = Number(b.paidAmount) + amount;
          const status = paidAmount + 0.01 >= Number(b.totalAmount) ? 'paid' : 'partial';
          return { ...b, paidAmount, status };
        }));
        setShowPayModal(false);
      }
      else setErr((res as any).error ?? 'Payment error');
    });
  };

  // ─── Table column definitions ──────────────────────────────────────────
  const vendorCols = [
    { key: 'name',  label: 'Name',        render: (v: Vendor) => <span style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => openVendorModal(v)}>{v.name}</span> },
    { key: 'gstin', label: 'GSTIN',       render: (v: Vendor) => <span style={{ fontSize: '0.8rem' }}>{v.gstin ?? '—'}</span> },
    { key: 'phone', label: 'Phone',       render: (v: Vendor) => v.phone ?? '—' },
    { key: 'tds',   label: 'TDS Section', render: (v: Vendor) => <span style={{ fontSize: '0.8rem' }}>{v.tdsSection ?? '—'}</span> },
    { key: 'ap',    label: 'Open AP', align: 'right' as const, render: (v: Vendor) => <AcAmt value={v.openAP} color={v.openAP > 0 ? '#ef4444' : undefined} /> },
    { key: 'bills', label: 'Bills',       render: (v: Vendor) => v.billCount },
    { key: 'status', label: 'Status',     render: (v: Vendor) => <AcBadge status={v.isActive ? 'active' : 'closed'}>{v.isActive ? 'Active' : 'Inactive'}</AcBadge> },
    {
      key: 'actions', label: '', render: (v: Vendor) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {v.isActive && <AcButton size="sm" variant="danger" onClick={() => startTransition(async () => {
            const res = await deactivateVendor(v.id);
            if (!res.ok) { setErr(res.error ?? 'Error deactivating vendor'); return; }
            window.location.reload();
          })}>✕</AcButton>}
        </div>
      ),
    },
  ];

  const billCols = [
    { key: 'billNo',  label: 'Bill No',  render: (b: Bill) => <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{b.billNo}</span> },
    { key: 'vendor',  label: 'Vendor',   render: (b: Bill) => b.vendor.name },
    { key: 'date',    label: 'Date',     render: (b: Bill) => <span style={{ fontSize: '0.8rem' }}>{new Date(b.billDate).toLocaleDateString('en-IN')}</span> },
    {
      key: 'due', label: 'Due', render: (b: Bill) => {
        const isOverdue = b.dueDate && new Date(b.dueDate) < new Date() && b.status !== 'paid';
        return <span style={{ fontSize: '0.8rem', color: isOverdue ? '#ef4444' : 'inherit' }}>
          {b.dueDate ? new Date(b.dueDate).toLocaleDateString('en-IN') : '—'}
        </span>;
      },
    },
    { key: 'total',  label: 'Amount', align: 'right' as const, render: (b: Bill) => <AcAmt value={Number(b.totalAmount)} /> },
    { key: 'paid',   label: 'Paid',   align: 'right' as const, render: (b: Bill) => <AcAmt value={Number(b.paidAmount)} /> },
    { key: 'status', label: 'Status', render: (b: Bill) => <AcBadge status={b.status}>{b.status.replace(/_/g,' ')}</AcBadge> },
    {
      key: 'action', label: '', render: (b: Bill) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {b.status === 'draft' && <AcButton size="sm" variant="ghost" onClick={() => handlePostBill(b.id)} loading={isPending}>Post</AcButton>}
          {['unpaid','partial'].includes(b.status) && <AcButton size="sm" variant="primary" onClick={() => openPayModal(b)} loading={isPending}>Pay</AcButton>}
        </div>
      ),
    },
  ];

  const ageingCols = [
    { key: 'name', label: 'Vendor', render: (r: any) => r.name },
    { key: 'b0',   label: '0-30 days',  align: 'right' as const, render: (r: any) => <AcAmt value={r.b0} /> },
    { key: 'b30',  label: '30-60 days', align: 'right' as const, render: (r: any) => <AcAmt value={r.b30} /> },
    { key: 'b60',  label: '60-90 days', align: 'right' as const, render: (r: any) => <AcAmt value={r.b60} /> },
    { key: 'b90',  label: '90+ days',   align: 'right' as const, render: (r: any) => <AcAmt value={r.b90} /> },
    { key: 'total',label: 'Total',  align: 'right' as const, render: (r: any) => <AcAmt value={r.total} color={r.total > 0 ? '#ef4444' : undefined} /> },
  ];

  return (
    <>
      <AcStyles />

      <AcPageHeader
        title="Vendors & Bills"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <AcButton variant="ghost" icon="bar_chart" onClick={async () => { setAgeingRows(await getAgeingReport()); setShowAgeing(true); }}>Ageing</AcButton>
            {tab === 'vendors' && <AcButton variant="primary" icon="add" onClick={() => openVendorModal()}>Add Vendor</AcButton>}
            {tab === 'bills'   && <AcButton variant="primary" icon="receipt" onClick={openBillModal}>New Bill</AcButton>}
          </div>
        }
      />

      {err && <div style={{ marginBottom: 12 }}><AcAlert type="error">{err} <AcButton variant="link" size="sm" onClick={() => setErr('')}>✕</AcButton></AcAlert></div>}

      <AcTabs
        tabs={[{ key: 'vendors', label: 'Vendors' }, { key: 'bills', label: 'Bills' }, { key: 'payments', label: 'Payments' }]}
        active={tab}
        onChange={k => setTab(k as Tab)}
      />

      {/* Vendors tab */}
      {tab === 'vendors' && (
        <>
          <AcInput placeholder="Search vendors…" value={searchVendor} onChange={e => setSearchVendor(e.target.value)} style={{ marginBottom: 12, maxWidth: 320 }} />
          <div className="ac-card" style={{ padding: 0, overflow: 'hidden' }}>
            <AcTable<Vendor> cols={vendorCols} rows={filteredVendors} keyFn={v => v.id} empty="No vendors. Add one to get started." />
          </div>
        </>
      )}

      {/* Bills tab */}
      {tab === 'bills' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <AcInput placeholder="Search bills…" value={searchBill} onChange={e => setSearchBill(e.target.value)} style={{ maxWidth: 200 }} />
            <AcSelect value={billStatusFilter} onChange={e => setBillStatusFilter(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="">All statuses</option>
              {['draft','unpaid','partial','paid','cancelled','pending_approval'].map(s => <option key={s} value={s}>{s}</option>)}
            </AcSelect>
          </div>
          <div className="ac-card" style={{ padding: 0, overflow: 'hidden' }}>
            <AcTable<Bill> cols={billCols} rows={filteredBills} keyFn={b => b.id} empty="No bills found." />
          </div>
        </>
      )}

      {/* Payments tab */}
      {tab === 'payments' && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
          <AcEmpty icon="payments" text="Payment history shown in Bills tab (paid/partial status)." action={
            <AcButton as="a" variant="primary" href="journal?sourceType=bill_payment">View payment JEs →</AcButton>
          } />
        </div>
      )}

      {/* Vendor modal */}
      <AcModal
        open={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        title={editingVendor ? 'Edit Vendor' : 'New Vendor'}
        width={520}
        footer={
          <>
            <AcButton variant="ghost" onClick={() => setShowVendorModal(false)}>Cancel</AcButton>
            <AcButton variant="primary" loading={isPending} onClick={saveVendor}>Save</AcButton>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Name',                key: 'name',         full: true, required: true },
            { label: 'GSTIN',               key: 'gstin' },
            { label: 'PAN',                 key: 'pan' },
            { label: 'Email',               key: 'email' },
            { label: 'Phone',               key: 'phone' },
            { label: 'TDS Section',         key: 'tdsSection' },
            { label: 'Bank Name',           key: 'bankName' },
            { label: 'Bank Account No',     key: 'bankAccountNo' },
            { label: 'IFSC',                key: 'bankIfsc' },
            { label: 'Address',             key: 'address',      full: true },
          ].map(({ label, key, full, required }) => (
            <div key={key} style={full ? { gridColumn: '1/-1' } : {}}>
              <AcField label={label} required={required}>
                <AcInput required={required} value={(vendorForm as any)[key]} onChange={e => setVendorForm(p => ({ ...p, [key]: e.target.value }))} />
              </AcField>
            </div>
          ))}
        </div>
      </AcModal>

      {/* Bill modal */}
      <AcModal
        open={showBillModal}
        onClose={() => setShowBillModal(false)}
        title="New Bill"
        width={700}
        footer={
          <>
            <AcButton variant="ghost" onClick={() => setShowBillModal(false)}>Cancel</AcButton>
            <AcButton variant="primary" loading={isPending} onClick={createBillHandler}>Save as Draft</AcButton>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <AcField label="Vendor" required>
              <AcSelect value={billForm.vendorId} onChange={e => setBillForm(p => ({ ...p, vendorId: e.target.value }))}>
                <option value="">— select vendor —</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </AcSelect>
            </AcField>
          </div>
          <AcField label="Bill No" required>
            <AcInput value={billForm.billNo} onChange={e => setBillForm(p => ({ ...p, billNo: e.target.value }))} />
          </AcField>
          <AcField label="Bill Date">
            <AcInput type="date" value={billForm.billDate} onChange={e => setBillForm(p => ({ ...p, billDate: e.target.value }))} />
          </AcField>
          <AcField label="Due Date">
            <AcInput type="date" value={billForm.dueDate} onChange={e => setBillForm(p => ({ ...p, dueDate: e.target.value }))} />
          </AcField>
        </div>

        <AcSectionHead title="Lines" action={
          <AcButton size="sm" variant="ghost" icon="add" onClick={() => setBillLines(p => [...p, { accountId: '', description: '', amount: 0, gstRate: 0 }])}>Add Line</AcButton>
        } />
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table className="ac-table">
            <thead><tr>
              <th>Description</th><th>Account</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>GST %</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th></th>
            </tr></thead>
            <tbody>
              {billLines.map((line, i) => {
                const lineTotal = line.amount + line.amount * (line.gstRate / 100);
                return (
                  <tr key={i}>
                    <td><AcInput value={line.description} onChange={e => setBillLines(p => p.map((l, j) => j === i ? { ...l, description: e.target.value } : l))} style={{ minWidth: 120 }} /></td>
                    <td>
                      <AcSelect value={line.accountId} onChange={e => setBillLines(p => p.map((l, j) => j === i ? { ...l, accountId: e.target.value } : l))} style={{ minWidth: 140 }}>
                        <option value="">— select —</option>
                        {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                      </AcSelect>
                    </td>
                    <td><AcInput type="number" value={line.amount} onChange={e => setBillLines(p => p.map((l, j) => j === i ? { ...l, amount: parseFloat(e.target.value) || 0 } : l))} style={{ width: 90, textAlign: 'right' }} /></td>
                    <td>
                      <AcSelect value={line.gstRate} onChange={e => setBillLines(p => p.map((l, j) => j === i ? { ...l, gstRate: parseFloat(e.target.value) } : l))} style={{ minWidth: 80 }}>
                        {[0,5,12,18,28].map(r => <option key={r} value={r}>{r === 0 ? 'Exempt' : `${r}%`}</option>)}
                      </AcSelect>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(lineTotal)}</td>
                    <td><AcButton variant="link" size="sm" onClick={() => setBillLines(p => p.filter((_, j) => j !== i))} style={{ color: '#ef4444' }}>✕</AcButton></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, fontSize: '0.87rem' }}>
          <div>Subtotal: <strong>{fmt(billTotals.subtotal)}</strong></div>
          <div>GST: <strong>{fmt(billTotals.gstAmount)}</strong></div>
          <div style={{ fontSize: '1rem' }}>Total: <strong>{fmt(billTotals.total)}</strong></div>
        </div>
      </AcModal>

      {/* Pay modal */}
      <AcModal
        open={showPayModal && !!payingBill}
        onClose={() => setShowPayModal(false)}
        title="Pay Bill"
        width={440}
        footer={
          <>
            <AcButton variant="ghost" onClick={() => setShowPayModal(false)}>Cancel</AcButton>
            <AcButton variant="primary" loading={isPending} onClick={doPay}>Pay</AcButton>
          </>
        }
      >
        {payingBill && (
          <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: '0.87rem' }}>
            {payingBill.vendor.name} · {payingBill.billNo} · Outstanding: {fmt(Number(payingBill.totalAmount) - Number(payingBill.paidAmount))}
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <AcField label="Amount to Pay" required><AcInput type="number" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} /></AcField>
          <AcField label="Date"><AcInput type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))} /></AcField>
          <AcField label="TDS Deduction"><AcInput type="number" value={payForm.tdsAmount} onChange={e => setPayForm(p => ({ ...p, tdsAmount: e.target.value }))} /></AcField>
          <AcField label="Reference (UTR/Cheque)"><AcInput value={payForm.reference} onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))} /></AcField>
          <div style={{ gridColumn: '1/-1' }}>
            <AcField label="Pay From" required>
              <AcSelect value={payForm.payFromAccountId} onChange={e => setPayForm(p => ({ ...p, payFromAccountId: e.target.value }))}>
                <option value="">— select bank/cash —</option>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </AcSelect>
            </AcField>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <AcField label="Narration"><AcInput value={payForm.narration} onChange={e => setPayForm(p => ({ ...p, narration: e.target.value }))} /></AcField>
          </div>
        </div>
      </AcModal>

      {/* Ageing modal */}
      <AcModal open={showAgeing} onClose={() => setShowAgeing(false)} title="Ageing Report (AP)" width={680}>
        <AcTable rows={ageingRows} cols={ageingCols} keyFn={r => r.vendorId} empty="No outstanding bills." />
      </AcModal>
    </>
  );
}
