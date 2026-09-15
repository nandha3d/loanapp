'use client';

import { useState } from 'react';
import { addGoldMaster, updateGoldMaster, deleteGoldMaster, saveGoldSettings } from './actions';

type Kind = 'type' | 'spec' | 'bank';

// Manage gold/silver master data + rates/interest settings — the source for the
// pledge-form dropdowns, valuation and servicing.
export default function GoldMasterClient({ master, config = null }: { master: { ornamentTypes: any[]; ornamentSpecs: any[]; bankNames: any[] }; config?: any }) {
  return (
    <div style={{ maxWidth: 980 }}>
      <GoldSettingsSection config={config} />
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

function GoldSettingsSection({ config }: { config: any }) {
  const init = {
    goldPureRate: config?.goldPureRatePerGram ?? '',
    silverRate: config?.silverRatePerGram ?? '',
    goldInterestPercent: config?.goldInterestPercent ?? '',
    silverInterestPercent: config?.silverInterestPercent ?? '',
    interestSchemeMonths: config?.interestSchemeMonths ?? 1,
    processingFeeDefault: config?.processingFeeDefault ?? 0,
    processingFeePercentageBased: config?.processingFeePercentageBased ?? false,
    autoRateKaratBased: config?.autoRateKaratBased ?? false,
    defaultLtvPercent: config?.defaultLtvPercent ?? '',
    billPrefix: config?.billPrefix ?? 'A',
  };
  const [v, setV] = useState<any>(init);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, val: any) => { setV((p: any) => ({ ...p, [k]: val })); setOk(false); };

  const save = async () => {
    setBusy(true); setErr(null); setOk(false);
    const res = await saveGoldSettings({
      goldPureRate: String(v.goldPureRate), silverRate: String(v.silverRate),
      goldInterestPercent: String(v.goldInterestPercent), silverInterestPercent: String(v.silverInterestPercent),
      interestSchemeMonths: String(v.interestSchemeMonths), processingFeeDefault: String(v.processingFeeDefault),
      processingFeePercentageBased: String(!!v.processingFeePercentageBased), autoRateKaratBased: String(!!v.autoRateKaratBased),
      defaultLtvPercent: String(v.defaultLtvPercent), billPrefix: String(v.billPrefix),
    });
    setBusy(false);
    if (res && 'error' in res && res.error) { setErr(res.error); return; }
    setOk(true);
  };

  const num = (label: string, key: string, suffix?: string) => (
    <div className="gs-fld">
      <label>{label}</label>
      <div className="gs-input">
        <input type="number" step="0.01" value={v[key]} onChange={e => set(key, e.target.value)} />
        {suffix && <span className="gs-suffix">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="gm-card" style={{ marginBottom: 18 }}>
      <style>{`
        .gs-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:14px; }
        .gs-fld label { font-size:.74rem; color:var(--text-secondary); display:block; margin-bottom:5px; }
        .gs-input { display:flex; align-items:center; border:1px solid var(--border); border-radius:9px; overflow:hidden; }
        .gs-input input { border:none; padding:9px 10px; width:100%; font-size:.9rem; }
        .gs-input input:focus { outline:none; }
        .gs-suffix { padding:0 10px; color:var(--text-secondary); font-size:.8rem; background:var(--bg,#f5f5f5); align-self:stretch; display:flex; align-items:center; }
        .gs-toggle { display:flex; align-items:center; gap:8px; font-size:.85rem; }
        .gs-save { margin-top:14px; display:flex; align-items:center; gap:12px; }
        .gs-save button { border:none; background:var(--primary); color:#fff; border-radius:9px; padding:10px 22px; font-weight:600; cursor:pointer; }
        .gs-save button:disabled { opacity:.5; }
        .gs-ok { color:var(--success); font-size:.85rem; }
        .gs-err { color:var(--danger); font-size:.85rem; }
      `}</style>
      <h3>⚙️ Rates &amp; Interest</h3>
      <div className="gm-sub">Used for valuation, the pledge form defaults, and interest servicing.</div>
      <div className="gs-grid">
        {num('Gold rate / gram (24K)', 'goldPureRate', '₹')}
        {num('Silver rate / gram', 'silverRate', '₹')}
        {num('Gold interest', 'goldInterestPercent', '%/mo')}
        {num('Silver interest', 'silverInterestPercent', '%/mo')}
        {num('Interest scheme', 'interestSchemeMonths', 'months')}
        {num('Processing fee (default)', 'processingFeeDefault')}
        {num('Default LTV', 'defaultLtvPercent', '%')}
        <div className="gs-fld">
          <label>Bill prefix</label>
          <div className="gs-input"><input type="text" value={v.billPrefix} onChange={e => set('billPrefix', e.target.value)} /></div>
        </div>
        <div className="gs-fld">
          <label>Options</label>
          <label className="gs-toggle"><input type="checkbox" checked={!!v.processingFeePercentageBased} onChange={e => set('processingFeePercentageBased', e.target.checked)} /> Processing fee is %</label>
          <label className="gs-toggle" style={{ marginTop: 6 }}><input type="checkbox" checked={!!v.autoRateKaratBased} onChange={e => set('autoRateKaratBased', e.target.checked)} /> Auto rate per gram (karat-based)</label>
        </div>
      </div>
      <div className="gs-save">
        <button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Settings'}</button>
        {ok && <span className="gs-ok">✓ Saved</span>}
        {err && <span className="gs-err">{err}</span>}
      </div>
    </div>
  );
}
