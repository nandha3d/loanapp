'use client';

import { useEffect, useMemo, useState } from 'react';
import { saveChitTypesConfigAction } from './actions';
import { saveChitVoiceSettingsAction, saveCustomerRouteModeAction } from '../actions';
import type { CashDenominationMode } from '@/lib/chits/denominations';
import {
  BID_VOICE_LANGUAGES,
  BID_VOICE_PROFILES,
  BID_VOICE_SPEED_PRESETS,
  clampBidVoiceSpeed,
  normalizeBidVoiceProfile,
  previewBidVoiceSample,
  type BidVoiceLanguageCode,
  type BidVoiceProfileId,
} from '@/lib/chits/bidVoiceAnnouncer';
import type { CustomerRouteMode } from '@/lib/moduleCapabilities';
import {
  BIDDING_MODES,
  CHIT_ENGINE_CATALOG,
  CHIT_ENGINE_CATEGORIES,
  CHIT_ENGINE_TYPES,
  CHIT_SECURITY_TYPES,
  COLLECTION_FREQUENCIES,
  DEFAULT_ENABLED_CHIT_ENGINE_TYPES,
  FOREMAN_COMPENSATION_MODES,
  LATE_FEE_TYPES,
  PAYOUT_ASSET_TYPES,
  REGULATORY_TIERS,
  SCALE_TIERS,
  type ChitEngineCategory,
  type ChitEngineConfig,
  type ChitEngineType,
} from '@/lib/chits/engineTypes';
import type { ChitTypeSettingsState } from '@/lib/chits/settings';

const CATEGORY_ORDER: ChitEngineCategory[] = [
  'AUCTION',
  'FIXED_CHART',
  'MICRO_COMMODITY',
  'ENTERPRISE_HYBRID',
];

export default function ChitTypesSettingsClient({
  settings,
  dict,
  currencySymbol = '₹',
  initialVoiceSpeakingRate = 0.88,
  initialVoiceProfile = 'MALE_CLASSIC',
  initialRouteMode = 'ENABLED_OPTIONAL',
  canModifyApprovalPolicy = false,
  approvalPolicy = { adminCanApproveSecurity: false, adminCanReleasePayout: false },
  onSaveApprovalPolicy,
  onManageStaffApprovals,
}: {
  settings: ChitTypeSettingsState | null;
  dict: any;
  currencySymbol?: string;
  initialVoiceSpeakingRate?: number;
  initialVoiceProfile?: string;
  initialRouteMode?: CustomerRouteMode;
  canModifyApprovalPolicy?: boolean;
  approvalPolicy?: { adminCanApproveSecurity: boolean; adminCanReleasePayout: boolean };
  onSaveApprovalPolicy?: (next: {
    adminCanApproveSecurity: boolean;
    adminCanReleasePayout: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  onManageStaffApprovals?: () => void;
}) {
  const ds = dict.settings || {};
  const dc = dict.chits || {};

  const [enabledSet, setEnabledSet] = useState<Set<ChitEngineType>>(
    () => new Set(settings?.enabledTypes ?? DEFAULT_ENABLED_CHIT_ENGINE_TYPES),
  );
  const [typeDefaults, setTypeDefaults] = useState<Record<ChitEngineType, ChitEngineConfig>>(() => {
    const out = {} as Record<ChitEngineType, ChitEngineConfig>;
    for (const code of CHIT_ENGINE_TYPES) {
      out[code] = settings?.typeDefaults?.[code]
        ? structuredClone(settings.typeDefaults[code])
        : structuredClone(CHIT_ENGINE_CATALOG[code].defaultConfig);
    }
    return out;
  });
  const [search, setSearch] = useState('');
  const [expandedCode, setExpandedCode] = useState<ChitEngineType | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [denomMode, setDenomMode] = useState<CashDenominationMode>('OPTIONAL');
  const [denomSaving, setDenomSaving] = useState(false);

  const [voiceRate, setVoiceRate] = useState<number>(() => clampBidVoiceSpeed(initialVoiceSpeakingRate));
  const [voiceProfile, setVoiceProfile] = useState<BidVoiceProfileId>(() =>
    normalizeBidVoiceProfile(initialVoiceProfile),
  );
  const [sampleLang, setSampleLang] = useState<BidVoiceLanguageCode>('en');
  const [voiceSaving, setVoiceSaving] = useState(false);
  const [voiceTesting, setVoiceTesting] = useState(false);
  const [chitRouteMode, setChitRouteMode] = useState<CustomerRouteMode>(initialRouteMode);
  const [routeModeSaving, setRouteModeSaving] = useState(false);
  const [approvalSaving, setApprovalSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/chits/settings')
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && res?.data?.cashDenominationMode) {
          setDenomMode(res.data.cashDenominationMode as CashDenominationMode);
        }
      })
      .catch(() => { });
  }, []);

  const handleSaveDenomMode = async (nextMode: CashDenominationMode) => {
    setDenomMode(nextMode);
    setDenomSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/v1/chits/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashDenominationMode: nextMode }),
      });
      const json = await res.json();
      if (json?.ok) {
        setFeedback({ type: 'ok', msg: `Cash denomination tally mode saved as ${nextMode}.` });
      } else {
        setFeedback({ type: 'err', msg: json?.error?.message || 'Failed to save cash denomination mode.' });
      }
    } catch (e: any) {
      setFeedback({ type: 'err', msg: e?.message || 'Failed to save cash denomination mode.' });
    }
    setDenomSaving(false);
  };

  const categoryTitles: Record<ChitEngineCategory, string> = {
    AUCTION: dc.catAuction || 'Category A: Bidding & Auction Engines',
    FIXED_CHART: dc.catFixedChart || 'Category B: Fixed, Chart & Non-Auction Engines',
    MICRO_COMMODITY: dc.catMicroCommodity || 'Category C: Micro, Commodity & Purpose-Driven Engines',
    ENTERPRISE_HYBRID: dc.catEnterpriseHybrid || 'Category D: Enterprise, Hybrid & Lending-Linked Engines',
  };

  const toggleType = (code: ChitEngineType) => {
    setFeedback(null);
    setEnabledSet((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        if (next.size <= 1) {
          setFeedback({ type: 'err', msg: ds.chitTypesAtLeastOne || 'At least one chit type must stay enabled.' });
          return prev;
        }
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleCategory = (cat: ChitEngineCategory, enable: boolean) => {
    setFeedback(null);
    const codes = CHIT_ENGINE_TYPES.filter((c) => CHIT_ENGINE_CATALOG[c].category === cat);
    setEnabledSet((prev) => {
      const next = new Set(prev);
      for (const c of codes) {
        if (enable) next.add(c);
        else next.delete(c);
      }
      if (next.size === 0) {
        setFeedback({ type: 'err', msg: ds.chitTypesAtLeastOne || 'At least one chit type must stay enabled.' });
        return prev;
      }
      return next;
    });
  };

  const updateConfig = (code: ChitEngineType, updater: (cur: ChitEngineConfig) => ChitEngineConfig) => {
    setTypeDefaults((prev) => ({ ...prev, [code]: updater(prev[code]) }));
    setFeedback(null);
  };

  const filteredByCategory = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<ChitEngineCategory, ChitEngineType[]>();
    for (const cat of CATEGORY_ORDER) {
      const list = CHIT_ENGINE_TYPES.filter((code) => {
        const item = CHIT_ENGINE_CATALOG[code];
        if (item.category !== cat) return false;
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.regionalNames.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      });
      if (list.length) map.set(cat, list);
    }
    return map;
  }, [search]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const res = await saveChitTypesConfigAction({
      enabledTypes: Array.from(enabledSet),
      typeDefaults,
    });
    setSaving(false);
    if (res.success) {
      setFeedback({ type: 'ok', msg: ds.chitTypesSaved || 'Chit fund types & default rules saved.' });
    } else {
      setFeedback({ type: 'err', msg: res.error || ds.chitTypesSaveFailed || 'Failed to save settings.' });
    }
  };

  return (
    <div style={{ maxWidth: '1040px' }}>
      <div
        className="card-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}
      >
        <div>
          <h3 style={{ margin: 0 }}>{ds.chitTypesTitle || 'Chit Fund Types & Engine Rules'}</h3>
          <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {ds.chitTypesDesc || 'Enable or disable chit engines and configure default formulas for new chit groups.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-info">
            {enabledSet.size} / {CHIT_ENGINE_TYPES.length} {ds.chitTypesEnabledCount || 'enabled'}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setEnabledSet(new Set(CHIT_ENGINE_TYPES))}
          >
            {ds.chitTypesEnableAll || 'Enable All'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setEnabledSet(new Set(DEFAULT_ENABLED_CHIT_ENGINE_TYPES))}
          >
            {ds.chitTypesStandardOnly || 'Standard Only'}
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
            {saving ? (ds.saving || 'Saving...') : (ds.saveChitTypes || 'Save Chit Types')}
          </button>
        </div>
      </div>

      {/* Live Auction Voice-Over Speed & Voice Selection */}
      <div
        className="card"
        style={{
          marginBottom: '16px',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: '0.94rem', color: 'var(--text)' }}>
              🗣️ Live Auction Voice-Over Speed &amp; Voice Selection
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '0.79rem', color: 'var(--text-secondary)' }}>
              Slow down or speed up live Google voice announcements across all 6 languages and choose your preferred announcer voice.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={voiceTesting || voiceSaving}
              onClick={async () => {
                setVoiceTesting(true);
                setFeedback(null);
                const ok = await previewBidVoiceSample({
                  lang: sampleLang,
                  speakingRate: voiceRate,
                  voiceProfile,
                });
                setVoiceTesting(false);
                if (!ok) {
                  setFeedback({
                    type: 'err',
                    msg: 'Voice test failed — verify GOOGLE_TTS_API_KEY and audio permission in browser.',
                  });
                }
              }}
            >
              {voiceTesting ? '🔊 Speaking…' : '🔊 Test Voice'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={voiceSaving}
              onClick={async () => {
                setVoiceSaving(true);
                setFeedback(null);
                const res = await saveChitVoiceSettingsAction({
                  speakingRate: voiceRate,
                  voiceProfile,
                });
                setVoiceSaving(false);
                if (res?.success) {
                  setFeedback({
                    type: 'ok',
                    msg: `Live voice-over saved (${voiceRate.toFixed(2)}× · ${BID_VOICE_PROFILES.find((p) => p.id === voiceProfile)?.label || voiceProfile}).`,
                  });
                } else {
                  setFeedback({ type: 'err', msg: res?.error || 'Failed to save voice settings.' });
                }
              }}
            >
              {voiceSaving ? 'Saving…' : 'Save Voice Settings'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Announcer Voice</label>
            <select
              className="form-control"
              value={voiceProfile}
              onChange={(e) => setVoiceProfile(e.target.value as BidVoiceProfileId)}
            >
              {BID_VOICE_PROFILES.map((vp) => (
                <option key={vp.id} value={vp.id}>{vp.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>
              Voice Speed Preset ({voiceRate.toFixed(2)}×)
            </label>
            <select
              className="form-control"
              value={String(BID_VOICE_SPEED_PRESETS.find((p) => Math.abs(p.value - voiceRate) < 0.015)?.value ?? 'custom')}
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  setVoiceRate(clampBidVoiceSpeed(Number(e.target.value)));
                }
              }}
            >
              {BID_VOICE_SPEED_PRESETS.map((sp) => (
                <option key={sp.value} value={String(sp.value)}>{sp.label}</option>
              ))}
              {!BID_VOICE_SPEED_PRESETS.some((p) => Math.abs(p.value - voiceRate) < 0.015) && (
                <option value="custom">Custom ({voiceRate.toFixed(2)}×)</option>
              )}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>
              Fine-Tune Pace: <strong>{voiceRate.toFixed(2)}×</strong> (Slower ← → Faster)
            </label>
            <input
              type="range"
              min={0.70}
              max={1.15}
              step={0.02}
              value={voiceRate}
              onChange={(e) => setVoiceRate(clampBidVoiceSpeed(Number(e.target.value)))}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Test Sample Language</label>
            <select
              className="form-control"
              value={sampleLang}
              onChange={(e) => setSampleLang(e.target.value as BidVoiceLanguageCode)}
            >
              {BID_VOICE_LANGUAGES.map((vl) => (
                <option key={vl.code} value={vl.code}>{vl.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Customer Route / Line Requirement Toggle (Chit Funds) */}
      <div
        className="card"
        style={{
          marginBottom: '16px',
          padding: '14px 16px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <strong style={{ fontSize: '0.92rem' }}>🗺️ Route / Line Field on Chit Customer Registration</strong>
          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Chit customers do not require collection routes unless your office uses line routes. Enable, make optional, or hide it here.
          </p>
        </div>
        <select
          className="form-control"
          aria-label="Chit customer route mode"
          value={chitRouteMode}
          disabled={routeModeSaving}
          style={{ width: '260px', fontWeight: 600 }}
          onChange={async (e) => {
            const nextMode = e.target.value as CustomerRouteMode;
            setChitRouteMode(nextMode);
            setRouteModeSaving(true);
            setFeedback(null);
            const res = await saveCustomerRouteModeAction(nextMode, 'chitfunds');
            setRouteModeSaving(false);
            if (res?.success) {
              setFeedback({ type: 'ok', msg: `Chit customer route option set to ${nextMode}.` });
            } else {
              setFeedback({ type: 'err', msg: res?.error || 'Failed to update route option.' });
            }
          }}
        >
          <option value="ENABLED_OPTIONAL">Enabled — Optional (Default)</option>
          <option value="DISABLED">Disabled — Hidden on Customer Form</option>
          <option value="ENABLED_REQUIRED">Enabled — Mandatory (*)</option>
        </select>
      </div>

      {/* Winner Security Approval & Payout Access (Superadmin Policy) */}
      <div
        className="card"
        style={{
          marginBottom: '16px',
          padding: '14px 16px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: '0.92rem' }}>
              🛡️ Security Approval &amp; Prize Payout Permissions (Superadmin Control)
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Choose whether branch Admins can directly approve winner collateral documents or release prize payouts. Only Superadmins can change these switches.
            </p>
          </div>
          {onManageStaffApprovals && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onManageStaffApprovals}
            >
              Per-Foreman &amp; Staff Permissions →
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: approvalPolicy.adminCanApproveSecurity ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              backgroundColor: approvalPolicy.adminCanApproveSecurity ? 'var(--primary-tint, rgba(245,166,35,0.06))' : 'var(--bg, #F8FAFC)',
              cursor: canModifyApprovalPolicy && !approvalSaving ? 'pointer' : 'not-allowed',
              opacity: canModifyApprovalPolicy ? 1 : 0.7,
            }}
          >
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
                Allow Admins to Approve Winner Security
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Admin can approve/reject collateral &amp; unlock payout
              </div>
            </div>
            <input
              type="checkbox"
              checked={approvalPolicy.adminCanApproveSecurity}
              disabled={!canModifyApprovalPolicy || approvalSaving || !onSaveApprovalPolicy}
              onChange={async (e) => {
                if (!onSaveApprovalPolicy) return;
                setApprovalSaving(true);
                setFeedback(null);
                const next = { ...approvalPolicy, adminCanApproveSecurity: e.target.checked };
                const res = await onSaveApprovalPolicy(next);
                setApprovalSaving(false);
                if (res?.success) {
                  setFeedback({
                    type: 'ok',
                    msg: `Branch Admin security approval turned ${next.adminCanApproveSecurity ? 'ON' : 'OFF'}.`,
                  });
                } else {
                  setFeedback({ type: 'err', msg: res?.error || 'Failed to update security approval setting.' });
                }
              }}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
            />
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: approvalPolicy.adminCanReleasePayout ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              backgroundColor: approvalPolicy.adminCanReleasePayout ? 'var(--primary-tint, rgba(245,166,35,0.06))' : 'var(--bg, #F8FAFC)',
              cursor: canModifyApprovalPolicy && !approvalSaving ? 'pointer' : 'not-allowed',
              opacity: canModifyApprovalPolicy ? 1 : 0.7,
            }}
          >
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
                Allow Admins to Release Prize Payouts
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Admin can disburse winner prize once security is approved
              </div>
            </div>
            <input
              type="checkbox"
              checked={approvalPolicy.adminCanReleasePayout}
              disabled={!canModifyApprovalPolicy || approvalSaving || !onSaveApprovalPolicy}
              onChange={async (e) => {
                if (!onSaveApprovalPolicy) return;
                setApprovalSaving(true);
                setFeedback(null);
                const next = { ...approvalPolicy, adminCanReleasePayout: e.target.checked };
                const res = await onSaveApprovalPolicy(next);
                setApprovalSaving(false);
                if (res?.success) {
                  setFeedback({
                    type: 'ok',
                    msg: `Branch Admin prize payout release turned ${next.adminCanReleasePayout ? 'ON' : 'OFF'}.`,
                  });
                } else {
                  setFeedback({ type: 'err', msg: res?.error || 'Failed to update payout release setting.' });
                }
              }}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
            />
          </label>
        </div>
      </div>

      {/* Task 3: Cash Denomination Tally Enforcement Policy */}
      <div
        className="card"
        style={{
          marginBottom: '16px',
          padding: '14px 16px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <strong style={{ fontSize: '0.92rem' }}>💵 Cash Note Denomination Tally (POS &amp; Payouts)</strong>
          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Configure whether cash collections &amp; prize payouts require ₹500–₹1 note counts on Web &amp; Mobile.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="form-control"
            value={denomMode}
            disabled={denomSaving}
            onChange={(e) => handleSaveDenomMode(e.target.value as CashDenominationMode)}
            style={{ width: '210px', fontWeight: 600 }}
          >
            <option value="DISABLED">DISABLED (Hidden)</option>
            <option value="OPTIONAL">OPTIONAL (Shown, not forced)</option>
            <option value="REQUIRED">REQUIRED (Must match amount)</option>
          </select>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            marginBottom: '14px',
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            border: `1px solid ${feedback.type === 'ok' ? 'var(--success)' : 'var(--danger)'}`,
            background: feedback.type === 'ok' ? '#f0fff4' : '#fff0f0',
            color: feedback.type === 'ok' ? 'var(--success)' : 'var(--danger)',
            fontSize: '.86rem',
          }}
        >
          {feedback.msg}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          className="form-control"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={ds.chitTypesSearchPlaceholder || 'Search chit types, regional names (Yela, Kulakkal, Thandal, KSFE)...'}
          style={{ maxWidth: '460px' }}
        />
      </div>

      {Array.from(filteredByCategory.entries()).map(([cat, codes]) => {
        const allEnabled = codes.every((c) => enabledSet.has(c));
        return (
          <div key={cat} style={{ marginBottom: '22px', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '.95rem', color: 'var(--primary-dark)' }}>{categoryTitles[cat]}</h4>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => toggleCategory(cat, !allEnabled)}
              >
                {allEnabled ? (ds.disableCategory || 'Disable category') : (ds.enableCategory || 'Enable all in category')}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {codes.map((code) => {
                const item = CHIT_ENGINE_CATALOG[code];
                const enabled = enabledSet.has(code);
                const isExpanded = expandedCode === code;
                const cfg = typeDefaults[code];
                return (
                  <div
                    key={code}
                    style={{
                      border: `1px solid ${enabled ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '10px',
                      padding: '12px 14px',
                      background: enabled ? 'var(--bg-card, #fff)' : 'var(--bg-alt, #fafafa)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', flex: '1 1 320px' }}>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleType(code)}
                          style={{ marginTop: '4px' }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '.92rem' }}>{dc.engineNames?.[code] || item.name}</strong>
                            <code style={{ fontSize: '.7rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-alt, #f1f5f9)' }}>
                              {code}
                            </code>
                            <span className={`badge badge-${enabled ? 'success' : 'secondary'}`} style={{ fontSize: '.68rem' }}>
                              {enabled ? (ds.enabledWord || 'Enabled') : (ds.disabledWord || 'Disabled')}
                            </span>
                          </div>
                          <div style={{ fontSize: '.75rem', color: 'var(--primary-dark)', marginTop: '2px' }}>
                            {item.regionalNames}
                          </div>
                          <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                            {dc.engineDescs?.[code] || item.description}
                          </p>
                        </div>
                      </label>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setExpandedCode(isExpanded ? null : code)}
                      >
                        {isExpanded ? (ds.hideRules || 'Hide rules') : (ds.configureDefaults || 'Configure defaults')}
                      </button>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
                          <div className="form-group">
                            <label className="form-label">{dc.regulatoryTier || 'Regulatory tier'}</label>
                            <select
                              className="form-control"
                              value={cfg.regulatoryTier}
                              onChange={(e) => updateConfig(code, (c) => ({ ...c, regulatoryTier: e.target.value as any }))}
                            >
                              {REGULATORY_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.scaleTier || 'Scale tier'}</label>
                            <select
                              className="form-control"
                              value={cfg.scaleTier}
                              onChange={(e) => updateConfig(code, (c) => ({ ...c, scaleTier: e.target.value as any }))}
                            >
                              {SCALE_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.collectionFrequency || 'Collection frequency'}</label>
                            <select
                              className="form-control"
                              value={cfg.collectionFrequency}
                              onChange={(e) => updateConfig(code, (c) => ({ ...c, collectionFrequency: e.target.value as any }))}
                            >
                              {COLLECTION_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.payoutAssetType || 'Payout asset'}</label>
                            <select
                              className="form-control"
                              value={cfg.payoutAssetType}
                              onChange={(e) => updateConfig(code, (c) => ({ ...c, payoutAssetType: e.target.value as any }))}
                            >
                              {PAYOUT_ASSET_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.biddingMode || 'Bidding mode'}</label>
                            <select
                              className="form-control"
                              value={cfg.biddingMode}
                              onChange={(e) => updateConfig(code, (c) => ({ ...c, biddingMode: e.target.value as any }))}
                            >
                              {BIDDING_MODES.map((b) => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.foremanCompMode || 'Foreman compensation'}</label>
                            <select
                              className="form-control"
                              value={cfg.foremanCompensation.mode}
                              onChange={(e) =>
                                updateConfig(code, (c) => ({
                                  ...c,
                                  foremanCompensation: { ...c.foremanCompensation, mode: e.target.value as any },
                                }))
                              }
                            >
                              {FOREMAN_COMPENSATION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.commission || 'Commission %'}</label>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              className="form-control"
                              value={cfg.foremanCompensation.commissionPct}
                              onChange={(e) =>
                                updateConfig(code, (c) => ({
                                  ...c,
                                  foremanCompensation: { ...c.foremanCompensation, commissionPct: Number(e.target.value) || 0 },
                                }))
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.flatFeeAmount || 'Flat fee'} ({currencySymbol})</label>
                            <input
                              type="number"
                              min="0"
                              className="form-control"
                              value={cfg.foremanCompensation.flatFeeAmount}
                              onChange={(e) =>
                                updateConfig(code, (c) => ({
                                  ...c,
                                  foremanCompensation: { ...c.foremanCompensation, flatFeeAmount: Number(e.target.value) || 0 },
                                }))
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.dividendMode || 'Dividend distribution'}</label>
                            <select
                              className="form-control"
                              value={cfg.dividendDistributionMode}
                              onChange={(e) => updateConfig(code, (c) => ({ ...c, dividendDistributionMode: e.target.value as any }))}
                            >
                              <option value="ALL_MEMBERS">ALL_MEMBERS</option>
                              <option value="NON_PRIZED_ONLY">NON_PRIZED_ONLY</option>
                              <option value="NON_WINNERS_ONLY">NON_WINNERS_ONLY</option>
                              <option value="DEFERRED_BONUS_POOL">DEFERRED_BONUS_POOL</option>
                              <option value="NONE">NONE</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.minDiscountPct || 'Min discount %'}</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="form-control"
                              value={cfg.discountRules.minDiscountPct}
                              onChange={(e) =>
                                updateConfig(code, (c) => ({
                                  ...c,
                                  discountRules: { ...c.discountRules, minDiscountPct: Number(e.target.value) || 0 },
                                }))
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.maxDiscountPct || 'Max discount %'}</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="form-control"
                              placeholder="Uncapped"
                              value={cfg.discountRules.maxDiscountPct ?? ''}
                              onChange={(e) =>
                                updateConfig(code, (c) => ({
                                  ...c,
                                  discountRules: {
                                    ...c.discountRules,
                                    maxDiscountPct: e.target.value === '' ? null : Number(e.target.value),
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.lateFeeType || 'Late fee type'}</label>
                            <select
                              className="form-control"
                              value={cfg.defaultRules.lateFeeType}
                              onChange={(e) =>
                                updateConfig(code, (c) => ({
                                  ...c,
                                  defaultRules: { ...c.defaultRules, lateFeeType: e.target.value as any },
                                }))
                              }
                            >
                              {LATE_FEE_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.lateFeeValue || 'Late fee value'}</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="form-control"
                              value={cfg.defaultRules.lateFeeValue}
                              onChange={(e) =>
                                updateConfig(code, (c) => ({
                                  ...c,
                                  defaultRules: { ...c.defaultRules, lateFeeValue: Number(e.target.value) || 0 },
                                }))
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{dc.substitutionCutoffPct || 'Substitution cutoff %'}</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="form-control"
                              value={cfg.defaultRules.substitutionCutoffPct}
                              onChange={(e) =>
                                updateConfig(code, (c) => ({
                                  ...c,
                                  defaultRules: { ...c.defaultRules, substitutionCutoffPct: Number(e.target.value) || 0 },
                                }))
                              }
                            />
                          </div>

                          {code === 'AUCTION_RESERVE_PRICE' && (
                            <div className="form-group">
                              <label className="form-label">{dc.reserveStepPct || 'Reserve price step %'}</label>
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                className="form-control"
                                value={cfg.discountRules.reservePriceStepPct}
                                onChange={(e) =>
                                  updateConfig(code, (c) => ({
                                    ...c,
                                    discountRules: { ...c.discountRules, reservePriceStepPct: Number(e.target.value) || 0 },
                                  }))
                                }
                              />
                            </div>
                          )}

                          {code === 'AUCTION_MULTI_DIVISION' && (
                            <>
                              <div className="form-group">
                                <label className="form-label">{dc.lotteryWinnersPerCycle || 'Lottery winners/cycle'}</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control"
                                  value={cfg.multiDivision.lotteryWinnersPerCycle}
                                  onChange={(e) =>
                                    updateConfig(code, (c) => ({
                                      ...c,
                                      multiDivision: { ...c.multiDivision, enabled: true, lotteryWinnersPerCycle: Number(e.target.value) || 0 },
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">{dc.auctionWinnersPerCycle || 'Auction winners/cycle'}</label>
                                <input
                                  type="number"
                                  min="1"
                                  className="form-control"
                                  value={cfg.multiDivision.auctionWinnersPerCycle}
                                  onChange={(e) =>
                                    updateConfig(code, (c) => ({
                                      ...c,
                                      multiDivision: { ...c.multiDivision, enabled: true, auctionWinnersPerCycle: Number(e.target.value) || 1 },
                                    }))
                                  }
                                />
                              </div>
                            </>
                          )}

                          {code === 'BASE_PLUS_PREMIUM' && (
                            <>
                              <div className="form-group">
                                <label className="form-label">{dc.baseInstalment || 'Default base instalment'} ({currencySymbol})</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control"
                                  value={cfg.differentialInstalment.baseInstalment}
                                  onChange={(e) =>
                                    updateConfig(code, (c) => ({
                                      ...c,
                                      differentialInstalment: { ...c.differentialInstalment, enabled: true, baseInstalment: Number(e.target.value) || 0 },
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">{dc.prizedPremium || 'Prized premium'} ({currencySymbol})</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control"
                                  value={cfg.differentialInstalment.prizedPremiumAmount}
                                  onChange={(e) =>
                                    updateConfig(code, (c) => ({
                                      ...c,
                                      differentialInstalment: { ...c.differentialInstalment, enabled: true, prizedPremiumAmount: Number(e.target.value) || 0 },
                                    }))
                                  }
                                />
                              </div>
                            </>
                          )}

                          {(code === 'GOLD_VALUE_ACCUMULATION' || code === 'GOLD_WEIGHT_ACCUMULATION') && (
                            <>
                              <div className="form-group">
                                <label className="form-label">{dc.defaultGoldRate || 'Default gold rate/g'} ({currencySymbol})</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control"
                                  value={cfg.goldScheme?.defaultGoldRatePerGram ?? 0}
                                  onChange={(e) =>
                                    updateConfig(code, (c) => ({
                                      ...c,
                                      goldScheme: {
                                        bonusMonths: c.goldScheme?.bonusMonths ?? 0,
                                        bonusPct: c.goldScheme?.bonusPct ?? 0,
                                        makingChargeWaiverPct: c.goldScheme?.makingChargeWaiverPct ?? 0,
                                        wastageWaiverPct: c.goldScheme?.wastageWaiverPct ?? 0,
                                        defaultGoldRatePerGram: Number(e.target.value) || 0,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">{dc.goldBonusMonths || 'Bonus months'}</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  className="form-control"
                                  value={cfg.goldScheme?.bonusMonths ?? 0}
                                  onChange={(e) =>
                                    updateConfig(code, (c) => ({
                                      ...c,
                                      goldScheme: {
                                        bonusMonths: Number(e.target.value) || 0,
                                        bonusPct: c.goldScheme?.bonusPct ?? 0,
                                        makingChargeWaiverPct: c.goldScheme?.makingChargeWaiverPct ?? 0,
                                        wastageWaiverPct: c.goldScheme?.wastageWaiverPct ?? 0,
                                        defaultGoldRatePerGram: c.goldScheme?.defaultGoldRatePerGram ?? 0,
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </>
                          )}

                          {code === 'HYBRID_SPLIT_PHASE' && (
                            <>
                              <div className="form-group">
                                <label className="form-label">{dc.reservedCycles || 'Reserved Phase-1 cycles'}</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control"
                                  value={cfg.hybridSplitPhase?.reservedCyclesCount ?? 1}
                                  onChange={(e) =>
                                    updateConfig(code, (c) => ({
                                      ...c,
                                      hybridSplitPhase: {
                                        reservedCyclesCount: Number(e.target.value) || 0,
                                        reservedDiscountPct: c.hybridSplitPhase?.reservedDiscountPct ?? 0,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">{dc.reservedDiscountPct || 'Reserved discount %'}</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  className="form-control"
                                  value={cfg.hybridSplitPhase?.reservedDiscountPct ?? 0}
                                  onChange={(e) =>
                                    updateConfig(code, (c) => ({
                                      ...c,
                                      hybridSplitPhase: {
                                        reservedCyclesCount: c.hybridSplitPhase?.reservedCyclesCount ?? 1,
                                        reservedDiscountPct: Number(e.target.value) || 0,
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </>
                          )}

                          {code === 'ASCA_SHG_REVOLVING' && (
                            <div className="form-group">
                              <label className="form-label">{dc.ascaLoanInterestPct || 'Internal loan monthly interest %'}</label>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                className="form-control"
                                value={cfg.ascaPool?.monthlyLoanInterestPct ?? 1.5}
                                onChange={(e) =>
                                  updateConfig(code, (c) => ({
                                    ...c,
                                    ascaPool: {
                                      monthlyLoanInterestPct: Number(e.target.value) || 0,
                                      maxLoanMultiplier: c.ascaPool?.maxLoanMultiplier ?? 3,
                                      adminExpensePerCycle: c.ascaPool?.adminExpensePerCycle ?? 0,
                                    },
                                  }))
                                }
                              />
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px', fontSize: '.82rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={cfg.defaultRules.forfeitDividendOnLate}
                              onChange={(e) =>
                                updateConfig(code, (c) => ({
                                  ...c,
                                  defaultRules: { ...c.defaultRules, forfeitDividendOnLate: e.target.checked },
                                }))
                              }
                            />
                            {dc.forfeitDividendOnLate || 'Forfeit dividend on late payment'}
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={cfg.securityRequirements.requiredForPrized}
                              onChange={(e) =>
                                updateConfig(code, (c) => ({
                                  ...c,
                                  securityRequirements: { ...c.securityRequirements, requiredForPrized: e.target.checked },
                                }))
                              }
                            />
                            {dc.securityRequiredForPrized || 'Require security before payout'}
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="checkbox"
                              checked={cfg.discountRules.uncapped}
                              onChange={(e) =>
                                updateConfig(code, (c) => ({
                                  ...c,
                                  discountRules: { ...c.discountRules, uncapped: e.target.checked },
                                }))
                              }
                            />
                            {dc.uncappedDiscount || 'Uncapped bid discount'}
                          </label>
                        </div>

                        <div style={{ marginTop: '10px' }}>
                          <span style={{ fontSize: '.76rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                            {dc.acceptedSecurityTypes || 'Accepted collateral types'}
                          </span>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {CHIT_SECURITY_TYPES.map((st) => {
                              const checked = cfg.securityRequirements.acceptedTypes.includes(st);
                              return (
                                <label key={st} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.75rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      updateConfig(code, (c) => {
                                        const cur = c.securityRequirements.acceptedTypes;
                                        const next = checked ? cur.filter((x) => x !== st) : [...cur, st];
                                        return {
                                          ...c,
                                          securityRequirements: {
                                            ...c.securityRequirements,
                                            acceptedTypes: next.length ? next : ['NONE'],
                                          },
                                        };
                                      })
                                    }
                                  />
                                  {st}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
