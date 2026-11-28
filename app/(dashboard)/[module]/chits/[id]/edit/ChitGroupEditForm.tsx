'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import FieldHelpIcon from '@/components/chits/FieldHelpIcon';
import { updateChitGroup } from '../../actions';
import {
  CHIT_ENGINE_TYPES,
  CHIT_ENGINE_CATALOG,
  CHIT_SECURITY_TYPES,
  FOREMAN_COMPENSATION_MODES,
  parseChitEngineConfig,
  resolveEngineTypeFromGroup,
  type ChitEngineType,
} from '@/lib/chits/engineTypes';
import { formatCurrency } from '@/lib/utils';
import {
  ChitHeroBarsBg,
  ChitPotHeroIllustration,
} from '@/components/chits/ChitHubIllustrations';
import '../chits-detail.css';

interface EditableChitGroup {
  id: string;
  groupCode?: string | null;
  name: string;
  status: string;
  chitType: string;
  chitEngineType?: string;
  chitValue: number | string;
  monthlyContrib: number | string;
  totalMembers: number;
  durationMonths: number;
  startDate: string;
  auctionType: string;
  auctionFrequency: string;
  auctionMode: string;
  auctionTime?: string | null;
  commissionPct: number | string;
  commissionBasis: string;
  gstPct?: number | string | null;
  minDiscountPct?: number | string | null;
  maxDiscountPct?: number | string | null;
  bidIncrement?: number | string | null;
  dividendPolicy: string;
  dividendDistribution: string;
  hasForemanTicket: boolean;
  roomAdmission: string;
  bellEnabled: boolean;
  bellIntervalSeconds: number;
  bellCount: number;
  bellAutoClose: boolean;
  foremanName?: string | null;
  approvedBankName?: string | null;
  approvedBankAccountNo?: string | null;
  remarks?: string | null;
  engineConfig?: string | null;
  stateCode?: string | null;
  registrationNo?: string | null;
  registrarOffice?: string | null;
  bylawNo?: string | null;
  commencementCertificate?: string | null;
  priorSanctionNumber?: string | null;
  registeredOfficeAddress?: string | null;
  _count?: { members: number };
}

export default function ChitGroupEditForm({
  group,
  currencySymbol = '₹',
  dict,
  enabledChitTypes,
}: {
  group: EditableChitGroup;
  currencySymbol?: string;
  lang?: string;
  dict: { chits: Record<string, unknown> };
  enabledChitTypes?: ChitEngineType[];
}) {
  const d = dict.chits as Record<string, string>;
  const router = useRouter();
  const isDraft = group.status === 'draft';
  const enrolledCount = group._count?.members ?? 0;

  const engineType = resolveEngineTypeFromGroup(group);
  const parsedCfg = parseChitEngineConfig(group.engineConfig, engineType);
  const availableTypes: ChitEngineType[] =
    enabledChitTypes && enabledChitTypes.length > 0
      ? enabledChitTypes
      : ([...CHIT_ENGINE_TYPES] as ChitEngineType[]);
  if (!availableTypes.includes(engineType)) {
    availableTypes.unshift(engineType);
  }

  const rawFreq = group.auctionFrequency || 'monthly';
  const isCustomDays = rawFreq.startsWith('custom_days:');
  const initialCustomDays = isCustomDays ? Number(rawFreq.split(':')[1] || 15) : 15;

  const [selectedEngine, setSelectedEngine] = useState<ChitEngineType>(engineType);
  const [chitType, setChitType] = useState<'registered' | 'unregistered'>(
    group.chitType === 'registered' ? 'registered' : 'unregistered',
  );
  const [chitValue, setChitValue] = useState<number>(Number(group.chitValue) || 100000);
  const [totalMembers, setTotalMembers] = useState<number>(Number(group.totalMembers) || 10);
  const [monthlyContrib, setMonthlyContrib] = useState<number>(Number(group.monthlyContrib) || 10000);
  const [freqMode, setFreqMode] = useState<string>(isCustomDays ? 'custom_days' : rawFreq);
  const [customDays, setCustomDays] = useState<number>(initialCustomDays);
  const [auctionMode, setAuctionMode] = useState<'online' | 'offline'>(
    group.auctionMode === 'online' ? 'online' : 'offline',
  );
  const [bidIncrement, setBidIncrement] = useState<number>(() => {
    const grpInc = group.bidIncrement != null ? Number(group.bidIncrement) : 0;
    const engInc = parsedCfg.discountRules.bidIncrementMultiple > 0 ? parsedCfg.discountRules.bidIncrementMultiple : 0;
    return grpInc > 0 ? grpInc : engInc > 0 ? engInc : 100;
  });
  const [strictBidMultiple, setStrictBidMultiple] = useState<boolean>(Boolean(parsedCfg.discountRules.strictBidMultiple));
  const [allowRepeatSelfBid, setAllowRepeatSelfBid] = useState<boolean>(
    Boolean(parsedCfg.discountRules.allowConsecutiveSelfBid),
  );
  const [tableCashEnabled, setTableCashEnabled] = useState<boolean>(Boolean(parsedCfg.tableCash?.enabled));
  const [acceptedSecurities, setAcceptedSecurities] = useState<string[]>(
    parsedCfg.securityRequirements.acceptedTypes ?? [],
  );
  const [bellEnabled, setBellEnabled] = useState<boolean>(Boolean(group.bellEnabled));
  const [bellAutoClose, setBellAutoClose] = useState<boolean>(Boolean(group.bellAutoClose));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTotalMembersChange = (nextMembers: number) => {
    const clamped = Math.max(Math.max(2, enrolledCount), Math.round(nextMembers || 2));
    setTotalMembers(clamped);
    setMonthlyContrib(Math.round(chitValue / clamped));
  };

  const handleChitValueChange = (nextVal: number) => {
    const clean = Math.max(100, Math.round(nextVal || 0));
    setChitValue(clean);
    if (totalMembers > 0) setMonthlyContrib(Math.round(clean / totalMembers));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await updateChitGroup(group.id, new FormData(e.currentTarget));
    } catch (err: unknown) {
      const e2 = err as { digest?: string; message?: string };
      if (e2?.digest?.startsWith?.('NEXT_REDIRECT') || e2?.message === 'NEXT_REDIRECT') {
        throw err;
      }
      setError(e2?.message || d.failedToUpdate || 'Failed to update chit group');
      setLoading(false);
    }
  };

  const isAuctionTemplate = !['PURE_LOTTERY', 'FIXED_ROTATION', 'NEED_BASED_CONSENSUS'].includes(selectedEngine);

  return (
    <form onSubmit={handleSubmit} className="chit-detail-hub" style={{ maxWidth: '1040px' }}>
      {/* Theme-harmonized Hero Banner */}
      <section className="chit-detail-hero">
        <ChitHeroBarsBg />
        <div className="chit-detail-hero-left">
          <ChitPotHeroIllustration />
          <div style={{ minWidth: 0 }}>
            <Link href={`/chits/${group.id}`} className="chit-detail-back">
              <span className="material-icons-outlined" style={{ fontSize: '15px' }}>arrow_back</span>
              {d.backToChits}
            </Link>
            <h2 className="chit-detail-title">{d.editGroup}: {group.name}</h2>
            <div className="chit-detail-pills">
              <span className="chit-detail-pill">{group.status.toUpperCase()}</span>
              <span className="chit-detail-pill">{formatCurrency(chitValue, currencySymbol)}</span>
              <span className="chit-detail-pill">{enrolledCount}/{totalMembers} Seats</span>
              <span className="chit-detail-pill">{CHIT_ENGINE_CATALOG[selectedEngine].name}</span>
            </div>
          </div>
        </div>
        <div className="chit-detail-actions">
          <button type="button" className="chit-detail-btn-glass" onClick={() => router.back()}>
            {d.cancel}
          </button>
          <button type="submit" className="chit-detail-btn-primary" disabled={loading}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>save</span>
            {loading ? d.saving : d.saveChanges}
          </button>
        </div>
      </section>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--danger-bg)',
            border: '1.5px solid var(--danger)',
            borderRadius: '12px',
            color: 'var(--danger)',
            fontSize: '0.95rem',
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {!isDraft && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--primary-light)',
            border: '1.5px solid var(--primary-border)',
            borderRadius: '12px',
            color: 'var(--text)',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          ℹ️ This group is already <strong>Active</strong> — pot size, tenure, and core commission/dividend math are locked to protect generated cycles &amp; receipts. Operational room settings, bid multipliers, bells, and statutory fields remain editable below.
        </div>
      )}

      {/* Card 1: Group Identity, Pool & Schedule */}
      <div className="chit-detail-card">
        <div className="chit-detail-card-head">
          <h3>📝 Group Identity, Pool &amp; Schedule</h3>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              {d.groupName} *
              <FieldHelpIcon
                title="Chit Group Name"
                text="Display name printed on receipts, PDF statements, and live rooms."
              />
            </label>
            <input name="name" type="text" className="form-control" required defaultValue={group.name} />
          </div>

          {isDraft && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Chit Legal Category</label>
                <select
                  name="chitType"
                  className="form-control"
                  value={chitType}
                  onChange={(e) => setChitType(e.target.value as 'registered' | 'unregistered')}
                >
                  <option value="unregistered">Private / Unregistered Chit</option>
                  <option value="registered">Registered under Chit Funds Act 1982</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Chit Engine Template</label>
                <select
                  name="chitEngineType"
                  className="form-control"
                  value={selectedEngine}
                  onChange={(e) => setSelectedEngine(e.target.value as ChitEngineType)}
                >
                  {availableTypes.map((code) => (
                    <option key={code} value={code}>
                      {CHIT_ENGINE_CATALOG[code].name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Total Chit Pot ({currencySymbol}) *</label>
                <input
                  name="chitValue"
                  type="number"
                  min={100}
                  step="1"
                  required
                  className="form-control"
                  value={chitValue}
                  onChange={(e) => handleChitValueChange(Number(e.target.value))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Members &amp; Cycles *
                  {enrolledCount > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                      (min {enrolledCount} enrolled)
                    </span>
                  )}
                </label>
                <input
                  name="totalMembers"
                  type="number"
                  min={Math.max(2, enrolledCount)}
                  max={100}
                  required
                  className="form-control"
                  value={totalMembers}
                  onChange={(e) => handleTotalMembersChange(Number(e.target.value))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Base Installment ({currencySymbol}) *</label>
                <input
                  name="monthlyContrib"
                  type="number"
                  min={1}
                  step="1"
                  required
                  className="form-control"
                  value={monthlyContrib}
                  onChange={(e) => setMonthlyContrib(Number(e.target.value) || 1)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Start Date *</label>
                <input
                  name="startDate"
                  type="date"
                  required
                  className="form-control"
                  defaultValue={group.startDate ? String(group.startDate).slice(0, 10) : ''}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Collection / Auction Frequency</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    name="auctionFrequency"
                    className="form-control"
                    value={freqMode}
                    onChange={(e) => setFreqMode(e.target.value)}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="daily">Daily</option>
                    <option value="custom_days">Custom Every N Days</option>
                  </select>
                  {freqMode === 'custom_days' && (
                    <input
                      name="customIntervalDays"
                      type="number"
                      min={1}
                      max={180}
                      className="form-control"
                      style={{ width: '90px' }}
                      value={customDays}
                      onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
                    />
                  )}
                </div>
              </div>
            </>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Auction Room Mode &amp; Default Time</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                name="auctionMode"
                className="form-control"
                value={auctionMode}
                onChange={(e) => setAuctionMode(e.target.value as 'online' | 'offline')}
              >
                <option value="online">Online Live</option>
                <option value="offline">In-Person / Offline</option>
              </select>
              <input
                name="auctionTime"
                type="time"
                className="form-control"
                style={{ width: '135px' }}
                defaultValue={group.auctionTime ?? '18:00'}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Member Room Entry Policy</label>
            <select name="roomAdmission" className="form-control" defaultValue={group.roomAdmission || 'auto'}>
              <option value="auto">Auto-Admit Enrolled Members</option>
              <option value="approval">Waiting Room Approval (Foreman Admits)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Card 2: Commission, Dividend, Bid Multiplier, Bell & Security Rules */}
      <div className="chit-detail-card">
        <div className="chit-detail-card-head">
          <h3>⚖️ Bidding, Commission, Bell &amp; Collateral Rules</h3>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isDraft && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{d.commission} (%)</label>
                <input
                  name="commissionPct"
                  type="number"
                  className="form-control"
                  step="0.5"
                  min="0"
                  max="20"
                  defaultValue={Number(group.commissionPct)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Commission Calculated On</label>
                <select name="commissionBasis" className="form-control" defaultValue={group.commissionBasis || 'BID_DISCOUNT'}>
                  <option value="BID_DISCOUNT">Winning Bid Discount</option>
                  <option value="CHIT_VALUE">Total Pot Value (Standard 5%)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Foreman Compensation Mode</label>
                <select
                  name="foremanCompensationMode"
                  className="form-control"
                  defaultValue={parsedCfg.foremanCompensation.mode}
                >
                  {FOREMAN_COMPENSATION_MODES.map((m) => (
                    <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">GST on Commission (%)</label>
                <input
                  name="gstPct"
                  type="number"
                  step="0.1"
                  min="0"
                  max="30"
                  className="form-control"
                  defaultValue={group.gstPct != null ? Number(group.gstPct) : ''}
                  placeholder="Optional"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Who Gets Auction Dividend?</label>
                <select name="dividendPolicy" className="form-control" defaultValue={group.dividendPolicy || 'ALL_MEMBERS'}>
                  <option value="ALL_MEMBERS">Equal to All Members</option>
                  <option value="NON_PRIZED_ONLY">Non-Winners Only</option>
                  <option value="NON_WINNERS_ONLY">Everyone Except Current Winner</option>
                  <option value="NONE">No Dividend (Fixed Pool)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">How Dividend Is Paid</label>
                <select name="dividendDistribution" className="form-control" defaultValue={group.dividendDistribution || 'ADJUST_NEXT_DUE'}>
                  <option value="ADJUST_NEXT_DUE">Reduce Next Installment (Standard)</option>
                  <option value="CASH_PAYOUT">Pay Out Separately</option>
                  <option value="ACCUMULATE">Save Until Chit Finishes</option>
                  <option value="DEFERRED_BONUS_POOL">Deferred Maturity Bonus</option>
                  <option value="NONE">None</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Min Bid Discount (%)</label>
                <input
                  name="minDiscountPct"
                  type="number"
                  step="0.5"
                  min="0"
                  max="90"
                  className="form-control"
                  defaultValue={group.minDiscountPct != null ? Number(group.minDiscountPct) : ''}
                  placeholder="Optional"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Max Bid Discount Cap (%)</label>
                <input
                  name="maxDiscountPct"
                  type="number"
                  step="0.5"
                  min="0"
                  max="90"
                  className="form-control"
                  defaultValue={group.maxDiscountPct != null ? Number(group.maxDiscountPct) : ''}
                  placeholder="e.g. 40"
                />
              </div>
            </div>
          )}

          {/* Bid Multiplier & Narrow Bid Rule (Editable in Draft & Active) */}
          {isAuctionTemplate && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <input type="hidden" name="bidIncrement" value={bidIncrement} />
              <input type="hidden" name="strictBidMultiple" value={String(bidIncrement > 1 && strictBidMultiple)} />
              <input type="hidden" name="allowConsecutiveSelfBid" value={String(allowRepeatSelfBid)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <strong style={{ fontSize: '0.94rem', color: 'var(--text)' }}>
                  Bid Multiplier &amp; Narrow Bid Restriction ({currencySymbol})
                </strong>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
                  {bidIncrement <= 1
                    ? `Narrow ${currencySymbol}1 increments allowed`
                    : strictBidMultiple
                      ? `Exact ${currencySymbol}${bidIncrement.toLocaleString('en-IN')} multiples enforced`
                      : `Min step ${currencySymbol}${bidIncrement.toLocaleString('en-IN')}`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {[1, 10, 50, 100, 500, 1000].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      setBidIncrement(step);
                      setStrictBidMultiple(step > 1);
                    }}
                    className={`btn btn-sm ${bidIncrement === step ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {currencySymbol}{step.toLocaleString('en-IN')}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  className="form-control"
                  style={{ width: '110px' }}
                  value={bidIncrement}
                  onChange={(e) => {
                    const val = Math.max(1, Math.round(Number(e.target.value) || 1));
                    setBidIncrement(val);
                    if (val <= 1) setStrictBidMultiple(false);
                  }}
                />
                {bidIncrement > 1 && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={strictBidMultiple}
                      onChange={(e) => setStrictBidMultiple(e.target.checked)}
                    />
                    <span>Restrict Narrow Bids (Strict multiples)</span>
                  </label>
                )}
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={allowRepeatSelfBid}
                  onChange={(e) => setAllowRepeatSelfBid(e.target.checked)}
                />
                <span>Allow Repeat Self-Bid (multi-ticket holder can bid consecutively without alternating)</span>
              </label>
            </div>
          )}

          {/* Foreman Ticket & 3-Bell Timer Controls */}
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
            {isDraft && (
              <>
                <input type="hidden" name="hasForemanTicket" value={group.hasForemanTicket ? 'true' : 'false'} />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    defaultChecked={group.hasForemanTicket}
                    onChange={(e) => {
                      const hidden = e.currentTarget.form?.elements.namedItem('hasForemanTicket') as HTMLInputElement | null;
                      if (hidden) hidden.value = e.target.checked ? 'true' : 'false';
                    }}
                  />
                  <span>Foreman Takes Period 1 Pot</span>
                </label>
              </>
            )}

            <input type="hidden" name="bellEnabled" value={String(bellEnabled)} />
            <input type="hidden" name="bellAutoClose" value={String(bellAutoClose)} />
            <input type="hidden" name="tableCashEnabled" value={String(tableCashEnabled)} />
            <label className="checkbox-label">
              <input type="checkbox" checked={bellEnabled} onChange={(e) => setBellEnabled(e.target.checked)} />
              <span>Enable 3-Bell Auction Timer</span>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={bellAutoClose} onChange={(e) => setBellAutoClose(e.target.checked)} />
              <span>Auto-Close &amp; Prompt Winner on 3rd Bell</span>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={tableCashEnabled} onChange={(e) => setTableCashEnabled(e.target.checked)} />
              <span>Table Cash Before Auction</span>
              <FieldHelpIcon
                title="Pre-Auction Table Cash Settlement"
                text="Requires enrolled members to settle their cycle installment before live bidding opens (with a Start Live Anyway option for late payers, and post-auction settlement for the winner)."
              />
            </label>

            {bellEnabled && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                  Bell Interval (sec):
                  <input
                    name="bellIntervalSeconds"
                    type="number"
                    min={5}
                    max={600}
                    className="form-control"
                    style={{ width: '84px', display: 'inline-block', marginLeft: '6px' }}
                    defaultValue={group.bellIntervalSeconds || 60}
                  />
                </label>
                <label style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                  Total Bells:
                  <input
                    name="bellCount"
                    type="number"
                    min={1}
                    max={5}
                    className="form-control"
                    style={{ width: '72px', display: 'inline-block', marginLeft: '6px' }}
                    defaultValue={group.bellCount || 3}
                  />
                </label>
              </div>
            )}
          </div>

          {isDraft && (
            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <input type="hidden" name="securityConfigSubmitted" value="1" />
              <div style={{ fontSize: '0.94rem', fontWeight: 700, marginBottom: '8px' }}>
                Accepted Winner Collateral Security Types
              </div>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {CHIT_SECURITY_TYPES.filter((s) => s !== 'NONE').map((sec) => {
                  const checked = acceptedSecurities.includes(sec);
                  return (
                    <label key={sec} className="checkbox-label">
                      <input
                        type="checkbox"
                        name="acceptedSecurityTypes"
                        value={sec}
                        checked={checked}
                        onChange={(e) =>
                          setAcceptedSecurities((prev) =>
                            e.target.checked ? [...prev, sec] : prev.filter((x) => x !== sec),
                          )
                        }
                      />
                      <span>{sec.replace(/_/g, ' ')}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card 3: State, Statutory Registrar & Bank Details */}
      <div className="chit-detail-card">
        <div className="chit-detail-card-head">
          <h3>🏛️ State, Registrar &amp; Foreman Compliance Details</h3>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Statutory State Jurisdiction</label>
              <select name="stateCode" className="form-control" defaultValue={group.stateCode ?? 'TN'}>
                <option value="TN">Tamil Nadu (TN Rules 1984)</option>
                <option value="DL">Delhi (DL Rules 2007)</option>
                <option value="GENERIC">Central Act (1982)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Foreman Name (for Statutory Forms)</label>
              <input name="foremanName" type="text" className="form-control" defaultValue={group.foremanName ?? ''} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Prior Sanction No. (PSO / Form I)</label>
              <input name="priorSanctionNumber" type="text" className="form-control" defaultValue={group.priorSanctionNumber ?? ''} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Bylaw No.</label>
              <input name="bylawNo" type="text" className="form-control" defaultValue={group.bylawNo ?? ''} placeholder="e.g. BL/TN/2026/001" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Registration No.</label>
              <input name="registrationNo" type="text" className="form-control" defaultValue={group.registrationNo ?? ''} placeholder="e.g. CHIT/TN/2026/001" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Registrar Office</label>
              <input name="registrarOffice" type="text" className="form-control" defaultValue={group.registrarOffice ?? ''} placeholder="e.g. Erode Sub-Registrar" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Commencement Certificate No.</label>
              <input name="commencementCertificate" type="text" className="form-control" defaultValue={group.commencementCertificate ?? ''} placeholder="Optional Form VII / Certificate No." />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Approved Escrow / Bank Name</label>
              <input name="approvedBankName" type="text" className="form-control" defaultValue={group.approvedBankName ?? ''} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Approved Bank Account No.</label>
              <input name="approvedBankAccountNo" type="text" className="form-control" defaultValue={group.approvedBankAccountNo ?? ''} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Registered Office Address (for Statutory Registers)</label>
            <input name="registeredOfficeAddress" type="text" className="form-control" defaultValue={group.registeredOfficeAddress ?? ''} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Group Notes / Remarks</label>
            <textarea name="remarks" rows={2} className="form-control" defaultValue={group.remarks ?? ''} placeholder="Optional internal remarks or group guidelines..." />
          </div>
        </div>
      </div>
    </form>
  );
}
