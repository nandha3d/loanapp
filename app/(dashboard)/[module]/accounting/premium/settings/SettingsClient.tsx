'use client';
import React, { useState, useTransition } from 'react';
import { updateSettings, migrateBasicAccountingData, getMigrationStats } from './actions';
import {
  AcStyles, AcButton, AcField, AcInput, AcSelect, AcTextarea,
  AcPageHeader, AcTabs, AcCard, AcAlert, AcKpiCard,
} from '../ui';

type SettingsTab = 'general' | 'gst' | 'approvals' | 'alerts' | 'tally' | 'integration' | 'migration';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const INDIAN_STATES = [['AN','Andaman & Nicobar'],['AP','Andhra Pradesh'],['AR','Arunachal Pradesh'],['AS','Assam'],['BR','Bihar'],['CG','Chhattisgarh'],['CH','Chandigarh'],['DL','Delhi'],['GA','Goa'],['GJ','Gujarat'],['HP','Himachal Pradesh'],['HR','Haryana'],['JH','Jharkhand'],['JK','Jammu & Kashmir'],['KA','Karnataka'],['KL','Kerala'],['MH','Maharashtra'],['ML','Meghalaya'],['MN','Manipur'],['MP','Madhya Pradesh'],['MZ','Mizoram'],['NL','Nagaland'],['OD','Odisha'],['PB','Punjab'],['PY','Puducherry'],['RJ','Rajasthan'],['SK','Sikkim'],['TG','Telangana'],['TN','Tamil Nadu'],['TR','Tripura'],['UP','Uttar Pradesh'],['UT','Uttarakhand'],['WB','West Bengal']];

interface Settings {
  fiscalYearStartMonth: number; gstin: string | null; state: string | null; gstScheme: string;
  baseCurrency: string; postingOverrides: string; costCentresEnabled: boolean;
  baseAccountingMode: string; showPremiumBannerInBase: boolean;
  adminJeCap: any; adminBillCap: any; twoLevelApprovalThreshold: any;
  adminCanEditCoA: boolean; adminCanLockPeriod: boolean;
  varianceAlertPct: any; apOverdueAlertDays: number;
  tallyConnectorEnabled: boolean; tallyConnectorUrl: string | null; tallyCompanyName: string | null;
  allowFutureDated: boolean; defaultBankAccountId: string | null; defaultCashAccountId: string | null;
}
interface Props {
  settings: Settings;
  bankAccounts: { id: string; code: string; name: string }[];
  cashAccounts: { id: string; code: string; name: string }[];
  migrationStats: { basicEntries: number; migratedCount: number };
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
      <div style={{ position: 'relative', width: 40, height: 22 }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
        <div style={{ width: 40, height: 22, borderRadius: 11, background: checked ? '#6366f1' : '#d1d5db', transition: 'background .2s' }} />
        <div style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
      <span style={{ fontSize: '0.87rem' }}>{label}</span>
    </label>
  );
}

export default function SettingsClient({ settings: initial, bankAccounts, cashAccounts, migrationStats: initialStats }: Props) {
  const [tab, setTab] = useState<SettingsTab>('general');
  const [migStats, setMigStats] = useState(initialStats);
  const [migrating, setMigrating] = useState(false);
  const [migResult, setMigResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [form, setForm] = useState({
    fiscalYearStartMonth: initial.fiscalYearStartMonth,
    gstin: initial.gstin ?? '',
    state: initial.state ?? '',
    gstScheme: initial.gstScheme,
    baseCurrency: initial.baseCurrency,
    postingOverrides: initial.postingOverrides,
    costCentresEnabled: initial.costCentresEnabled,
    baseAccountingMode: initial.baseAccountingMode,
    showPremiumBannerInBase: initial.showPremiumBannerInBase,
    adminJeCap: Number(initial.adminJeCap),
    adminBillCap: Number(initial.adminBillCap),
    twoLevelApprovalThreshold: Number(initial.twoLevelApprovalThreshold),
    adminCanEditCoA: initial.adminCanEditCoA,
    adminCanLockPeriod: initial.adminCanLockPeriod,
    varianceAlertPct: Number(initial.varianceAlertPct),
    apOverdueAlertDays: initial.apOverdueAlertDays,
    tallyConnectorEnabled: initial.tallyConnectorEnabled,
    tallyConnectorUrl: initial.tallyConnectorUrl ?? '',
    tallyCompanyName: initial.tallyCompanyName ?? '',
    allowFutureDated: initial.allowFutureDated,
    defaultBankAccountId: initial.defaultBankAccountId ?? '',
    defaultCashAccountId: initial.defaultCashAccountId ?? '',
  });

  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form, value: any) => setForm(p => ({ ...p, [key]: value }));

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateSettings(form);
      if (!res.ok) { setError(res.error ?? 'Save failed'); setSaved(false); }
      else { setSaved(true); setError(''); setTimeout(() => setSaved(false), 3000); }
    });
  };

  const handleMigrate = async () => {
    const remaining = migStats.basicEntries - migStats.migratedCount;
    if (!confirm(`Import ${remaining} basic accounting entries into premium double-entry ledger?`)) return;
    setMigrating(true); setMigResult(null);
    const res = await migrateBasicAccountingData();
    setMigrating(false);
    if (!res.ok) {
      setMigResult({ ok: false, msg: res.error ?? 'Migration failed' });
    } else {
      setMigResult({ ok: true, msg: `Imported ${res.imported} entries. ${res.skipped} skipped (already done or adjustment type).` });
      setMigStats(await getMigrationStats());
    }
  };

  const tabs: { key: SettingsTab; label: string; icon: string }[] = [
    { key: 'general',     label: 'General',     icon: 'tune' },
    { key: 'gst',         label: 'GST',         icon: 'receipt_long' },
    { key: 'approvals',   label: 'Approvals',   icon: 'approval' },
    { key: 'alerts',      label: 'Alerts',      icon: 'notifications' },
    { key: 'tally',       label: 'Tally',       icon: 'sync_alt' },
    { key: 'integration', label: 'Integration', icon: 'hub' },
    { key: 'migration',   label: 'Migrate',     icon: 'upload' },
  ];

  return (
    <>
      <AcStyles />

      <AcPageHeader
        title="Settings"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {saved && <span style={{ color: '#16a34a', fontSize: '0.82rem', fontWeight: 600 }}>✔ Saved</span>}
            {error && <span style={{ color: '#ef4444', fontSize: '0.82rem' }}>{error}</span>}
            <AcButton variant="primary" icon="save" loading={isPending} onClick={handleSave}>Save</AcButton>
          </div>
        }
      />

      <AcTabs tabs={tabs} active={tab} onChange={k => setTab(k as SettingsTab)} />

      <AcCard style={{ maxWidth: 600 }}>

        {/* General */}
        {tab === 'general' && <>
          <AcField label="Fiscal year start month">
            <AcSelect value={form.fiscalYearStartMonth} onChange={e => set('fiscalYearStartMonth', parseInt(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </AcSelect>
          </AcField>
          <AcField label="Base currency">
            <AcInput value={form.baseCurrency} onChange={e => set('baseCurrency', e.target.value)} />
          </AcField>
          <AcField label="Default bank account">
            <AcSelect value={form.defaultBankAccountId} onChange={e => set('defaultBankAccountId', e.target.value)}>
              <option value="">— none —</option>
              {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </AcSelect>
          </AcField>
          <AcField label="Default cash account">
            <AcSelect value={form.defaultCashAccountId} onChange={e => set('defaultCashAccountId', e.target.value)}>
              <option value="">— none —</option>
              {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </AcSelect>
          </AcField>
          <Toggle checked={form.allowFutureDated} onChange={v => set('allowFutureDated', v)} label="Allow future-dated entries" />
        </>}

        {/* GST */}
        {tab === 'gst' && <>
          <AcField label="GSTIN" hint="Format: 29ABCDE1234F1Z1">
            <AcInput value={form.gstin} onChange={e => set('gstin', e.target.value)} placeholder="29ABCDE1234F1Z1" />
          </AcField>
          <AcField label="State">
            <AcSelect value={form.state} onChange={e => set('state', e.target.value)}>
              <option value="">— select state —</option>
              {INDIAN_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </AcSelect>
          </AcField>
          <AcField label="GST scheme">
            <AcSelect value={form.gstScheme} onChange={e => set('gstScheme', e.target.value)}>
              <option value="regular">Regular</option>
              <option value="composition">Composition</option>
              <option value="exempt">Exempt</option>
            </AcSelect>
          </AcField>
        </>}

        {/* Approvals */}
        {tab === 'approvals' && <>
          <AcField label="Admin JE cap (₹)">
            <AcInput type="number" value={form.adminJeCap} onChange={e => set('adminJeCap', parseFloat(e.target.value))} />
          </AcField>
          <AcField label="Admin Bill cap (₹)">
            <AcInput type="number" value={form.adminBillCap} onChange={e => set('adminBillCap', parseFloat(e.target.value))} />
          </AcField>
          <AcField label="Two-level approval threshold (₹)">
            <AcInput type="number" value={form.twoLevelApprovalThreshold} onChange={e => set('twoLevelApprovalThreshold', parseFloat(e.target.value))} />
          </AcField>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <Toggle checked={form.adminCanEditCoA} onChange={v => set('adminCanEditCoA', v)} label="Admins can edit Chart of Accounts" />
            <Toggle checked={form.adminCanLockPeriod} onChange={v => set('adminCanLockPeriod', v)} label="Admins can lock period" />
          </div>
        </>}

        {/* Alerts */}
        {tab === 'alerts' && <>
          <AcField label="Variance alert threshold (%)" hint="Budget vs actuals variance to trigger alert">
            <AcInput type="number" value={form.varianceAlertPct} onChange={e => set('varianceAlertPct', parseFloat(e.target.value))} />
          </AcField>
          <AcField label="AP overdue alert (days)">
            <AcInput type="number" value={form.apOverdueAlertDays} onChange={e => set('apOverdueAlertDays', parseInt(e.target.value))} />
          </AcField>
        </>}

        {/* Tally */}
        {tab === 'tally' && <>
          <Toggle checked={form.tallyConnectorEnabled} onChange={v => set('tallyConnectorEnabled', v)} label="Enable Tally connector" />
          {form.tallyConnectorEnabled && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
              <AcField label="Tally connector URL">
                <AcInput value={form.tallyConnectorUrl} onChange={e => set('tallyConnectorUrl', e.target.value)} placeholder="http://localhost:9000" />
              </AcField>
              <AcField label="Tally company name">
                <AcInput value={form.tallyCompanyName} onChange={e => set('tallyCompanyName', e.target.value)} placeholder="LoanTrack Books" />
              </AcField>
              <AcAlert type="warning">Tally connector requires Tally Prime running on a reachable host. Not suitable for cloud installs.</AcAlert>
            </div>
          )}
        </>}

        {/* Integration */}
        {tab === 'integration' && <>
          <AcField label="Integration mode">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
              {[
                { value: 'derive_only', label: 'Derive only', desc: 'Base accounting stays as-is. Premium reads from base but does not mirror back.' },
                { value: 'mirror',     label: 'Mirror to base', desc: 'Every premium JE also appends a row in AccountEntry for the base page.' },
                { value: 'replace',    label: 'Replace base', desc: 'The base /accounting page redirects to /accounting/premium.' },
              ].map(({ value, label, desc }) => (
                <label key={value} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="radio" name="baseMode" value={value} checked={form.baseAccountingMode === value} onChange={() => set('baseAccountingMode', value)} style={{ marginTop: 3 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.87rem' }}>{label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </AcField>
          <div style={{ marginBottom: 16 }}>
            <Toggle checked={form.showPremiumBannerInBase} onChange={v => set('showPremiumBannerInBase', v)} label="Show premium banner in base accounting" />
          </div>
          <AcField label="Posting overrides (JSON)" hint="Advanced: override default account codes for auto-posting">
            <AcTextarea rows={6} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} value={form.postingOverrides} onChange={e => set('postingOverrides', e.target.value)} />
          </AcField>
        </>}

        {/* Migration */}
        {tab === 'migration' && (
          <div>
            <h3 style={{ marginBottom: 6, fontSize: '1rem', fontWeight: 700 }}>Import Basic Accounting Data</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              Converts existing basic accounting entries into double-entry journal entries.
              Already-migrated entries are skipped automatically.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <AcKpiCard label="Basic Entries" value={String(migStats.basicEntries)} icon="list_alt" iconColor="#6366f1" accent="#6366f1" />
              <AcKpiCard
                label="Migrated"
                value={String(migStats.migratedCount)}
                icon="check_circle"
                iconColor={migStats.migratedCount === migStats.basicEntries && migStats.basicEntries > 0 ? '#10b981' : '#f59e0b'}
                accent={migStats.migratedCount === migStats.basicEntries && migStats.basicEntries > 0 ? '#10b981' : '#f59e0b'}
              />
            </div>

            <AcAlert type="info">
              <strong>Mapping:</strong><br />
              • capital_add → Dr Cash / Cr Owner&apos;s Capital<br />
              • capital_withdraw → Dr Owner&apos;s Capital / Cr Cash<br />
              • loan_disburse → Dr Loan Principal Receivable / Cr Cash<br />
              • collection → Dr Cash / Cr Loan Principal Receivable<br />
              • expense → Dr Other Expenses / Cr Cash<br />
              Bank/UPI category uses Bank account (1200) instead of Cash (1100).
            </AcAlert>

            <div style={{ marginTop: 20 }}>
              {migStats.basicEntries === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No basic accounting entries found.</p>
              ) : migStats.migratedCount >= migStats.basicEntries ? (
                <p style={{ fontSize: '0.87rem', color: '#16a34a', fontWeight: 600 }}>✔ All entries already migrated.</p>
              ) : (
                <AcButton variant="primary" icon="upload" loading={migrating} onClick={handleMigrate}>
                  Import {migStats.basicEntries - migStats.migratedCount} entries
                </AcButton>
              )}
              {migResult && (
                <div style={{ marginTop: 12 }}>
                  <AcAlert type={migResult.ok ? 'success' : 'error'}>{migResult.msg}</AcAlert>
                </div>
              )}
            </div>
          </div>
        )}

      </AcCard>
    </>
  );
}
