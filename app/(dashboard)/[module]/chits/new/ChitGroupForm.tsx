'use client';

import { useState } from 'react';
import { createChitGroup } from '../actions';
import { useRouter } from 'next/navigation';
import { nextPeriodDate, frequencyLabel, type FrequencyConfig } from '@/lib/chits/frequency';

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 0, label: 'Sun' },
];

const sectionStyle: React.CSSProperties = { marginBottom: '20px' };
const sectionTitleStyle: React.CSSProperties = { margin: '0 0 12px', fontSize: '.95rem', borderBottom: '1px solid var(--border)', paddingBottom: '6px' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
const hintStyle: React.CSSProperties = { fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: '4px' };

export default function ChitGroupForm({
  customers,
  currencySymbol,
  dict,
}: {
  customers: { id: string; name: string; customerCode: string }[];
  currencySymbol: string;
  dict: any;
}) {
  const d = dict.chits;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalMembers, setTotalMembers] = useState(5);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [chitValue, setChitValue] = useState(0);
  const [monthlyContrib, setMonthlyContrib] = useState(0);
  const [chitType, setChitType] = useState('unregistered');
  const [auctionType, setAuctionType] = useState('open_manual');
  const [auctionFrequency, setAuctionFrequency] = useState('monthly');
  const [frequencyMode, setFrequencyMode] = useState<'preset' | 'custom'>('preset');
  const [customUnit, setCustomUnit] = useState<'day' | 'week' | 'month'>('month');
  const [customInterval, setCustomInterval] = useState(1);
  const [customWeekdays, setCustomWeekdays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [bidStartAtCommission, setBidStartAtCommission] = useState(true);
  const [commissionPct, setCommissionPct] = useState(5);
  const [hasForemanTicket, setHasForemanTicket] = useState(false);
  const [winnerInterestType, setWinnerInterestType] = useState('NONE');
  const [winnerInterestValue, setWinnerInterestValue] = useState(0);
  const [winnerInterestPeriods, setWinnerInterestPeriods] = useState(0);

  const isDrawType = auctionType === 'lottery' || auctionType === 'fixed_rotation';

  const toggleWeekday = (day: number) => {
    setCustomWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const previewDates = (() => {
    const base = startDate ? new Date(startDate) : null;
    if (!base || Number.isNaN(base.getTime())) return [];
    const freq: FrequencyConfig =
      frequencyMode === 'custom'
        ? { unit: customUnit, interval: customInterval, weekdays: customWeekdays.length ? customWeekdays : null }
        : auctionFrequency === 'daily'
          ? { unit: 'day', interval: 1 }
          : auctionFrequency === 'weekly'
            ? { unit: 'week', interval: 1 }
            : auctionFrequency === 'fortnightly'
              ? { unit: 'week', interval: 2 }
              : { unit: 'month', interval: 1 };
    return [1, 2, 3].map((period) => nextPeriodDate(base, period, freq));
  })();
  const interestPerPeriod = winnerInterestType === 'FIXED'
    ? winnerInterestValue
    : winnerInterestType === 'PERCENT'
      ? (chitValue * winnerInterestValue) / 100
      : 0;
  const winnerDuePreview = monthlyContrib + interestPerPeriod;

  const addMemberSlot = () => {
    if (selectedMembers.length < totalMembers) {
      setSelectedMembers([...selectedMembers, '']);
    }
  };

  const updateMember = (idx: number, val: string) => {
    const updated = [...selectedMembers];
    updated[idx] = val;
    setSelectedMembers(updated);
  };

  const removeMember = (idx: number) => {
    setSelectedMembers(selectedMembers.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (chitValue > 0 && monthlyContrib > 0 && chitValue !== monthlyContrib * totalMembers) {
      setError(`Chit value must equal installment × total members (${monthlyContrib} × ${totalMembers} = ${monthlyContrib * totalMembers})`);
      setLoading(false);
      return;
    }
    const fd = new FormData(e.currentTarget);
    selectedMembers.forEach((id) => {
      if (id) fd.append('memberIds', id);
    });
    try {
      await createChitGroup(fd);
    } catch (err: any) {
      setError(err.message || d.failed);
      setLoading(false);
    }
  };

  const availableCustomers = (idx: number) =>
    customers.filter(
      (c) => !selectedMembers.some((id, i) => i !== idx && id === c.id)
    );

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: '760px' }}>
      <div className="card-header"><h3>{d.createGroup}</h3></div>

      {error && <div className="alert alert-danger" style={{ margin: '0 0 16px', padding: '10px 14px', background: '#fff0f0', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)' }}>{error}</div>}
      <p style={{ ...hintStyle, marginBottom: '16px' }}>
        Groups are saved as drafts. A group can be activated only after members, tickets, and (for registered chits) compliance details are complete.
      </p>

      {/* 1. Basic details */}
      <div style={sectionStyle}>
        <h4 style={sectionTitleStyle}>1. Basic details</h4>
        <div style={gridStyle}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">{d.groupName} *</label>
            <input name="name" type="text" className="form-control" required placeholder="e.g. January 2026 Group" />
          </div>
          <div className="form-group">
            <label className="form-label">{d.chitValue} ({currencySymbol}) *</label>
            <input name="chitValue" type="number" className="form-control" required min="1000" placeholder="e.g. 100000" onChange={(e) => setChitValue(Number(e.target.value))} />
            {chitValue > 0 && monthlyContrib > 0 && chitValue !== monthlyContrib * totalMembers && (
              <p style={{ ...hintStyle, color: 'var(--danger)' }}>
                Must equal {monthlyContrib} × {totalMembers} = {monthlyContrib * totalMembers}
              </p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Installment amount ({currencySymbol}) *</label>
            <input name="monthlyContrib" type="number" className="form-control" required min="100" placeholder="e.g. 5000" onChange={(e) => setMonthlyContrib(Number(e.target.value))} />
            <p style={hintStyle}>Amount due per period, whatever the frequency.</p>
          </div>
          <div className="form-group">
            <label className="form-label">{d.totalMembers} *</label>
            <input
              name="totalMembers"
              type="number"
              className="form-control"
              required
              min="2"
              max="100"
              value={totalMembers}
              onChange={(e) => setTotalMembers(parseInt(e.target.value) || 2)}
            />
            <p style={hintStyle}>One prize per ticket — the group runs {totalMembers} periods.</p>
          </div>
          <div className="form-group">
            <label className="form-label">{d.startDate} *</label>
            <input name="startDate" type="date" className="form-control" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Chit type *</label>
            <select name="chitType" className="form-control" value={chitType} onChange={(e) => setChitType(e.target.value)}>
              <option value="unregistered">Unregistered (private/informal chit)</option>
              <option value="registered">Registered (registrar-approved chit)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Chit style */}
      <div style={sectionStyle}>
        <h4 style={sectionTitleStyle}>2. Chit style</h4>
        <div style={gridStyle}>
          <div className="form-group">
            <label className="form-label">Auction type *</label>
            <select name="auctionType" className="form-control" value={auctionType} onChange={(e) => setAuctionType(e.target.value)}>
              <option value="open_manual">Open auction — staff enters bids</option>
              <option value="open_live">Open live — online bidding room</option>
              <option value="sealed">Sealed tender — bids hidden until close</option>
              <option value="lottery">Lottery — winner drawn at random</option>
              <option value="fixed_rotation">Fixed rotation — payout by ticket order</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Frequency *</label>
            <select
              className="form-control"
              value={frequencyMode === 'custom' ? 'custom' : auctionFrequency}
              onChange={(e) => {
                if (e.target.value === 'custom') { setFrequencyMode('custom'); }
                else { setFrequencyMode('preset'); setAuctionFrequency(e.target.value); }
              }}
            >
              <option value="monthly">Monthly</option>
              <option value="fortnightly">Bi-weekly (every 2 weeks)</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
              <option value="custom">Custom…</option>
            </select>
            {/* Hidden fields carry the actual values submitted to the server action. */}
            <input type="hidden" name="auctionFrequency" value={frequencyMode === 'custom' ? 'monthly' : auctionFrequency} />
            {frequencyMode === 'custom' && (
              <>
                <input type="hidden" name="frequencyUnit" value={customUnit} />
                <input type="hidden" name="frequencyInterval" value={customInterval} />
                <input type="hidden" name="frequencyWeekdays" value={customWeekdays.join(',')} />
              </>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Auction day</label>
            <input name="auctionDay" type="number" className="form-control" min="1" max="31" placeholder={auctionFrequency === 'weekly' ? '1-7 (Mon-Sun)' : 'Day of month'} />
          </div>
          {frequencyMode === 'custom' && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Custom frequency</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.85rem' }}>Every</span>
                <input
                  type="number" min="1" className="form-control" style={{ width: '70px' }}
                  value={customInterval} onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <select className="form-control" style={{ width: 'auto' }} value={customUnit} onChange={(e) => setCustomUnit(e.target.value as 'day' | 'week' | 'month')}>
                  <option value="day">day(s)</option>
                  <option value="week">week(s)</option>
                  <option value="month">month(s)</option>
                </select>
                {customUnit !== 'month' && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {WEEKDAY_OPTIONS.map((w) => (
                      <button
                        type="button" key={w.value}
                        onClick={() => toggleWeekday(w.value)}
                        className={`btn btn-sm ${customWeekdays.includes(w.value) ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p style={hintStyle}>
                {customWeekdays.length ? 'Only the picked weekdays count as a period.' : 'Leave weekdays unpicked to step by the interval above.'}
              </p>
            </div>
          )}
          {previewDates.length > 0 && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <p style={{ ...hintStyle, margin: 0 }}>
                {frequencyLabel(
                  frequencyMode === 'custom'
                    ? { unit: customUnit, interval: customInterval, weekdays: customWeekdays.length ? customWeekdays : null }
                    : auctionFrequency === 'daily' ? { unit: 'day', interval: 1 }
                    : auctionFrequency === 'weekly' ? { unit: 'week', interval: 1 }
                    : auctionFrequency === 'fortnightly' ? { unit: 'week', interval: 2 }
                    : { unit: 'month', interval: 1 },
                )} — first periods: {previewDates.map((d2) => d2.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })).join(', ')}
              </p>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Default auction time</label>
            <input name="auctionTime" type="time" className="form-control" />
            <p style={hintStyle}>Used when activation creates each period schedule.</p>
          </div>
          {isDrawType && (
            <div className="form-group">
              <label className="form-label">Fixed discount %</label>
              <input name="fixedDiscountPct" type="number" className="form-control" step="0.5" min="0" placeholder="e.g. 0 or 10" />
              <p style={hintStyle}>Predetermined discount for every period. Dividend is auto-split from it.</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Registration & approval — registered chits only */}
      {chitType === 'registered' && (
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>3. Registration &amp; approval</h4>
          <div style={gridStyle}>
            <div className="form-group">
              <label className="form-label">Registration number</label>
              <input name="registrationNo" type="text" className="form-control" placeholder="e.g. TN/ERD/2026/123" />
            </div>
            <div className="form-group">
              <label className="form-label">Registration date</label>
              <input name="registrationDate" type="date" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">Registrar office</label>
              <input name="registrarOffice" type="text" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">By-law number</label>
              <input name="bylawNo" type="text" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">Commencement certificate</label>
              <input name="commencementCertificate" type="text" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">GST % on commission</label>
              <input name="gstPct" type="number" className="form-control" step="0.5" min="0" placeholder="e.g. 12" />
            </div>
            <div className="form-group">
              <label className="form-label">Approved bank name</label>
              <input name="approvedBankName" type="text" className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">Approved bank account no</label>
              <input name="approvedBankAccountNo" type="text" className="form-control" />
            </div>
          </div>
          <p style={hintStyle}>Required before a registered group can be activated. Drafts can be saved incomplete.</p>
        </div>
      )}

      {/* 4. Foreman & commission */}
      <div style={sectionStyle}>
        <h4 style={sectionTitleStyle}>{chitType === 'registered' ? '4' : '3'}. Foreman &amp; commission</h4>
        <div style={gridStyle}>
          <div className="form-group">
            <label className="form-label">Foreman name{chitType === 'registered' ? '' : ' (optional)'}</label>
            <input name="foremanName" type="text" className="form-control" />
          </div>
          <div className="form-group">
            <label className="form-label">{d.commission} % *</label>
            <input
              name="commissionPct" type="number" className="form-control" step="0.5" min="0" max="20"
              value={commissionPct} onChange={(e) => setCommissionPct(Number(e.target.value) || 0)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Commission basis</label>
            <select name="commissionBasis" className="form-control" defaultValue="BID_DISCOUNT">
              <option value="BID_DISCOUNT">% of bid discount</option>
              <option value="CHIT_VALUE">% of chit value</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Commission cap %</label>
            <input name="foremanCommissionCapPct" type="number" className="form-control" step="0.5" min="0" placeholder="optional" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            {/* Unchecked checkboxes submit nothing at all, so a hidden field
                carries the authoritative true/false value the server reads. */}
            <input type="hidden" name="bidStartAtCommission" value={String(bidStartAtCommission)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem' }}>
              <input
                type="checkbox"
                checked={bidStartAtCommission}
                onChange={(e) => setBidStartAtCommission(e.target.checked)}
              />
              Start bidding from commission amount
            </label>
            {bidStartAtCommission && chitValue > 0 && (
              <p style={hintStyle}>
                Starting bid discount: {currencySymbol}{Math.round((chitValue * commissionPct) / 100).toLocaleString('en-IN')}
                {' '}(prize starts at {currencySymbol}{Math.round(chitValue - (chitValue * commissionPct) / 100).toLocaleString('en-IN')})
              </p>
            )}
            {!bidStartAtCommission && (
              <p style={hintStyle}>First bid may start at any discount, subject to Min discount % below (if set).</p>
            )}
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem' }}>
              <input
                name="hasForemanTicket"
                type="checkbox"
                value="true"
                checked={hasForemanTicket}
                onChange={(e) => setHasForemanTicket(e.target.checked)}
              />
              Foreman/company holds a ticket and takes the period-1 prize without auction
            </label>
            {hasForemanTicket && (
              <p style={hintStyle}>Mark exactly one member as the foreman ticket from the group detail page before activation.</p>
            )}
          </div>
        </div>
      </div>

      {/* 5. Bid & dividend rules */}
      <div style={sectionStyle}>
        <h4 style={sectionTitleStyle}>{chitType === 'registered' ? '5' : '4'}. {isDrawType ? 'Dividend rules' : 'Bid & dividend rules'}</h4>
        <div style={gridStyle}>
          {!isDrawType && (
            <>
              <div className="form-group">
                <label className="form-label">Min discount %</label>
                <input name="minDiscountPct" type="number" className="form-control" step="0.5" min="0" placeholder="defaults to commission %" />
              </div>
              <div className="form-group">
                <label className="form-label">Max discount %</label>
                <input name="maxDiscountPct" type="number" className="form-control" step="0.5" min="0" placeholder="e.g. 30" />
              </div>
              <div className="form-group">
                <label className="form-label">Bid increment ({currencySymbol})</label>
                <input name="bidIncrement" type="number" className="form-control" min="0" placeholder="optional step, e.g. 500" />
              </div>
              <div className="form-group">
                <label className="form-label">Tie break at cap</label>
                <select name="tieBreakRule" className="form-control" defaultValue="EARLIEST_BID">
                  <option value="EARLIEST_BID">Earliest bid wins</option>
                  <option value="LOTTERY_AMONG_TIED">Lottery among tied bidders</option>
                </select>
              </div>
            </>
          )}
          <div className="form-group">
            <label className="form-label">Dividend shared by</label>
            <select name="dividendPolicy" className="form-control" defaultValue="ALL_MEMBERS">
              <option value="ALL_MEMBERS">All members (winner included)</option>
              <option value="NON_WINNERS_ONLY">Non-winners only</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Dividend distribution</label>
            <select name="dividendDistribution" className="form-control" defaultValue="ADJUST_NEXT_DUE">
              <option value="ADJUST_NEXT_DUE">Reduce next installment</option>
              <option value="CASH_PAYOUT">Pay out in cash each period</option>
              <option value="ACCUMULATE">Accumulate, settle at closure</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Dividend rounding</label>
            <select name="dividendRounding" className="form-control" defaultValue="0">
              <option value="0">Exact (no rounding)</option>
              <option value="1">Round down to {currencySymbol}1</option>
              <option value="10">Round down to {currencySymbol}10</option>
            </select>
            <p style={hintStyle}>The rounding remainder is booked as foreman income — nothing is lost.</p>
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h4 style={sectionTitleStyle}>Winner interest</h4>
        <div style={gridStyle}>
          <div className="form-group">
            <label className="form-label">Live room admission</label>
            <select name="roomAdmission" className="form-control" defaultValue="auto">
              <option value="auto">Auto-admit joiners</option>
              <option value="approval">Organizer approves each joiner</option>
            </select>
            <p style={hintStyle}>With approval, subscribers wait in a lobby until you admit them.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Winner interest</label>
            <select
              name="winnerInterestType"
              className="form-control"
              value={winnerInterestType}
              onChange={(e) => setWinnerInterestType(e.target.value)}
            >
              <option value="NONE">None</option>
              <option value="FIXED">Fixed amount per period</option>
              <option value="PERCENT">Percent of chit value per period</option>
            </select>
          </div>
          {winnerInterestType !== 'NONE' && (
            <>
              <div className="form-group">
                <label className="form-label">{winnerInterestType === 'FIXED' ? `Interest amount (${currencySymbol})` : 'Interest percent'}</label>
                <input
                  name="winnerInterestValue"
                  type="number"
                  className="form-control"
                  min="0"
                  step="0.01"
                  value={winnerInterestValue || ''}
                  onChange={(e) => setWinnerInterestValue(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Interest periods</label>
                <input
                  name="winnerInterestPeriods"
                  type="number"
                  className="form-control"
                  min="1"
                  step="1"
                  value={winnerInterestPeriods || ''}
                  onChange={(e) => setWinnerInterestPeriods(Number(e.target.value))}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <p style={{ ...hintStyle, margin: 0 }}>
                  Preview: winner pays {currencySymbol}{Math.round(winnerDuePreview).toLocaleString('en-IN')} for the next {winnerInterestPeriods || 0} period(s)
                  {monthlyContrib > 0 && interestPerPeriod > 0
                    ? ` (${currencySymbol}${monthlyContrib.toLocaleString('en-IN')} base + ${currencySymbol}${Math.round(interestPerPeriod).toLocaleString('en-IN')} interest).`
                    : '.'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Members */}
      <div style={sectionStyle}>
        <h4 style={sectionTitleStyle}>{chitType === 'registered' ? '6' : '5'}. {d.members} ({selectedMembers.length}/{totalMembers})</h4>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={addMemberSlot}
            disabled={selectedMembers.length >= totalMembers}
          >
            + {d.addMember}
          </button>
        </div>
        {selectedMembers.map((memberId, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
            <span style={{ width: '24px', color: 'var(--text-secondary)', fontSize: '.85rem' }}>{idx + 1}.</span>
            <select
              className="form-control"
              value={memberId}
              onChange={(e) => updateMember(idx, e.target.value)}
              required
            >
              <option value="">{d.selectCustomer}</option>
              {availableCustomers(idx).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>
              ))}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeMember(idx)}>
              <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--danger)' }}>close</span>
            </button>
          </div>
        ))}
        {selectedMembers.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>{d.clickAddMember}</p>
        )}
        <p style={hintStyle}>Ticket numbers are assigned in order; ticket shares, fractions, and the foreman ticket can be edited on the group page before activation.</p>
      </div>

      <div className="form-group" style={sectionStyle}>
        <label className="form-label">Remarks</label>
        <textarea name="remarks" className="form-control" rows={2} />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" className="btn btn-primary" disabled={loading || selectedMembers.filter(Boolean).length > totalMembers}>
          {loading ? d.creating : d.createGroup}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>{d.cancel}</button>
      </div>
    </form>
  );
}
