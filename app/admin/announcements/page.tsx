import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import AnnouncementPortalClient from './AnnouncementPortalClient';
import { getAnnouncementsList, getAllDirectoryUsers } from './actions';

export const metadata = {
  title: 'Announcement Portal — Developer Console',
};

export default async function AnnouncementsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (role !== 'developer' && role !== 'superadmin') {
    redirect('/login');
  }

  const [announcements, directory] = await Promise.all([
    getAnnouncementsList({ status: 'all' }),
    getAllDirectoryUsers(),
  ]);

  // Aggregate high level analytics
  const totalCount = announcements.length;
  const activeCount = announcements.filter((a: any) => a.status === 'published').length;
  const totalTargeted = announcements.reduce((acc: number, a: any) => acc + (a.totalTargeted || 0), 0);
  const totalRead = announcements.reduce((acc: number, a: any) => acc + (a.totalRead || 0), 0);
  const totalDismissed = announcements.reduce((acc: number, a: any) => acc + (a.totalDismissed || 0), 0);
  const overallReadRate = totalTargeted > 0 ? Math.round((totalRead / totalTargeted) * 100) : 0;

  const stats = {
    totalCount,
    activeCount,
    totalTargeted,
    totalRead,
    totalDismissed,
    overallReadRate,
  };

  return (
    <div className="admin-page-content" style={{ padding: '24px 32px' }}>
      <AnnouncementPortalClient
        initialAnnouncements={announcements}
        directory={directory}
        stats={stats}
      />
    </div>
  );
}
