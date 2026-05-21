import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { formatDate } from '@/lib/utils';
import { notFound } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import VehicleDetailClient from './VehicleDetailClient';
import { getDictionary } from '@/lib/i18n';

export default async function VehicleDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const tenantId = await getDefaultTenantId();
  const dict = await getDictionary(tenantId);

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
    </div>
  );
}
