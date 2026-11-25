'use client';

import Link from '@/components/layout/DashboardLink';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ForemanPortalClientProps {
  user: {
    id: string;
    name: string;
    role: string;
    roleLabel: string;
  };
  groups: any[];
  currencySymbol: string;
  pendingIntentsCount: number;
  grantedCapabilities: string[];
  canManageChits: boolean;
  canConductAuction: boolean;
  showingAllBranch: boolean;
  canViewAllBranch: boolean;
  dict: any;
}

export default function ForemanPortalClient({
  user,
  groups,
  currencySymbol,
  pendingIntentsCount,
  grantedCapabilities,
  canManageChits,
  canConductAuction,
  showingAllBranch,
  canViewAllBranch,
}: ForemanPortalClientProps) {
  const activeGroups = groups.filter((g) => g.status === 'active').length;
  const openRooms = groups.filter((g) =>
    g.auctions?.some((a: any) => ['open', 'extended'].includes(a.roomStatus)),
  ).length;
  const totalSeatsEnrolled = groups.reduce((sum, g) => sum + (g._count?.members ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header card */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>🏛️ Foreman &amp; Staff Portal</h2>
              <span className="badge badge-info" style={{ fontSize: '.74rem' }}>{user.roleLabel}</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '.8rem', color: 'var(--text-secondary)' }}>
              Signed in as <strong>{user.name}</strong> · Active Role Capabilities:{' '}
              {grantedCapabilities.length > 0 ? grantedCapabilities.join(' · ') : 'Assigned Groups View'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {canViewAllBranch && user.role === 'agent' && (
              <Link
                href={showingAllBranch ? '/foreman' : '/foreman?scope=all'}
                className="btn btn-secondary btn-sm"
              >
                {showingAllBranch ? 'Show My Assigned Groups' : 'Show All Branch Groups'}
              </Link>
            )}
            <Link href="/chits/payments" className="btn btn-secondary btn-sm">
              Payment Proofs ({pendingIntentsCount})
            </Link>
            {canManageChits && (
              <Link href="/chits/new" className="btn btn-primary btn-sm">
                <span className="material-icons-outlined" style={{ fontSize: '15px' }}>add</span> New Chit Group
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue"><span className="material-icons-outlined">savings</span></div>
          <div><div className="kpi-value">{groups.length}</div><div className="kpi-label">{showingAllBranch || user.role !== 'agent' ? 'Branch Groups' : 'Assigned Groups'} ({activeGroups} Active)</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green"><span className="material-icons-outlined">gavel</span></div>
          <div><div className="kpi-value">{openRooms}</div><div className="kpi-label">Live Rooms Open</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><span className="material-icons-outlined">groups</span></div>
          <div><div className="kpi-value">{totalSeatsEnrolled}</div><div className="kpi-label">Member Tickets</div></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple"><span className="material-icons-outlined">receipt_long</span></div>
          <div><div className="kpi-value">{pendingIntentsCount}</div><div className="kpi-label">Pending Payment Proofs</div></div>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div className="card-header" style={{ marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '.98rem' }}>Assigned Chit Groups</h3>
          <Link href="/chits" className="btn btn-ghost btn-sm">View Full List →</Link>
        </div>

        {groups.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '42px', color: 'var(--text-light)' }}>badge</span>
            <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>No chit groups assigned to your foreman account yet.</p>
            <p style={{ margin: 0, fontSize: '.8rem', color: 'var(--text-secondary)' }}>
              Ask your Branch Admin or Superadmin to assign you as a Foreman / Co-Foreman on a chit group.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {groups.map((g: any) => {
              const myAssignment = g.foremen?.find((f: any) => f.userId === user.id);
              const nextAuction = g.auctions?.find((a: any) => ['pending', 'notice_sent', 'in_progress'].includes(a.status));
              const isRoomOpen = nextAuction && ['open', 'extended'].includes(nextAuction.roomStatus);
              return (
                <div
                  key={g.id}
                  className="card"
                  style={{
                    padding: '12px',
                    boxShadow: 'none',
                    border: isRoomOpen ? '1.5px solid var(--success)' : '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                      <div>
                        <strong style={{ fontSize: '.92rem' }}>{g.name}</strong>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>
                          {g.groupCode} · {g.chitEngineType}
                        </div>
                      </div>
                      <span className={`badge badge-${g.status === 'active' ? 'success' : 'secondary'}`} style={{ fontSize: '.68rem' }}>
                        {g.status}
                      </span>
                    </div>

                    {myAssignment && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <span className="badge badge-info" style={{ fontSize: '.68rem' }}>
                          My Role: {myAssignment.roleLabel}{myAssignment.isPrimary ? ' ★' : ''}
                        </span>
                        {g.foremen?.length > 1 && (
                          <span className="badge badge-secondary" style={{ fontSize: '.68rem' }}>
                            {g.foremen.length} Foremen
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px', padding: '7px 9px', borderRadius: '6px', background: 'var(--bg-hover, #f8fafc)', fontSize: '.76rem' }}>
                      <div><span style={{ color: 'var(--text-secondary)' }}>Chit Value:</span> <strong>{formatCurrency(Number(g.chitValue), currencySymbol)}</strong></div>
                      <div><span style={{ color: 'var(--text-secondary)' }}>Tickets:</span> <strong>{g._count?.members ?? 0}/{g.totalMembers}</strong></div>
                      <div style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)' }}>
                        {nextAuction
                          ? <>Next Period #{nextAuction.periodNumber} · {formatDate(nextAuction.scheduledAt ?? nextAuction.auctionDate)}</>
                          : <>Started {formatDate(g.startDate)}</>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <Link href={`/chits/${g.id}`} className="btn btn-ghost btn-sm" style={{ flex: 1, textAlign: 'center', fontSize: '.75rem' }}>
                      Details
                    </Link>
                    <Link href={`/chits/${g.id}/room`} className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center', fontSize: '.75rem' }}>
                      {isRoomOpen ? '🔴 Live Room' : '💬 Room'}
                    </Link>
                    {canConductAuction && nextAuction && (
                      <Link href={`/chits/${g.id}/auctions/${nextAuction.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, textAlign: 'center', fontSize: '.75rem' }}>
                        Auction
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
