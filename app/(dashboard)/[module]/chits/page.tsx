import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId, getSetting } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from '@/components/layout/DashboardLink';
import { getCurrentLanguage, getDictionary } from '@/lib/i18n';
import { branchScopeWhere, getActiveBranchId } from '@/lib/branch';
import { canAdminChits, canViewChits } from '@/lib/chits/access';
import { getChitTypeSettings } from '@/lib/chits/settings';
import { modulePath } from '@/types/modules';
import {
  ChitEmptyClipboardIllustration,
  ChitHeroBarsBg,
  ChitKpiSparkline,
  ChitPotHeroIllustration,
} from '@/components/chits/ChitHubIllustrations';
import ChitGroupWizardModal, {
  ChitWizardOpenButton,
  ChitWizardResumeBanner,
} from '@/components/chits/ChitGroupWizardModal';
import RunningChitMigrationModal, {
  RunningChitMigrationButton,
} from '@/components/chits/RunningChitMigrationModal';
import ChitGroupManageMenu from '@/components/chits/ChitGroupManageMenu';
import './chits-hub.css';

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
  const lang = await getCurrentLanguage(tenantId);
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
  let customers: { id: string; name: string; customerCode: string }[] = [];
  let chitTypeSettings: Awaited<ReturnType<typeof getChitTypeSettings>> | null = null;
  let staffUsers: any[] = [];
  let dbError: string | null = null;

  try {
    const [
      fetchedGroups,
      fetchedActive,
      fetchedCompleted,
      fetchedDraft,
      fetchedCustomers,
      fetchedTypeSettings,
      fetchedStaffUsers,
    ] = await Promise.all([
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
      canManageChits
        ? prisma.customer.findMany({
            where: { tenantId, appType, status: 'active', deletedAt: null, ...branchScopeWhere(branchId) },
            select: { id: true, name: true, customerCode: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
      canManageChits ? getChitTypeSettings(tenantId) : Promise.resolve(null),
      canManageChits
        ? prisma.user.findMany({
            where: {
              tenantId,
              status: 'active',
              deletedAt: null,
              OR: [
                { role: { in: ['admin', 'superadmin'] } },
                { role: 'agent', appType, ...branchScopeWhere(branchId) },
              ],
            },
            select: {
              id: true,
              name: true,
              phone: true,
              role: true,
              customRoleName: true,
              customRole: { select: { name: true } },
            },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
    ]);
    groups = fetchedGroups;
    activeCount = fetchedActive;
    completedCount = fetchedCompleted;
    draftCount = fetchedDraft;
    customers = fetchedCustomers;
    chitTypeSettings = fetchedTypeSettings;
    staffUsers = fetchedStaffUsers;
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
  const wizardStorageKey = `zolofund:chit-wizard-draft:${tenantId}:${branchId || 'all'}`;

  return (
    <div className="chits-hub">
      {/* 1. Rich Theme-Harmonized Hero Header Banner */}
      <section className="chits-hero">
        <ChitHeroBarsBg />

        <div className="chits-hero-left">
          <ChitPotHeroIllustration />
          <div style={{ minWidth: 0 }}>
            <h2 className="chits-hero-title">{dict.chits.chitFundGroups}</h2>
            <p className="chits-hero-subtitle">{dict.chits.heroSubtitle}</p>
            <div className="chits-hero-pills">
              <span className="chits-hero-pill">
                <span className="material-icons-outlined" style={{ fontSize: '15px' }}>account_balance_wallet</span>
                {dict.chits.poolBook}: {formatCurrency(totalPoolVolume, currencySymbol)}
              </span>
              <span className="chits-hero-pill">
                <span className="chits-hero-dot chits-hero-dot--active" />
                {activeCount} {dict.chits.active}
              </span>
              <span className="chits-hero-pill">
                <span className="chits-hero-dot chits-hero-dot--draft" />
                {draftCount} {dict.chits.statusDraft}
              </span>
            </div>
          </div>
        </div>

        <div className="chits-hero-actions">
          {canVerifyProofs && (
            <Link href="/chits/payments" className="chits-hero-btn-glass">
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>receipt_long</span>
              {dict.chits.paymentProofs}
            </Link>
          )}
          {canImportChits && (
            <Link href="/chits/import" className="chits-hero-btn-glass">
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>chat</span>
              {dict.chits.importWhatsapp}
            </Link>
          )}
          <a
            href="/api/public/templates/chit-fund-tracker.xlsx"
            className="chits-hero-btn-glass"
            title="Download free 5-tab formula-driven Excel Chit Fund Tracker"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>table_view</span>
            Free Excel Tracker
          </a>
          {canManageChits && (
            <RunningChitMigrationButton
              label="Import Running Chit (Mid-Cycle)"
              className="chits-hero-btn-glass"
            />
          )}
          {canManageChits && (
            <ChitWizardOpenButton
              label={dict.chits.newChitGroup}
              className="chits-hero-btn-primary"
              mode="auto"
            />
          )}
        </div>
      </section>

      {canManageChits && (
        <ChitWizardResumeBanner storageKey={wizardStorageKey} dict={dict} />
      )}

      {/* 2. Elevated 4-Card KPI Strip with Mini Area Sparklines */}
      <section className="chits-kpi-grid">
        <div className="chits-kpi-card">
          <div className="chits-kpi-icon chits-kpi-icon--primary">
            <span className="material-icons-outlined">layers</span>
          </div>
          <div className="chits-kpi-meta">
            <div className="chits-kpi-value">{activeCount}</div>
            <div className="chits-kpi-label">{dict.chits.activeGroups}</div>
          </div>
          <ChitKpiSparkline color="#16A34A" variant={0} />
        </div>

        <div className="chits-kpi-card">
          <div className="chits-kpi-icon chits-kpi-icon--violet">
            <span className="material-icons-outlined">account_balance_wallet</span>
          </div>
          <div className="chits-kpi-meta">
            <div className="chits-kpi-value">{formatCurrency(totalPoolVolume, currencySymbol)}</div>
            <div className="chits-kpi-label">{dict.chits.totalPoolValue}</div>
          </div>
          <ChitKpiSparkline color="#8B5CF6" variant={1} />
        </div>

        <div className="chits-kpi-card">
          <div className="chits-kpi-icon chits-kpi-icon--sky">
            <span className="material-icons-outlined">groups</span>
          </div>
          <div className="chits-kpi-meta">
            <div className="chits-kpi-value">{totalMembersEnrolled}</div>
            <div className="chits-kpi-label">{dict.chits.totalMembers}</div>
          </div>
          <ChitKpiSparkline color="#0EA5E9" variant={2} />
        </div>

        <div className="chits-kpi-card">
          <div className="chits-kpi-icon chits-kpi-icon--amber">
            <span className="material-icons-outlined">check_circle</span>
          </div>
          <div className="chits-kpi-meta">
            <div className="chits-kpi-value">{completedCount}</div>
            <div className="chits-kpi-label">{dict.chits.completedGroups}</div>
          </div>
          <ChitKpiSparkline color="#F59E0B" variant={3} />
        </div>
      </section>

      {/* 3. Unified Filter Toolbar + Chit Directory */}
      <section className="chits-directory-shell">
        <div className="chits-toolbar">
          <form method="GET" className="chits-filter-form">
            <div className="chits-search-wrap">
              <span className="material-icons-outlined chits-search-icon">search</span>
              <input
                name="q"
                type="text"
                className="chits-search-input"
                placeholder={dict.chits.searchPlaceholder}
                defaultValue={q}
              />
            </div>
            <select
              name="status"
              className="form-control chits-status-select"
              defaultValue={status}
            >
              <option value="">{dict.chits.allStatus}</option>
              <option value="active">{dict.chits.active}</option>
              <option value="draft">{dict.chits.statusDraft}</option>
              <option value="completed">{dict.chits.completed}</option>
              <option value="cancelled">{dict.chits.cancelled}</option>
            </select>
            <button type="submit" className="chits-filter-btn">
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>filter_list</span>
              {dict.chits.filter}
            </button>
          </form>

          <div className="chits-pill-group">
            {[
              { val: '', label: dict.chits.statusAll },
              { val: 'active', label: `${dict.chits.active} (${activeCount})` },
              { val: 'draft', label: `${dict.chits.statusDraft} (${draftCount})` },
              { val: 'completed', label: `${dict.chits.statusDone} (${completedCount})` },
            ].map((chip) => {
              const active = status === chip.val;
              return (
                <Link
                  key={chip.val || 'all'}
                  href={chip.val ? `/chits?status=${chip.val}` : '/chits'}
                  className={`chits-status-pill${active ? ' chits-status-pill--active' : ''}`}
                >
                  {chip.label}
                </Link>
              );
            })}
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="chits-empty-well">
            <ChitEmptyClipboardIllustration />
            <h3 className="chits-empty-title">{dict.chits.noChits}</h3>
            <p className="chits-empty-subtitle">{dict.chits.emptySubtitle}</p>
            {canManageChits && (
              <ChitWizardOpenButton
                label={dict.chits.createFirst}
                className="chits-cta-glow"
                mode="auto"
              />
            )}
          </div>
        ) : (
          <div className="chits-cards-grid">
            {groups.map((g) => {
              const completedAuctions = g.auctions.filter((a: any) => ['confirmed', 'paid', 'completed'].includes(a.status));
              const nextAuction =
                g.auctions.find((a: any) => ['open', 'extended', 'LIVE'].includes(a.roomStatus ?? '')) ??
                g.auctions.find((a: any) => ['pending', 'notice_sent', 'in_progress'].includes(a.status));
              const memberPct = g.totalMembers > 0 ? Math.min(100, Math.round((g._count.members / g.totalMembers) * 100)) : 0;
              const cyclePct = g.durationMonths > 0 ? Math.min(100, Math.round((completedAuctions.length / g.durationMonths) * 100)) : 0;
              const isLiveRoom = ['open', 'extended', 'LIVE'].includes(nextAuction?.roomStatus ?? '');

              return (
                <div key={g.id} className="chits-group-card">
                  {/* Tinted Card Header Strip */}
                  <div className="chits-group-card-head">
                    <div style={{ minWidth: 0 }}>
                      <h4 className="chits-group-title">{g.name}</h4>
                      <div className="chits-group-meta">
                        <code className="chits-group-code">{g.groupCode ?? g.id}</code>
                        <span>·</span>
                        <span>{g.chitEngineType || 'AUCTION_STANDARD'}</span>
                        <span>·</span>
                        <span>{g.chitType === 'registered' ? dict.chits.act1982 : dict.chits.privateChit}</span>
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
                  <div className="chits-group-body">
                    <div className="chits-metrics-2x2">
                      <div className="chits-metric-well">
                        <div className="chits-metric-label">{dict.chits.chitValue}</div>
                        <div className="chits-metric-val">
                          {formatCurrency(Number(g.chitValue), currencySymbol)}
                        </div>
                      </div>
                      <div className="chits-metric-well">
                        <div className="chits-metric-label">{dict.chits.monthly}</div>
                        <div className="chits-metric-val chits-metric-val--primary">
                          {formatCurrency(Number(g.monthlyContrib), currencySymbol)}
                        </div>
                      </div>
                      <div className="chits-metric-well">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <span>{dict.chits.members}</span>
                          <strong style={{ color: 'var(--text)' }}>{g._count.members}/{g.totalMembers}</strong>
                        </div>
                        <div className="chits-bar-track">
                          <div className="chits-bar-fill--primary" style={{ width: `${memberPct}%` }} />
                        </div>
                      </div>
                      <div className="chits-metric-well">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <span>{dict.chits.auctionsDone}</span>
                          <strong style={{ color: 'var(--text)' }}>{completedAuctions.length}/{g.durationMonths}</strong>
                        </div>
                        <div className="chits-bar-track">
                          <div className="chits-bar-fill--success" style={{ width: `${cyclePct}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Next Cycle Callout */}
                    <div className={`chits-cycle-callout${isLiveRoom ? ' chits-cycle-callout--live' : ''}`}>
                      {nextAuction ? (
                        <>
                          <strong style={{ color: isLiveRoom ? 'var(--warning)' : 'var(--text)' }}>
                            {isLiveRoom ? `🔴 ${dict.chits.liveAuctionNow}` : dict.chits.nextCycle}
                          </strong>{' '}
                          {dict.chits.periodLabel} {nextAuction.periodNumber} · {formatDate(nextAuction.scheduledAt ?? nextAuction.auctionDate)}
                          {nextAuction.scheduledAt
                            ? ` ${new Date(nextAuction.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : ''}
                        </>
                      ) : (
                        <>
                          <strong>{dict.chits.startedLabel}</strong> {formatDate(g.startDate)}
                        </>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="chits-card-footer">
                      <Link
                        href={`/chits/${g.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, justifyContent: 'center', padding: '6px 10px', fontSize: '.78rem' }}
                      >
                        {dict.chits.view}
                      </Link>
                      <Link
                        href={nextAuction ? `/chits/${g.id}/auctions/${nextAuction.id}` : `/chits/${g.id}/room`}
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1.25, justifyContent: 'center', padding: '6px 10px', fontSize: '.78rem' }}
                      >
                        {isLiveRoom || g.auctionType === 'open_live' ? dict.chits.liveRoomAction : dict.chits.groupRoomAction}
                      </Link>
                      {canManageChits && (
                        <ChitGroupManageMenu
                          groupId={g.id}
                          groupName={g.name}
                          status={g.status}
                          enrolledMembers={g._count.members}
                          editHref={`/chits/${g.id}/edit`}
                          labels={{
                            editGroup: dict.chits.editGroup,
                            cancelGroup: dict.chits.cancelGroupMenuBtn,
                            deleteGroup: dict.chits.deleteGroupMenuBtn,
                            closeBtn: dict.chits.cancel,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {canManageChits && (
        <ChitGroupWizardModal
          storageKey={wizardStorageKey}
          customers={customers}
          staffUsers={staffUsers}
          currentUserId={session.user?.id}
          currencySymbol={currencySymbol}
          dict={dict}
          lang={lang}
          enabledChitTypes={chitTypeSettings?.enabledTypes}
          typeDefaults={chitTypeSettings?.typeDefaults}
        />
      )}
      {canManageChits && (
        <RunningChitMigrationModal currencySymbol={currencySymbol} />
      )}
    </div>
  );
}
