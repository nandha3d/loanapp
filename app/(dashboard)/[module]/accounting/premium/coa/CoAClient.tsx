'use client';
import { useState, useMemo, useTransition } from 'react';
import { createAccount, updateAccount, deactivateAccount, reseedDefaultCoA } from './actions';
import { AcStyles, AcButton, AcModal, AcField, AcInput, AcSelect, AcBadge, AcAlert } from '../ui';

type Account = { id: string; code: string; name: string; classType: string; subType?: string | null; normalSide: string; isCash: boolean; isSystem: boolean; isActive: boolean; parentId?: string | null; balance?: { closingDr: any; closingCr: any } | null };
const CLASS_COLORS: Record<string, string> = { asset: '#2563eb', liability: '#dc2626', equity: '#7c3aed', income: '#059669', expense: '#d97706' };

function fmt(acc: Account) {
  if (!acc.balance) return '—';
  const dr = Number(acc.balance.closingDr), cr = Number(acc.balance.closingCr);
  const net = acc.normalSide === 'debit' ? dr - cr : cr - dr;
  return net === 0 ? '—' : `₹${Math.abs(net).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function buildTree(accounts: Account[]) {
  const map = new Map<string | null, Account[]>();
  for (const a of accounts) { const k = a.parentId ?? null; if (!map.has(k)) map.set(k, []); map.get(k)!.push(a); }
  return map;
}

function Row({ account, depth, childrenOf, onEdit, onDeactivate, onAddChild }: { account: Account; depth: number; childrenOf: Map<string | null, Account[]>; onEdit: (a: Account) => void; onDeactivate: (id: string) => void; onAddChild: (pid: string) => void }) {
  const [exp, setExp] = useState(true);
  const kids = childrenOf.get(account.id) ?? [];
  return (<>
    <tr style={{ opacity: account.isActive ? 1 : 0.5, borderBottom: '1px solid var(--border)' }}>
      <td style={{ paddingLeft: `${depth * 18 + 8}px` }}>{kids.length > 0 && <button onClick={() => setExp(!exp)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 4 }}>{exp ? '▾' : '▸'}</button>}<span style={{ color: '#888', fontFamily: 'monospace', fontSize: '0.8rem' }}>{account.code}</span></td>
      <td style={{ padding: '6px 8px' }}>{account.name}</td>
      <td><AcBadge bg={`${CLASS_COLORS[account.classType]}22`} color={CLASS_COLORS[account.classType]}>{account.classType}</AcBadge></td>
      <td style={{ padding: '6px 8px', color: '#888', fontSize: '0.85rem' }}>{account.subType ?? '—'}</td>
      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(account)}</td>
      <td><div style={{ display: 'flex', gap: 4 }}>
        <AcButton size="sm" variant="ghost" onClick={() => onEdit(account)}>✎</AcButton>
        <AcButton size="sm" variant="ghost" onClick={() => onAddChild(account.id)}>⊕</AcButton>
        {!account.isSystem && <AcButton size="sm" variant="danger" onClick={() => onDeactivate(account.id)}>{account.isActive ? '✕' : '↩'}</AcButton>}
      </div></td>
    </tr>
    {exp && kids.map((c) => <Row key={c.id} account={c} depth={depth+1} childrenOf={childrenOf} onEdit={onEdit} onDeactivate={onDeactivate} onAddChild={onAddChild} />)}
  </>);
}

export default function CoAClient({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [search, setSearch] = useState(''); const [cls, setCls] = useState(''); const [inactive, setInactive] = useState(false);
  const [modal, setModal] = useState(false); const [editAcc, setEditAcc] = useState<Account | null>(null); const [preParent, setPreParent] = useState<string | undefined>();
  const [isPending, start] = useTransition(); const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ code: '', name: '', classType: 'asset', subType: '', isCash: false, description: '' });

  const filtered = useMemo(() => accounts.filter(a => (inactive || a.isActive) && (!cls || a.classType === cls) && (!search || a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase()))), [accounts, search, cls, inactive]);
  const childrenOf = useMemo(() => buildTree(filtered), [filtered]);
  const roots = childrenOf.get(null) ?? [];

  function openAdd(pid?: string) { setEditAcc(null); setPreParent(pid); setForm({ code: '', name: '', classType: 'asset', subType: '', isCash: false, description: '' }); setModal(true); }
  function openEdit(a: Account) { setEditAcc(a); setPreParent(undefined); setForm({ code: a.code, name: a.name, classType: a.classType, subType: a.subType ?? '', isCash: a.isCash, description: '' }); setModal(true); }
  function handleDeactivate(id: string) { start(async () => { const r = await deactivateAccount(id); if (r.error) setMsg(r.error); else { setAccounts(p => p.map(a => a.id === id ? {...a, isActive: !a.isActive} : a)); setMsg('Done.'); } }); }
  function handleReseed() { start(async () => { const r = await reseedDefaultCoA(); setMsg(`Reseeded: ${(r as any).created} created, ${(r as any).skipped} skipped.`); window.location.reload(); }); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r: any = editAcc ? await updateAccount(editAcc.id, { name: form.name, subType: form.subType || undefined, isCash: form.isCash }) : await createAccount({ code: form.code, name: form.name, classType: form.classType, subType: form.subType || undefined, parentId: preParent, isCash: form.isCash });
      if (r?.error) { setMsg(r.error); return; }
      setModal(false); setMsg('Saved.'); window.location.reload();
    });
  }

  return (
    <>
      <AcStyles />
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <AcInput placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <AcSelect value={cls} onChange={e => setCls(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All classes</option>
            {['asset','liability','equity','income','expense'].map(c => <option key={c} value={c}>{c}</option>)}
          </AcSelect>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={inactive} onChange={e => setInactive(e.target.checked)} /> Show inactive
          </label>
          <AcButton variant="ghost" icon="refresh" onClick={handleReseed} loading={isPending}>Reseed</AcButton>
          <AcButton variant="primary" icon="add" onClick={() => openAdd()}>Add Account</AcButton>
        </div>

        {msg && (
          <div style={{ marginBottom: 10 }}>
            <AcAlert type="success">{msg} <AcButton variant="link" size="sm" onClick={() => setMsg('')}>✕</AcButton></AcAlert>
          </div>
        )}

        <div style={{ overflowX: 'auto', border: '1px solid var(--border,#e8eaed)', borderRadius: 10 }}>
          <table className="ac-table">
            <thead><tr>
              <th>Code</th>
              <th>Name</th>
              <th>Class</th>
              <th>Sub-type</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {roots.map(a => <Row key={a.id} account={a} depth={0} childrenOf={childrenOf} onEdit={openEdit} onDeactivate={handleDeactivate} onAddChild={openAdd} />)}
              {roots.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No accounts. Click Reseed to populate default Chart of Accounts.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Account modal */}
        <AcModal
          open={modal}
          onClose={() => setModal(false)}
          title={`${editAcc ? 'Edit' : 'Add'} Account`}
          width={400}
          footer={
            <>
              <AcButton variant="ghost" onClick={() => setModal(false)}>Cancel</AcButton>
              <AcButton variant="primary" loading={isPending} onClick={handleSubmit as any}>Save</AcButton>
            </>
          }
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {!editAcc && (
              <AcField label="Code" required hint="4-digit account code">
                <AcInput value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="e.g. 5100" required />
              </AcField>
            )}
            <AcField label="Name" required>
              <AcInput value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </AcField>
            {!editAcc && (
              <AcField label="Class">
                <AcSelect value={form.classType} onChange={e => setForm({...form, classType: e.target.value})}>
                  {['asset','liability','equity','income','expense'].map(c => <option key={c} value={c}>{c}</option>)}
                </AcSelect>
              </AcField>
            )}
            <AcField label="Sub-type" hint="e.g. cash, bank, receivable">
              <AcInput value={form.subType} onChange={e => setForm({...form, subType: e.target.value})} />
            </AcField>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', marginBottom: 8 }}>
              <input type="checkbox" checked={form.isCash} onChange={e => setForm({...form, isCash: e.target.checked})} />
              Cash/bank account (included in cashflow)
            </label>
          </form>
        </AcModal>
      </div>
    </>
  );
}
