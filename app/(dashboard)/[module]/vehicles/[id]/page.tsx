import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { formatDate } from '@/lib/utils';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import Link from '@/components/layout/DashboardLink';
import VehicleDetailClient from './VehicleDetailClient';
import VehicleRecoveryPanel from './VehicleRecoveryPanel';
import { getDictionary } from '@/lib/i18n';

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const dict = await getDictionary(tenantId);
  const session = await auth();
  const isAgent = (session?.user as any)?.role === 'agent';

  let vehicle: any = null;
  try {
    vehicle = await prisma.vehicle.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        loan: { select: { id: true, loanCode: true, status: true } },
        repoFlaggedBy: { select: { name: true } },
      },
    });
  } catch { /* table may not exist yet */ }

  if (!vehicle) notFound();

  // Recovery history + the agent list for the seize modal. Failures are
  // tolerated so the page stays usable before the HP foundation migration runs.
  const [episodes, agents, currencySymbol] = await Promise.all([
    prisma.vehicleRecovery.findMany({
      where: { vehicleId: vehicle.id, tenantId },
      orderBy: { seizedAt: 'desc' },
      include: {
        seizedBy: { select: { name: true } },
        releasedBy: { select: { name: true } },
      },
    }).catch(() => []),
    prisma.user.findMany({
      where: { tenantId, status: 'active', role: { in: ['agent', 'staff', 'admin'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }).catch(() => []),
    getSetting(tenantId, 'currency_symbol', '₹'),
  ]);

  const serializedEpisodes = episodes.map((e) => ({
    id: e.id,
    seizedAt: e.seizedAt.toISOString(),
    yardLocation: e.yardLocation,
    seizingCharges: e.seizingCharges.toString(),
    remarks: e.remarks,
    status: e.status,
    seizedByName: e.seizedByName,
    seizedBy: e.seizedBy,
    releasedAt: e.releasedAt ? e.releasedAt.toISOString() : null,
    releasedBy: e.releasedBy,
    releaseRemarks: e.releaseRemarks,
  }));

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Link href="/vehicles" className="btn btn-ghost btn-sm">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          {dict.vehicles.backToVehicles}
        </Link>
      </div>
      <VehicleDetailClient
        vehicle={vehicle as any}
        formatDate={(d) => (d ? formatDate(d) : '—')}
        dict={dict}
      />
      {appType === 'autofinance' && !isAgent && (
        <VehicleRecoveryPanel
          vehicleId={vehicle.id}
          registrationNo={vehicle.registrationNo}
          hasLoan={Boolean(vehicle.loanId)}
          episodes={serializedEpisodes}
          agents={agents}
          currencySymbol={currencySymbol}
          formatDate={(d) => (d ? formatDate(d) : '—')}
        />
      )}
    </div>
  );
}
