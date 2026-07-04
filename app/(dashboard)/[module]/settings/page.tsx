import prisma from '@/lib/db';
import { getDefaultTenantId, getTenantSettings, getUserAppType } from '@/lib/tenant';
import SettingsClient from './SettingsClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { modulePath } from '@/types/modules';
import { getSubscription } from '@/lib/subscription';
import { getActiveBranchId } from '@/lib/branch';
import { serverFetch } from '@/lib/api-client/server';

export default async function SettingsPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'developer') {
    redirect(modulePath(appType, '/collection'));
  }

  const tenantId = await getDefaultTenantId();
  const dict = await getDictionary(tenantId);
  
  const [routes, rawPackages, users, settings, currentUser, subscription, bureauCredential, notificationTemplates] = await Promise.all([
    prisma.route.findMany({ 
      where: { tenantId, appType },
      include: { 
        assignedAgent: true, 
        _count: { select: { customers: true } },
        routeAgents: { include: { agent: { select: { id: true, name: true } } } }
      }
    }),
    prisma.loanPackage.findMany({ where: { tenantId, appType } }),
    prisma.user.findMany({ where: { tenantId, appType } }),
    getTenantSettings(tenantId),
    prisma.user.findUnique({ where: { id: session?.user?.id } }),
    getSubscription(tenantId),
    prisma.bureauCredential.findUnique({ where: { tenantId } }),
    prisma.notificationTemplate.findMany({ where: { tenantId } }),
  ]);

  const packages = rawPackages.map(p => ({
    ...p,
    principal: p.principal.toString(),
    deduction: p.deduction.toString(),
    perInstalment: p.perInstalment.toString(),
    penaltyRate: p.penaltyRate.toString(),
  }));

  const safeSettings = {
    ...settings,
    msg91_auth_key: '',
    smtp_pass: '',
  };

  // ── Scoped agent management (Users tab): resolve the ONE branch this actor
  // manages for the current module, then list its agents. ──
  let manageBranchId: string | null = null;
  if (userRole === 'admin') {
    manageBranchId = (currentUser as any)?.branchId ?? null;
  } else {
    // superadmin / developer → active branch, else first owned/any branch
    const active = await getActiveBranchId();
    if (active && active !== 'all') {
      manageBranchId = active;
    } else {
      const firstBranch = await prisma.branch.findFirst({
        where: userRole === 'superadmin'
          ? { tenantId, superadminId: session?.user?.id }
          : { tenantId },
        select: { id: true },
        orderBy: { name: 'asc' },
      });
      manageBranchId = firstBranch?.id ?? null;
    }
  }

  let branchAgents: {
    id: string;
    name: string;
    username: string;
    phone: string;
    status: string;
    aadharNumber?: string | null;
    dob?: Date | null;
    experience?: string | null;
    age?: number | null;
    bypassLoanApproval?: boolean;
    bypassCustomerApproval?: boolean;
    autoReleaseFloat?: boolean;
    feeConfirmationMandatory?: boolean;
  }[] = [];
  let manageBranchName: string | null = null;
  if (manageBranchId) {
    const [agents, br] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId, appType, role: 'agent', branchId: manageBranchId },
        select: {
          id: true,
          name: true,
          username: true,
          phone: true,
          status: true,
          aadharNumber: true,
          dob: true,
          experience: true,
          age: true,
          bypassLoanApproval: true,
          bypassCustomerApproval: true,
          autoReleaseFloat: true,
          feeConfirmationMandatory: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.branch.findUnique({ where: { id: manageBranchId }, select: { name: true } }),
    ]);
    branchAgents = agents.map((a) => ({ ...a, phone: a.phone ?? '' }));
    manageBranchName = br?.name ?? null;
  }

  // Decrypt credential fields securely on the server
  let decryptedCreds: any = null;
  if (bureauCredential) {
    const { decryptField } = await import('@/lib/pii');
    decryptedCreds = {
      provider: bureauCredential.provider,
      memberId: decryptField(bureauCredential.memberId) || '',
      apiKey: decryptField(bureauCredential.apiKey) || '',
      apiSecret: bureauCredential.apiSecret ? (decryptField(bureauCredential.apiSecret) || '') : '',
      environment: bureauCredential.environment,
      isActive: bureauCredential.isActive,
      hasCert: !!bureauCredential.bureauCert,
      hasKey: !!bureauCredential.bureauKey,
    };
  }

  // Gold master data + config for the Gold Master settings tab (gold module only).
  let goldMaster: any = null;
  let goldConfig: any = null;
  if (appType === 'goldloan') {
    try {
      const { getGoldConfig } = await import('@/lib/gold/settings');
      const [m, cfg] = await Promise.all([
        serverFetch<any>('/gold/master').catch(() => null),
        getGoldConfig(tenantId).catch(() => null),
      ]);
      goldMaster = m?.data ?? null;
      goldConfig = cfg;
    } catch { goldMaster = null; goldConfig = null; }
  }

  return (
    <SettingsClient
      routes={routes}
      packages={packages}
      goldMaster={goldMaster}
      goldConfig={goldConfig}
      users={users} 
      settings={safeSettings}
      currencySymbol={settings.currency_symbol || '₹'}
      dict={dict}
      currentUser={currentUser}
      subscription={subscription}
      bureauCredential={decryptedCreds}
      viewerRole={userRole}
      appType={appType}
      branchAgents={branchAgents}
      manageBranchId={manageBranchId}
      manageBranchName={manageBranchName}
      notificationTemplates={notificationTemplates}
    />
  );
}
