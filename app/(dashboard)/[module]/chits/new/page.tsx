import { auth } from '@/lib/auth';
import { getActiveBranchId, branchScopeWhere } from '@/lib/branch';
import { canAdminChits } from '@/lib/chits/access';
import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { modulePath } from '@/types/modules';
import { redirect } from 'next/navigation';
import ChitGroupForm from './ChitGroupForm';
import { getDictionary, getCurrentLanguage } from '@/lib/i18n';
import Link from '@/components/layout/DashboardLink';
import { getChitTypeSettings } from '@/lib/chits/settings';

export default async function NewChitGroupPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const appType = await getUserAppType();
  const role = (session.user as any)?.role as string | undefined;
  const staffPermissions = (session.user as any)?.staffPermissions ?? null;
  if (!canAdminChits(role, staffPermissions)) redirect(modulePath(appType, '/collection'));

  const tenantId = await getDefaultTenantId();
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
  const dict = await getDictionary(tenantId);
  const lang = await getCurrentLanguage(tenantId);

  // SCOPE-12: the member picker is branch work. Tenant-wide, a superadmin on
  // one branch could enrol another branch's customers into a chit group.
  const activeBranchId = await getActiveBranchId();
  const [customers, chitTypeSettings, staffUsers] = await Promise.all([
    prisma.customer.findMany({
      where: { tenantId, appType, status: 'active', deletedAt: null, ...branchScopeWhere(activeBranchId) },
      select: { id: true, name: true, customerCode: true },
      orderBy: { name: 'asc' },
    }),
    getChitTypeSettings(tenantId),
    prisma.user.findMany({
      where: {
        tenantId,
        status: 'active',
        deletedAt: null,
        OR: [
          { role: { in: ['admin', 'superadmin'] } },
          { role: 'agent', appType, ...branchScopeWhere(activeBranchId) },
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
    }),
  ]);

  return (
    <div>
      <ChitGroupForm
        customers={customers}
        staffUsers={staffUsers}
        currentUserId={session.user?.id}
        currencySymbol={currencySymbol}
        dict={dict}
        lang={lang}
        enabledChitTypes={chitTypeSettings.enabledTypes}
        typeDefaults={chitTypeSettings.typeDefaults}
      />
    </div>
  );
}
