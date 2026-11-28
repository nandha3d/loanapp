import { auth } from '@/lib/auth';
import { branchScopeWhere, getActiveBranchId } from '@/lib/branch';
import { canAdminChits } from '@/lib/chits/access';
import { getChitTypeSettings } from '@/lib/chits/settings';
import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { modulePath } from '@/types/modules';
import { notFound, redirect } from 'next/navigation';
import { getCurrentLanguage, getDictionary } from '@/lib/i18n';
import ChitGroupEditForm from './ChitGroupEditForm';

export default async function EditChitGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  const appType = await getUserAppType();
  const sessionUser = session.user as {
    role?: string;
    staffPermissions?: Parameters<typeof canAdminChits>[1];
  };
  const role = sessionUser.role;
  const staffPermissions = sessionUser.staffPermissions ?? null;
  if (!canAdminChits(role, staffPermissions)) redirect(modulePath(appType, '/collection'));

  const tenantId = await getDefaultTenantId();
  await requireModule(tenantId, 'chitfunds');
  const branchId = await getActiveBranchId();
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
  const [dict, lang, chitTypeSettings] = await Promise.all([
    getDictionary(tenantId),
    getCurrentLanguage(tenantId),
    getChitTypeSettings(tenantId),
  ]);

  const group = await prisma.chitGroup.findFirst({
    where: {
      OR: [{ id }, { groupCode: id }],
      tenantId,
      appType,
      deletedAt: null,
      ...branchScopeWhere(branchId),
    },
    select: {
      id: true,
      groupCode: true,
      name: true,
      status: true,
      chitType: true,
      chitEngineType: true,
      chitValue: true,
      monthlyContrib: true,
      totalMembers: true,
      durationMonths: true,
      startDate: true,
      auctionType: true,
      auctionFrequency: true,
      frequencyUnit: true,
      frequencyInterval: true,
      auctionMode: true,
      auctionTime: true,
      commissionPct: true,
      commissionBasis: true,
      gstPct: true,
      minDiscountPct: true,
      maxDiscountPct: true,
      bidIncrement: true,
      dividendPolicy: true,
      dividendDistribution: true,
      hasForemanTicket: true,
      roomAdmission: true,
      bellEnabled: true,
      bellIntervalSeconds: true,
      bellCount: true,
      bellAutoClose: true,
      foremanName: true,
      approvedBankName: true,
      approvedBankAccountNo: true,
      remarks: true,
      engineConfig: true,
      stateCode: true,
      registrationNo: true,
      registrarOffice: true,
      bylawNo: true,
      commencementCertificate: true,
      priorSanctionNumber: true,
      registeredOfficeAddress: true,
      _count: { select: { members: true } },
    },
  });

  if (!group) notFound();

  return (
    <div>
      <ChitGroupEditForm
        group={JSON.parse(JSON.stringify(group))}
        currencySymbol={currencySymbol}
        lang={lang}
        dict={dict}
        enabledChitTypes={chitTypeSettings?.enabledTypes}
      />
    </div>
  );
}
