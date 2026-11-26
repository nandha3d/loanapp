import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from '@/components/layout/DashboardLink';
import { getDictionary } from '@/lib/i18n';
import { getActiveBranchId } from '@/lib/branch';
import { canAdminChits, canViewChits } from '@/lib/chits/access';
import { modulePath } from '@/types/modules';

export default async function ChitsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const staffPermissions = (session?.user as any)?.staffPermissions ?? null;
  if (!session) redirect('/login');

  const tenantId = await getDefaultTenantId();
  const appType = 'chitfunds';
  if (userRole === 'agent' && !canViewChits(userRole, staffPermissions)) redirect(modulePath(appType, '/collection'));
  const canManageChits = canAdminChits(userRole, staffPermissions);
  const canImportChits = canManageChits || (userRole === 'agent' && Boolean(staffPermissions?.canImportChits));
  const canVerifyProofs = userRole !== 'agent' || Boolean(staffPermissions?.canCollectChits || staffPermissions?.canVerifyPaymentProofs);
  const dict = await getDictionary(tenantId);
  try {
    await requireModule(tenantId, 'chitfunds');
  } catch {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--border)' }}>lock</span>
        <h3 style={{ margin: '16px 0 8px' }}>Module Not Enabled</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          The Chit Funds module is not included in your current subscription plan.
        </p>
        <Link href="/subscription" className="btn btn-primary">View Subscription</Link>
      </div>
    );
  }
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const resolvedParams = await searchParams;
  const status = resolvedParams.status || '';
  const q = resolvedParams.q || '';

  const branchId = await getActiveBranchId();
  const where: any = { tenantId, appType, deletedAt: null };
  if (branchId) where.branchId = branchId;
  if (status) where.status = status;
  if (q) where.name = { contains: q };

  let groups: any[] = [];
  let activeCount = 0;
  let completedCount = 0;
  let draftCount = 0;
  let dbError: string | null = null;

  try {
    [groups, activeCount, completedCount, draftCount] = await Promise.all([
      prisma.chitGroup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { members: true, auctions: true } },
          auctions: {
            orderBy: { periodNumber: 'asc' },
            select: { id: true, periodNumber: true, status: true, scheduledAt: true, auctionDate: true, roomStatus: true },
          },
        },
      }),
      prisma.chitGroup.count({ where: { tenantId, appType, deletedAt: null, status: 'active', ...(branchId ? { branchId } : {}) } }),
      prisma.chitGroup.count({ where: { tenantId, appType, deletedAt: null, status: 'completed', ...(branchId ? { branchId } : {}) } }),
      prisma.chitGroup.count({ where: { tenantId, appType, deletedAt: null, status: 'draft', ...(branchId ? { branchId } : {}) } }),
    ]);
  } catch (e: any) {
    dbError = e.message || 'Database tables not yet migrated. Run: npx prisma migrate deploy';
  }

  if (dbError) {
    return (
      <div className="card" style={{ padding: '24px', color: '#b91c1c' }}>
        <strong>Database not ready:</strong> {dbError}
      </div>
    );
  }

  const totalMembersEnrolled = groups.reduce((s, g) => s + g._count.members, 0);
  const totalPoolVolume = groups.reduce((s, g) => s + Number(g.chitValue || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Hero Header Banner harmonized with ZoloFund active tenant theme */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 68%, var(--primary-dark) 100%)',
          color: '#FFFFFF',
          borderRadius: '16px',
          padding: '22px 24px',
          boxShadow: '0 10px 28px -8px var(--primary-glow, rgba(15, 23, 42, 0.28))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255,255,255,0.18)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '22px', color: '#FFFFFF' }}>savings</span>
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                {dict.chits.chitFundGroups}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '.82rem', color: 'rgba(255,255,255,0.86)' }}>
                Manage active chit pools, member ticket allotments, live auction rooms, and monthly settlements.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
            <span style={{ padding: '4px 11px', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.16)', fontSize: '.76rem', fontWeight: 700 }}>
              Pool Book: {formatCurrency(totalPoolVolume, currencySymbol)}
            </span>
            <span style={{ padding: '4px 11px', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.16)', fontSize: '.76rem', fontWeight: 600 }}>
              {activeCount} Active
            </span>
            <span style={{ padding: '4px 11px', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.16)', fontSize: '.76rem', fontWeight: 600 }}>
              {draftCount} Draft
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          {canVerifyProofs && (
            <Link
              href="/chits/payments"
              className="btn btn-sm"
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.34)',
                fontWeight: 600,
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>receipt_long</span> Payment proofs
            </Link>
          )}
          {canImportChits && (
            <Link
              href="/chits/import"
              className="btn btn-sm"
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.34)',
                fontWeight: 600,
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>chat</span> Import from WhatsApp
            </Link>
          )}
          {canManageChits && (
            <Link
              href="/chits/new"
              className="btn btn-sm"
              style={{
                backgroundColor: '#FFFFFF',
                color: 'var(--primary-dark)',
                border: 'none',
                fontWeight: 800,
                boxShadow: '0 4px 14px rgba(0,0,0,0.16)',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '17px' }}>add</span> {dict.chits.newChitGroup}
            </Link>
          )}
        </div>
      </div>

      {/* Elevated 4-Card KPI Strip */}
      <div className="kpi-grid" style={{ marginBottom: 0 }}>
        <div className="kpi-card" style={{ border: '1px solid #DCE3EC', boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)' }}>
          <div className="kpi-icon green"><span className="material-icons-outlined">savings</span></div>
          <div>
            <div className="kpi-value">{activeCount}</div>
            <div className="kpi-label">{dict.chits.activeGroups}</div>
          </div>
        </div>
        <div className="kpi-card" style={{ border: '1px solid #DCE3EC', boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)' }}>
          <div className="kpi-icon purple"><span className="material-icons-outlined">account_balance_wallet</span></div>
          <div>
            <div className="kpi-value">{formatCurrency(totalPoolVolume, currencySymbol)}</div>
            <div className="kpi-label">Total Chit Pool Value</div>
          </div>
        </div>
        <div className="kpi-card" style={{ border: '1px solid #DCE3EC', boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)' }}>
          <div className="kpi-icon orange"><span className="material-icons-outlined">groups</span></div>
          <div>
            <div className="kpi-value">{totalMembersEnrolled}</div>
            <div className="kpi-label">{dict.chits.totalMembers}</div>
          </div>
        </div>
        <div className="kpi-card" style={{ border: '1px solid #DCE3EC', boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)' }}>
          <div className="kpi-icon blue"><span className="material-icons-outlined">check_circle</span></div>
          <div>
            <div className="kpi-value">{completedCount}</div>
            <div className="kpi-label">{dict.chits.completedGroups}</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar + High-Contrast Recessed Group Directory Well */}
      <div
        style={{
          backgroundColor: '#E9EEF5',
          border: '1px solid #CBD5E1',
          borderRadius: '16px',
          padding: '18px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #DCE3EC',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          }}
        >
          <form method="GET" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
            <input
              name="q"
              type="text"
              className="form-control"
              placeholder={dict.chits.searchPlaceholder}
              defaultValue={q}
              style={{ maxWidth: '260px', backgroundColor: '#F4F7FA', border: '1.5px solid #CBD5E1', minHeight: '36px', padding: '6px 11px' }}
            />
            <select
              name="status"
              className="form-control"
              style={{ width: 'auto', minWidth: '140px', backgroundColor: '#F4F7FA', border: '1.5px solid #CBD5E1', minHeight: '36px', padding: '6px 32px 6px 10px' }}
              defaultValue={status}
            >
              <option value="">{dict.chits.allStatus}</option>
              <option value="active">{dict.chits.active}</option>
              <option value="draft">Draft</option>
              <option value="completed">{dict.chits.completed}</option>
              <option value="cancelled">{dict.chits.cancelled}</option>
            </select>
            <button type="submit" className="btn btn-primary btn-sm" style={{ minHeight: '36px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>filter_list</span>
              {dict.chits.filter}
            </button>
          </form>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { val: '', label: 'All' },
              { val: 'active', label: `Active (${activeCount})` },
              { val: 'draft', label: `Draft (${draftCount})` },
              { val: 'completed', label: `Done (${completedCount})` },
            ].map((chip) => {
              const active = status === chip.val;
              return (
                <Link
                  key={chip.val || 'all'}
                  href={chip.val ? `/chits?status=${chip.val}` : '/chits'}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '999px',
                    fontSize: '.75rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    backgroundColor: active ? 'var(--primary)' : '#F4F7FA',
                    color: active ? '#FFFFFF' : '#475569',
                    border: active ? '1px solid var(--primary)' : '1px solid #CBD5E1',
                  }}
                >
                  {chip.label}
                </Link>
              );
            })}
          </div>
        </div>

        {groups.length === 0 ? (
          <div
            className="empty-state"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '1px dashed #CBD5E1',
              padding: '44px 20px',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--primary)' }}>savings</span>
            <p style={{ fontWeight: 600, color: '#334155', margin: '10px 0 14px' }}>{dict.chits.noChits}</p>
            {canManageChits && (
              <Link href="/chits/new" className="btn btn-primary btn-sm">{dict.chits.createFirst}</Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(295px, 1fr))', gap: '16px' }}>
            {groups.map((g) => {
              const completedAuctions = g.auctions.filter((a: any) => ['confirmed', 'paid', 'completed'].includes(a.status));
              const nextAuction = g.auctions.find((a: any) => ['pending', 'notice_sent', 'in_progress'].includes(a.status));
              const memberPct = g.totalMembers > 0 ? Math.min(100, Math.round((g._count.members / g.totalMembers) * 100)) : 0;
              const cyclePct = g.durationMonths > 0 ? Math.min(100, Math.round((completedAuctions.length / g.durationMonths) * 100)) : 0;
              const isLiveRoom = nextAuction?.roomStatus === 'LIVE';

              return (
                <div
                  key={g.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '14px',
                    border: '1px solid #CBD5E1',
                    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    height: '100%',
                  }}
                >
                  {/* Tinted Card Header Strip */}
                  <div
                    style={{
                      padding: '13px 15px 11px',
                      background: 'linear-gradient(90deg, var(--primary-light) 0%, #F8FAFC 100%)',
                      borderBottom: '1px solid #E2E8F0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, lineHeight: 1.28, color: '#0F172A' }}>
                        {g.name}
                      </h4>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px', fontSize: '.72rem', color: '#475569' }}>
                        <code style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{g.groupCode ?? g.id}</code>
                        <span>·</span>
                        <span>{g.chitEngineType || 'AUCTION_STANDARD'}</span>
                        <span>·</span>
                        <span>{g.chitType === 'registered' ? 'Act 1982' : 'Private'}</span>
                      </div>
                    </div>
                    <span
                      className={`badge badge-${g.status === 'active' ? 'success' : g.status === 'completed' ? 'info' : 'warning'}`}
                      style={{ fontSize: '0.7rem', padding: '3px 9px', textTransform: 'capitalize', flexShrink: 0 }}
                    >
                      {g.status}
                    </span>
                  </div>

                  {/* Body with 2x2 Contrasted Wells + Progress Bars */}
                  <div style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ backgroundColor: '#F4F7FA', border: '1px solid #E2E8F0', borderRadius: '9px', padding: '8px 10px' }}>
                        <div style={{ fontSize: '.7rem', fontWeight: 600, color: '#64748B' }}>{dict.chits.chitValue}</div>
                        <div style={{ fontSize: '.96rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {formatCurrency(Number(g.chitValue), currencySymbol)}
                        </div>
                      </div>
                      <div style={{ backgroundColor: '#F4F7FA', border: '1px solid #E2E8F0', borderRadius: '9px', padding: '8px 10px' }}>
                        <div style={{ fontSize: '.7rem', fontWeight: 600, color: '#64748B' }}>{dict.chits.monthly}</div>
                        <div style={{ fontSize: '.96rem', fontWeight: 800, color: 'var(--primary-dark)', marginTop: '2px' }}>
                          {formatCurrency(Number(g.monthlyContrib), currencySymbol)}
                        </div>
                      </div>
                      <div style={{ backgroundColor: '#F4F7FA', border: '1px solid #E2E8F0', borderRadius: '9px', padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem', fontWeight: 600, color: '#64748B' }}>
                          <span>{dict.chits.members}</span>
                          <strong style={{ color: '#0F172A' }}>{g._count.members}/{g.totalMembers}</strong>
                        </div>
                        <div style={{ height: '5px', backgroundColor: '#DCE3EC', borderRadius: '999px', marginTop: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${memberPct}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '999px' }} />
                        </div>
                      </div>
                      <div style={{ backgroundColor: '#F4F7FA', border: '1px solid #E2E8F0', borderRadius: '9px', padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem', fontWeight: 600, color: '#64748B' }}>
                          <span>{dict.chits.auctionsDone}</span>
                          <strong style={{ color: '#0F172A' }}>{completedAuctions.length}/{g.durationMonths}</strong>
                        </div>
                        <div style={{ height: '5px', backgroundColor: '#DCE3EC', borderRadius: '999px', marginTop: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${cyclePct}%`, height: '100%', backgroundColor: '#16A34A', borderRadius: '999px' }} />
                        </div>
                      </div>
                    </div>

                    {/* Next Cycle Callout */}
                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: '9px',
                        backgroundColor: isLiveRoom ? '#FEF3C7' : '#F8FAFC',
                        border: isLiveRoom ? '1px solid #FCD34D' : '1px solid #E2E8F0',
                        fontSize: '.76rem',
                        color: '#334155',
                        lineHeight: 1.35,
                      }}
                    >
                      {nextAuction ? (
                        <>
                          <strong style={{ color: isLiveRoom ? '#92400E' : '#0F172A' }}>
                            {isLiveRoom ? '🔴 Live Auction Now:' : 'Next Cycle:'}
                          </strong>{' '}
                          Period {nextAuction.periodNumber} · {formatDate(nextAuction.scheduledAt ?? nextAuction.auctionDate)}
                          {nextAuction.scheduledAt
                            ? ` ${new Date(nextAuction.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : ''}
                        </>
                      ) : (
                        <>
                          <strong>Started:</strong> {formatDate(g.startDate)}
                        </>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: 'flex', gap: '7px', marginTop: 'auto', paddingTop: '4px' }}>
                      <Link
                        href={`/chits/${g.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, justifyContent: 'center', padding: '6px 10px', fontSize: '.78rem', backgroundColor: '#F4F7FA' }}
                      >
                        {dict.chits.view}
                      </Link>
                      <Link
                        href={`/chits/${g.id}/room`}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1.15, justifyContent: 'center', padding: '6px 10px', fontSize: '.78rem', backgroundColor: '#F4F7FA' }}
                      >
                        💬 Chat Room
                      </Link>
                      {nextAuction && (
                        <Link
                          href={`/chits/${g.id}/auctions/${nextAuction.id}`}
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1.15, justifyContent: 'center', padding: '6px 10px', fontSize: '.78rem' }}
                        >
                          {g.auctionType === 'open_live' ? 'Live Bid' : 'Manage'}
                        </Link>
                      )}
                    </div>
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
