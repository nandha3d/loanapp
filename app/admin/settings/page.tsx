import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import SettingsClient from './SettingsClient';

export default async function AdminSettingsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  if (role !== 'developer') redirect('/admin');

  // Fetch current developer user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      phone: true,
      email: true,
    },
  });

  if (!user) redirect('/login');

  // Fetch system-wide stats
  const [totalTenants, totalUsers, totalLoans, totalBranches, totalCustomers] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.loan.count(),
    prisma.branch.count(),
    prisma.customer.count(),
  ]);

  return (
    <SettingsClient
      user={user}
      stats={{
        totalTenants,
        totalUsers,
        totalLoans,
        totalBranches,
        totalCustomers,
      }}
    />
  );
}
