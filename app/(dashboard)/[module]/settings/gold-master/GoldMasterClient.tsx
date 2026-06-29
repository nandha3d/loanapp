'use client';

import { useState } from 'react';
import { addGoldMaster, updateGoldMaster, deleteGoldMaster } from './actions';

type Kind = 'type' | 'spec' | 'bank';

// Manage gold/silver master data — the source for the pledge-form dropdowns.
export default function GoldMasterClient({ master }: { master: { ornamentTypes: any[]; ornamentSpecs: any[]; bankNames: any[] } }) {
  return (
    <div style={{ maxWidth: 980 }}>
      <style>{`
        .gm-wrap { display:grid; grid-template-columns: 1fr 1fr; gap:18px; }
        @media (max-width: 820px){ .gm-wrap { grid-template-columns: 1fr; } }
        .gm-card { background:var(--surface,#fff); border:1px solid var(--border); border-radius:14px; padding:16px 18px; }
        .gm-card h3 { margin:0 0 4px; font-size:1.02rem; color:var(--primary-dark); display:flex; gap:8px; align-items:center; }
        .gm-sub { font-size:.78rem; color:var(--text-secondary); margin-bottom:12px; }
        .gm-list { display:flex; flex-direction:column; gap:6px; max-height:340px; overflow:auto; margin-bottom:12px; }
        .gm-row { display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--border); border-radius:9px; background:var(--bg,#fafafa); }
        .gm-row .nm { flex:1; font-size:.9rem; }
        .gm-row .tag { font-size:.68rem; padding:2px 7px; border-radius:6px; background:var(--primary-light); color:var(--primary-dark); }
        .gm-row .x { border:none; background:transparent; color:var(--danger); cursor:pointer; border-radius:6px; padding:4px 7px; }
        .gm-row .x:hover { background:var(--danger-bg,#fee2e2); }
        .gm-add { display:flex; gap:8px; flex-wrap:wrap; }
        .gm-add input, .gm-add select { flex:1 1 120px; border:1px solid var(--border); border-radius:9px; padding:9px 10px; font-size:.88rem; }
        .gm-add button { border:none; background:var(--primary); color:#fff; border-radius:9px; padding:9px 16px; font-weight:600; cursor:pointer; }
        .gm-add button:disabled { opacity:.5; cursor:not-allowed; }
        .gm-err { color:var(--danger); font-size:.8rem; margin-top:6px; }
      `}</style>

      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px' }}>💎 Gold Master Data</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>These drive the dropdowns on the pledge form. Add, rename or remove them here — nothing is hardcoded.</p>
      </div>

      <div className="gm-wrap">
        <MasterSection
          kind="type" title="Ornament Types" icon="💍"
          subtitle="Chain, Ring, Bracelet…"
          rows={master.ornamentTypes}
          showMetal
        />
        <MasterSection
          kind="spec" title="Specifications" icon="🔖"
          subtitle="916 22K, 18K…"
          rows={master.ornamentSpecs}
          showPurity
        />
        <MasterSection
          kind="bank" title="Banks / Storage" icon="🏦"
          subtitle="Self Locker, BOI…"
          rows={master.bankNames}
        />
      </div>
    </div>
  );
}

function MasterSection({
  kind, title, icon, subtitle, rows, showMetal, showPurity,
}: {
  kind: Kind; title: string; icon: string; subtitle: string; rows: any[];
  showMetal?: boolean; showPurity?: boolean;
}) {
  const [name, setName] = useState('');
  const [metal, setMetal] = useState('gold');
  const [purity, setPurity] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true); setErr(null);
    const res = await addGoldMaster(kind, name, { metal: showMetal ? metal : undefined, purityKarat: showPurity ? purity : undefined });
    setBusy(false);
    if (res && 'error' in res && res.error) { setErr(res.error); return; }
    setName(''); setPurity('');
    window.location.reload();
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this entry? Existing pledges keep their value.')) return;
    const res = await deleteGoldMaster(kind, id);
    if (res && 'error' in res && res.error) { alert(res.error); return; }
    window.location.reload();
  };

  return (
    <div className="gm-card">
      <h3>{icon} {title}</h3>
      <div className="gm-sub">{subtitle}</div>
      <div className="gm-list">
        {rows.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem', padding: 8 }}>None yet — add below.</div>
        ) : rows.map((r) => (
          <div className="gm-row" key={r.id}>
            <span className="nm">{r.name}</span>
            {showMetal && r.metal && <span className="tag">{r.metal}</span>}
            {showPurity && r.purityKarat && <span className="tag">{r.purityKarat}</span>}
            <button className="x" onClick={() => remove(r.id)} title="Remove">✕</button>
          </div>
        ))}
      </div>
      <div className="gm-add">
        <input value={name} onChange={e => setName(e.target.value)} placeholder={`New ${title.toLowerCase().replace(/s$/, '')}`} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        {showMetal && (
          <select value={metal} onChange={e => setMetal(e.target.value)}>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
          </select>
        )}
        {showPurity && (
          <input value={purity} onChange={e => setPurity(e.target.value)} placeholder="Karat (e.g. 22K)" style={{ flex: '0 1 120px' }} />
        )}
        <button onClick={add} disabled={busy || !name.trim()}>{busy ? '…' : 'Add'}</button>
      </div>
      {err && <div className="gm-err">{err}</div>}
    </div>
  );
}
