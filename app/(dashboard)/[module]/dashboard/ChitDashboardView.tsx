import Link from '@/components/layout/DashboardLink';
import type { ChitFundsDashboardOverview } from '@/lib/chits/dashboard';
import { formatCurrency } from '@/lib/utils';
import './chit-dashboard.css';

interface ChitDashboardViewProps {
  data: ChitFundsDashboardOverview;
  currencySymbol: string;
  dict: any;
}

function formatRelativeMinutes(mins: number): string {
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function humanizeActivityAction(action: string, entityType: string): string {
  const cleanEntity = entityType.replace(/^chit_?/, '').replaceAll('_', ' ').trim();
  const cleanAction = action.replaceAll('_', ' ').trim();
  return `${cleanAction}${cleanEntity ? ` (${cleanEntity})` : ''}`;
}

function formatCompactMoney(value: number, sym: string): string {
  if (value >= 10_000_000) return `${sym}${(value / 10_000_000).toFixed(1)}Cr`;
  if (value >= 100_000) return `${sym}${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000) return `${sym}${Math.round(value / 1_000)}K`;
  return `${sym}${Math.round(value)}`;
}

export default function ChitDashboardView({ data, currencySymbol, dict }: ChitDashboardViewProps) {
  const c = dict.chits;
  const d = dict.dashboard;
  const { kpis, heroAuction, groupOverview, settlementSummary, collectionPerformance, payoutSummary, upcomingAuctions, recentActivity } = data;

  // Collection SVG chart coordinates (viewBox 340x132)
  const chartPoints = collectionPerformance.points;
  const maxY = Math.max(
    1,
    ...chartPoints.map((pt) => Math.max(pt.collected, pt.expected)),
  );
  const svgW = 340;
  const svgH = 128;
  const padL = 42;
  const padR = 14;
  const padT = 18;
  const padB = 22;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const coords = chartPoints.map((pt, idx) => {
    const x =
      chartPoints.length <= 1
        ? padL + plotW / 2
        : padL + (idx / (chartPoints.length - 1)) * plotW;
    const y = padT + plotH - (Math.min(maxY, Math.max(0, pt.collected)) / maxY) * plotH;
    return { ...pt, x, y };
  });
  const polylinePoints = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    coords.length > 0
      ? `M ${coords[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} ` +
        coords.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
        ` L ${coords[coords.length - 1].x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : '';
  const highlightCoord = coords.length > 0 ? coords[coords.length - 1] : null;

  // Payout SVG circular ring math
  const donutRadius = 38;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutOffset = donutCircumference * (1 - Math.min(100, Math.max(0, payoutSummary.payoutProgressPct)) / 100);

  return (
    <div className="chit-dash-wrap">
      {/* Row 1: 5 Theme-Aligned Executive KPI Cards */}
      <div className="chit-dash-kpis">
        <Link href="/chits" className="chit-dash-kpi chit-dash-kpi--primary">
          <div className="chit-dash-kpi-icon">
            <span className="material-icons-outlined">layers</span>
          </div>
          <div>
            <div className="chit-dash-kpi-val">{kpis.activeChitGroups}</div>
            <div className="chit-dash-kpi-lbl">{c.activeGroups}</div>
          </div>
        </Link>

        <Link href="/chits" className="chit-dash-kpi chit-dash-kpi--info">
          <div className="chit-dash-kpi-icon">
            <span className="material-icons-outlined">groups</span>
          </div>
          <div>
            <div className="chit-dash-kpi-val">{kpis.totalMembers}</div>
            <div className="chit-dash-kpi-lbl">{c.totalMembers}</div>
          </div>
        </Link>

        <Link
          href={heroAuction ? `/chits/${heroAuction.chitGroupId}/auctions/${heroAuction.auctionId}` : '/chits'}
          className="chit-dash-kpi chit-dash-kpi--success"
        >
          <div className="chit-dash-kpi-icon">
            <span className="material-icons-outlined">gavel</span>
          </div>
          <div>
            <div className="chit-dash-kpi-val">{kpis.liveAuctionsCount}</div>
            <div className="chit-dash-kpi-lbl">{c.dashAuctionLive}</div>
          </div>
        </Link>

        <Link href="/chits" className="chit-dash-kpi chit-dash-kpi--warning">
          <div className="chit-dash-kpi-icon">
            <span className="material-icons-outlined">event_upcoming</span>
          </div>
          <div>
            <div className="chit-dash-kpi-val">{kpis.upcomingAuctionsCount}</div>
            <div className="chit-dash-kpi-lbl">{c.dashUpcomingAuctions}</div>
          </div>
        </Link>

        <Link href="/approvals" className="chit-dash-kpi chit-dash-kpi--danger">
          <div className="chit-dash-kpi-icon">
            <span className="material-icons-outlined">warning_amber</span>
          </div>
          <div>
            <div className="chit-dash-kpi-val">{kpis.pendingApprovals}</div>
            <div className="chit-dash-kpi-lbl">{d.pendingApprovals}</div>
          </div>
        </Link>
      </div>

      {/* Row 2: Live/Featured Auction Hero Banner + Group Overview Table */}
      <div className="chit-dash-row2">
        <div className="chit-dash-hero">
          {heroAuction ? (
            <>
              <div className="chit-dash-hero-top">
                <span className="chit-dash-live-pill">
                  <span className={`chit-dash-live-dot${heroAuction.isLive ? ' chit-dash-live-dot--hot' : ''}`} />
                  {heroAuction.isLive ? c.dashLiveAuction : heroAuction.isPaused ? 'PAUSED' : c.dashFeaturedAuction}
                </span>
                <Link
                  href={`/chits/${heroAuction.chitGroupId}/auctions/${heroAuction.auctionId}`}
                  className="chit-dash-hero-action"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '15px' }}>open_in_new</span>
                  {c.dashOpenLiveRoom}
                </Link>
              </div>

              <div className="chit-dash-hero-body">
                <div style={{ minWidth: 0 }}>
                  <h2 className="chit-dash-hero-title">{heroAuction.groupName}</h2>
                  <div className="chit-dash-hero-meta">
                    <span className="chit-dash-hero-meta-item">
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>account_balance_wallet</span>
                      {formatCurrency(heroAuction.chitValue, currencySymbol)}
                    </span>
                    <span className="chit-dash-hero-meta-item">
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>schedule</span>
                      {c.periodLabel} {heroAuction.periodNumber} {c.dashOfWord} {heroAuction.totalMembers}
                    </span>
                    <span className="chit-dash-hero-meta-item">
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>group</span>
                      {heroAuction.enrolledMembers} {c.members}
                    </span>
                  </div>
                </div>
                <div className="chit-dash-hero-emblem" aria-hidden="true">
                  <span className="material-icons-outlined" style={{ fontSize: '34px' }}>gavel</span>
                </div>
              </div>

              <div className="chit-dash-hero-stats">
                <div className="chit-dash-hero-stat-box">
                  <div className="chit-dash-hero-stat-lbl">{c.dashHighestBid}</div>
                  <div className="chit-dash-hero-stat-val">
                    {formatCurrency(heroAuction.currentHighestPrize, currencySymbol)}
                  </div>
                </div>

                <div className="chit-dash-hero-stat-box">
                  <div className="chit-dash-hero-stat-lbl">{c.bidDiscount}</div>
                  <div className="chit-dash-hero-stat-val">
                    {formatCurrency(heroAuction.bidDiscount, currencySymbol)}{' '}
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, opacity: 0.85 }}>
                      ({heroAuction.discountPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                <div className="chit-dash-hero-stat-box chit-dash-hero-stat-box--leader">
                  <span className="material-icons-outlined" style={{ fontSize: '26px', color: '#fbbf24' }}>emoji_events</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="chit-dash-hero-stat-lbl">{c.dashLeadingMember}</div>
                    <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {heroAuction.leadingMemberName
                        ? `${heroAuction.leadingMemberName}${heroAuction.leadingTicketNo ? ` (#${heroAuction.leadingTicketNo})` : ''}`
                        : c.pending}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: '24px 10px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <span className="material-icons-outlined" style={{ fontSize: '42px', opacity: 0.85 }}>gavel</span>
              <h3 style={{ margin: '10px 0 6px', fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>{c.dashLiveAuction}</h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: 'rgba(255,255,255,0.86)' }}>{c.dashNoLiveAuction}</p>
              <Link href="/chits" className="chit-dash-hero-action">
                {c.title} →
              </Link>
            </div>
          )}
        </div>

        {/* Right: Group Overview Table */}
        <div className="chit-dash-card">
          <div className="chit-dash-card-hdr">
            <h3 className="chit-dash-card-title">
              <span className="chit-dash-card-icon">
                <span className="material-icons-outlined" style={{ fontSize: '17px' }}>view_list</span>
              </span>
              {c.dashGroupOverview}
            </h3>
            <Link href="/chits" className="chit-dash-view-all">
              {d.viewAll} →
            </Link>
          </div>
          <div className="table-wrapper" style={{ flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>{c.dashGroupNameCol}</th>
                  <th style={{ textAlign: 'center' }}>{c.members}</th>
                  <th style={{ textAlign: 'right' }}>{c.chitValue}</th>
                  <th style={{ textAlign: 'center' }}>{c.periodLabel}</th>
                  <th style={{ textAlign: 'right' }}>{c.status}</th>
                </tr>
              </thead>
              <tbody>
                {groupOverview.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <Link href={`/chits/${group.groupCode || group.id}`} style={{ fontWeight: 700, color: 'var(--text)' }}>
                        {group.name}
                      </Link>
                    </td>
                    <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                      {group.enrolledMembers} / {group.totalMembers}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(group.chitValue, currencySymbol)}
                    </td>
                    <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                      {group.currentPeriod} / {group.totalMembers}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="badge badge-success">● {c.active}</span>
                    </td>
                  </tr>
                ))}
                {groupOverview.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      {c.noChits}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Settlement Summary | Collection Performance | Payout & Cash Disbursement */}
      <div className="chit-dash-row3">
        {/* Col 1: Settlement Summary */}
        <div className="chit-dash-card">
          <div className="chit-dash-card-hdr">
            <h3 className="chit-dash-card-title">
              <span className="chit-dash-card-icon">
                <span className="material-icons-outlined" style={{ fontSize: '17px' }}>receipt_long</span>
              </span>
              {c.dashSettlementSummary}
              {settlementSummary ? ` — ${c.periodLabel} ${settlementSummary.periodNumber}` : ''}
            </h3>
          </div>
          {settlementSummary ? (
            <>
              <div className="chit-dash-kv-list">
                <div className="chit-dash-kv-row">
                  <span className="chit-dash-kv-lbl">{c.dashTotalChitValuePool}</span>
                  <span className="chit-dash-kv-val">{formatCurrency(settlementSummary.chitValue, currencySymbol)}</span>
                </div>
                <div className="chit-dash-kv-row">
                  <span className="chit-dash-kv-lbl">
                    {c.dashWinningBidDiscount} ({settlementSummary.discountPct.toFixed(2)}%)
                  </span>
                  <span className="chit-dash-kv-val">{formatCurrency(settlementSummary.bidDiscount, currencySymbol)}</span>
                </div>
                <div className="chit-dash-kv-row">
                  <span className="chit-dash-kv-lbl">
                    {c.commissionLabel} ({settlementSummary.commissionPct}%)
                  </span>
                  <span className="chit-dash-kv-val">{formatCurrency(settlementSummary.commission, currencySymbol)}</span>
                </div>
                <div className="chit-dash-kv-row">
                  <span className="chit-dash-kv-lbl">
                    {c.dividendPerTicket} ({settlementSummary.eligibleTickets})
                  </span>
                  <span className="chit-dash-kv-val" style={{ color: 'var(--primary-dark)' }}>
                    {formatCurrency(settlementSummary.dividendPerTicket, currencySymbol)}
                  </span>
                </div>
                <div className="chit-dash-kv-row">
                  <span className="chit-dash-kv-lbl">{c.dashNetInstallmentMember}</span>
                  <span className="chit-dash-kv-val">
                    {formatCurrency(settlementSummary.netInstallmentPerMember, currencySymbol)}
                  </span>
                </div>
              </div>
              <div className="chit-dash-net-banner">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: '0.86rem', color: 'var(--primary-dark)' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>payments</span>
                  {c.dashNetPayableWinner}
                </span>
                <span style={{ fontWeight: 800, fontSize: '1.08rem', color: 'var(--primary-dark)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(settlementSummary.netPayableToWinner, currencySymbol)}
                </span>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {c.noAuctions}
            </div>
          )}
        </div>

        {/* Col 2: Collection Performance */}
        <div className="chit-dash-card">
          <div className="chit-dash-card-hdr">
            <h3 className="chit-dash-card-title">
              <span className="chit-dash-card-icon">
                <span className="material-icons-outlined" style={{ fontSize: '17px' }}>bar_chart</span>
              </span>
              {c.dashCollectionPerformance}
            </h3>
            {collectionPerformance.groupName && (
              <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {collectionPerformance.groupName}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--success)' }}>
                {formatCurrency(collectionPerformance.collectedTotal, currencySymbol)}
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {' '}/ {formatCurrency(collectionPerformance.expectedTotal, currencySymbol)}
              </span>
            </div>
            <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
              ({collectionPerformance.collectionPct.toFixed(2)}%)
            </span>
          </div>

          <div className="chit-dash-progress-track">
            <div className="chit-dash-progress-fill" style={{ width: `${collectionPerformance.collectionPct}%` }} />
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {coords.length > 0 ? (
              <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="chitDashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                  const yPos = padT + plotH - t * plotH;
                  return (
                    <g key={t}>
                      <line
                        x1={padL}
                        y1={yPos}
                        x2={svgW - padR}
                        y2={yPos}
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        strokeWidth="0.8"
                      />
                      <text
                        x={padL - 6}
                        y={yPos + 3}
                        textAnchor="end"
                        fontSize="8.5"
                        fill="var(--text-secondary)"
                      >
                        {formatCompactMoney(maxY * t, currencySymbol)}
                      </text>
                    </g>
                  );
                })}
                {areaPath && <path d={areaPath} fill="url(#chitDashAreaGrad)" />}
                {polylinePoints && (
                  <polyline
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={polylinePoints}
                  />
                )}
                {coords.map((pt) => (
                  <g key={pt.periodNumber}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={highlightCoord?.periodNumber === pt.periodNumber ? 4.8 : 3.2}
                      fill="#ffffff"
                      stroke="var(--primary-dark)"
                      strokeWidth="2.2"
                    />
                    <text
                      x={pt.x}
                      y={svgH - 5}
                      textAnchor="middle"
                      fontSize="8.8"
                      fontWeight="600"
                      fill="var(--text-secondary)"
                    >
                      {pt.label}
                    </text>
                  </g>
                ))}
                {highlightCoord && (
                  <g transform={`translate(${Math.min(svgW - 72, Math.max(padL, highlightCoord.x - 30))}, ${Math.max(0, highlightCoord.y - 22)})`}>
                    <rect width="66" height="16" rx="5" fill="var(--primary-dark)" />
                    <text x="33" y="11" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#ffffff">
                      {formatCompactMoney(highlightCoord.collected, currencySymbol)}
                    </text>
                  </g>
                )}
              </svg>
            ) : (
              <div style={{ width: '100%', textAlign: 'center', padding: '26px 8px', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                {c.noAuctions}
              </div>
            )}
          </div>
        </div>

        {/* Col 3: Payout & Cash Disbursement + Cash Denomination Payout */}
        <div className="chit-dash-card">
          <div className="chit-dash-card-hdr">
            <h3 className="chit-dash-card-title">
              <span className="chit-dash-card-icon">
                <span className="material-icons-outlined" style={{ fontSize: '17px' }}>account_balance_wallet</span>
              </span>
              {c.dashPayoutDisbursement}
            </h3>
          </div>

          <div className="chit-dash-kv-list">
            <div className="chit-dash-kv-row">
              <span className="chit-dash-kv-lbl">{c.dashTotalDisbursedWinner}</span>
              <span className="chit-dash-kv-val">{formatCurrency(payoutSummary.disbursedAmount, currencySymbol)}</span>
            </div>
            <div className="chit-dash-kv-row">
              <span className="chit-dash-kv-lbl">{c.dashArrearsOffsetLabel}</span>
              <span className="chit-dash-kv-val" style={{ color: 'var(--danger)' }}>
                -{formatCurrency(payoutSummary.arrearsAndPenaltyOffset, currencySymbol)}
              </span>
            </div>
          </div>

          <div className="chit-dash-net-banner" style={{ marginTop: '8px', marginBottom: '12px', padding: '8px 12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
              {c.dashNetTargetArrears}
            </span>
            <span style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--primary-dark)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(payoutSummary.netTargetAfterArrears, currencySymbol)}
            </span>
          </div>

          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--primary-dark)' }}>local_atm</span>
            {c.dashCashDenomPayout}
          </div>

          {payoutSummary.denominations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
              {payoutSummary.denominations.slice(0, 4).map((row) => (
                <div key={row.denomination} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {currencySymbol} {row.denomination} × {row.count}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(row.amount, currencySymbol)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              {c.dashNoCashNotes}
            </div>
          )}

          <div className="chit-dash-net-banner chit-dash-net-banner--solid" style={{ marginTop: 'auto' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{c.dashTotalCashPayout}</span>
            <span style={{ fontSize: '0.98rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(payoutSummary.totalCashPayout, currencySymbol)}
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Upcoming Auctions | Payout Progress Donut | Recent Activity */}
      <div className="chit-dash-row4">
        {/* Col 1: Upcoming Auctions */}
        <div className="chit-dash-card">
          <div className="chit-dash-card-hdr">
            <h3 className="chit-dash-card-title">
              <span className="chit-dash-card-icon">
                <span className="material-icons-outlined" style={{ fontSize: '17px' }}>event</span>
              </span>
              {c.dashUpcomingAuctions}
            </h3>
            <Link href="/chits" className="chit-dash-view-all">
              {d.viewAll} →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {upcomingAuctions.map((item) => (
              <Link key={item.id} href={`/chits/${item.chitGroupId}/auctions/${item.id}`} className="chit-dash-upcoming-item">
                <div className="chit-dash-cal-badge">
                  <span className="chit-dash-cal-month">{item.monthShort}</span>
                  <span className="chit-dash-cal-day">{item.dayOfMonth}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.groupName}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {c.periodLabel} {item.periodNumber} {c.dashOfWord} {item.totalMembers} · {formatCurrency(item.chitValue, currencySymbol)}
                  </div>
                </div>
                <span className={`chit-dash-day-chip${item.daysUntil === 0 ? ' chit-dash-day-chip--today' : ''}`}>
                  {item.daysUntil === 0
                    ? c.dashToday
                    : item.daysUntil === 1
                      ? c.dashTomorrow
                      : `${item.daysUntil} ${c.dashDaysSuffix}`}
                </span>
              </Link>
            ))}
            {upcomingAuctions.length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                {c.dashNoUpcomingAuctions}
              </div>
            )}
          </div>
        </div>

        {/* Col 2: Payout Progress – This Period Donut */}
        <div className="chit-dash-card">
          <div className="chit-dash-card-hdr">
            <h3 className="chit-dash-card-title">
              <span className="chit-dash-card-icon">
                <span className="material-icons-outlined" style={{ fontSize: '17px' }}>pie_chart</span>
              </span>
              {c.dashPayoutProgressPeriod}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '98px', height: '98px', flexShrink: 0, margin: '0 auto' }}>
              <svg viewBox="0 0 100 100" style={{ width: '98px', height: '98px', transform: 'rotate(-90deg)' }}>
                <circle
                  cx="50"
                  cy="50"
                  r={donutRadius}
                  fill="none"
                  stroke="var(--primary-tint)"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={donutRadius}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={donutCircumference}
                  strokeDashoffset={donutOffset}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: 'var(--text)',
                }}
              >
                {payoutSummary.payoutProgressPct}%
              </div>
            </div>

            <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
                  {c.dashDisbursed}
                </span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(payoutSummary.disbursedAmount, currencySymbol)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }} />
                  {c.dashArrearsOffsetShort}
                </span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(payoutSummary.arrearsAndPenaltyOffset, currencySymbol)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)' }} />
                  {c.dashBalancePending}
                </span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(payoutSummary.balancePending, currencySymbol)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Col 3: Recent Activity */}
        <div className="chit-dash-card">
          <div className="chit-dash-card-hdr">
            <h3 className="chit-dash-card-title">
              <span className="chit-dash-card-icon">
                <span className="material-icons-outlined" style={{ fontSize: '17px' }}>timeline</span>
              </span>
              {d.recentActivity}
            </h3>
            <Link href="/chits" className="chit-dash-view-all">
              {d.viewAll} →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', flex: 1 }}>
            {recentActivity.slice(0, 5).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  paddingBottom: '7px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <strong>{item.actorName}</strong> — {humanizeActivityAction(item.action, item.entityType)}
                  </span>
                </div>
                <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {formatRelativeMinutes(item.minutesAgo)}
                </span>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                {d.noActivityToday}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
