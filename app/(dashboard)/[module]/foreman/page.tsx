import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { canAdminChits, canConductChitAuction, canViewChits, scopedChitGroupWhere } from '@/lib/chits/access';
import prisma from '@/lib/db';
import { getDictionary } from '@/lib/i18n';
import { requireModule } from '@/lib/moduleGate';
import { STAFF_PERMISSION_META, type StaffPermissions } from '@/lib/staffPermissions';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { modulePath } from '@/types/modules';
import Link from '@/components/layout/DashboardLink';
import { redirect } from 'next/navigation';
import ForemanPortalClient from './ForemanPortalClient';

export default async function ForemanPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = (session.user as any)?.role as string | undefined;
  const userId = session.user.id as string;
  const staffPermissions = ((session.user as any)?.staffPermissions as StaffPermissions | undefined) ?? null;
  const customRoleName = ((session.user as any)?.customRoleName as string | undefined) ?? null;
  const appType = await getUserAppType();

  if (role === 'agent' && !canViewChits(role, staffPermissions) && !staffPermissions?.canAccessForemanPortal) {
    redirect(modulePath(appType, '/collection'));
  }

  const tenantId = await getDefaultTenantId();
  try {
    await requireModule(tenantId, 'chitfunds');
  } catch {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <h3>Module Not Enabled</h3>
        <Link href="/subscription" className="btn btn-primary">View Subscription</Link>
      </div>
    );
  }

  const branchId = await getActiveBranchId();
  const [dict, currencySymbol, resolvedSearch] = await Promise.all([
    getDictionary(tenantId),
    getSetting(tenantId, 'currency_symbol', '₹'),
    searchParams,
  ]);

  const showAllBranch = resolvedSearch?.scope === 'all' && (role !== 'agent' || Boolean(staffPermissions?.canViewChits));

  const scope = {
    tenantId,
    appType: 'chitfunds',
    branchId,
    role: role || 'agent',
    userId,
    customRoleName,
    staffPermissions,
  };

  // Foremen / staff see groups assigned to them via ChitGroupForeman; admins/superadmins (or staff toggling "All Branch") see all branch groups.
  const where =
    role === 'agent' && !showAllBranch
      ? scopedChitGroupWhere(scope, { foremen: { some: { userId } } })
      : scopedChitGroupWhere(scope);

  const [groups, pendingIntentsCount] = await Promise.all([
    prisma.chitGroup.findMany({
      where,
      include: {
        _count: { select: { members: true, auctions: true } },
        foremen: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: {
            user: {
              select: { id: true, name: true, phone: true, customRoleName: true },
            },
          },
        },
        auctions: {
          orderBy: { periodNumber: 'asc' },
          select: {
            id: true,
            periodNumber: true,
            status: true,
            roomStatus: true,
            auctionDate: true,
            scheduledAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.chitPaymentIntent.count({
      where: {
        tenantId,
        status: 'pending',
        ...(branchId ? { branchId } : {}),
      },
    }),
  ]);

  const grantedCapabilities =
    role === 'agent'
      ? STAFF_PERMISSION_META.filter((m) => Boolean(staffPermissions?.[m.key])).map((m) => m.label)
      : ['Full Branch / Tenant Admin Control'];

  return (
    <ForemanPortalClient
      user={{
        id: userId,
        name: session.user.name || 'Foreman',
        role: role || 'agent',
        roleLabel: customRoleName || (role === 'agent' ? 'Foreman / Staff' : role?.toUpperCase() || 'Admin'),
      }}
      groups={JSON.parse(JSON.stringify(groups))}
      currencySymbol={currencySymbol}
      pendingIntentsCount={pendingIntentsCount}
      grantedCapabilities={grantedCapabilities}
      canManageChits={canAdminChits(role, staffPermissions)}
      canConductAuction={canConductChitAuction(role, staffPermissions)}
      showingAllBranch={showAllBranch}
      canViewAllBranch={role !== 'agent' || Boolean(staffPermissions?.canViewChits)}
      dict={dict}
    />
  );
}
