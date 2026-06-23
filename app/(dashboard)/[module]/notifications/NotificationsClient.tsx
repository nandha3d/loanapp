'use client';

import { useState } from 'react';
import { markNotificationRead, markAllNotificationsRead } from './actions';
import { useRouter } from 'next/navigation';
import { useDashboardPath } from '@/components/layout/useDashboardPath';
import { formatNotificationTime } from '@/lib/utils';


const iconColorMap: Record<string, string> = {
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  success: '#22C55E',
};

const defaultIconMap: Record<string, string> = {
  warning: 'warning',
  danger: 'error',
  info: 'info',
  success: 'check_circle',
};

function timeAgo(dateStr: string, d: any): string {
  // <24h → relative; older → exact date & time (so it's not just "5 days ago").
  return formatNotificationTime(dateStr, { justNow: d.justNow, minutesAgo: d.minutesAgo, hoursAgo: d.hoursAgo });
}

export default function NotificationsClient({
  notifications,
  dict,
}: {
  notifications: any[];
  dict: any;
}) {
  const d = dict.notifications;
  const router = useRouter();
  const dashboardPath = useDashboardPath();
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter((n) => n.type === filter);

  const handleMarkAllRead = async () => {
    setLoading(true);
    await markAllNotificationsRead();
    setLoading(false);
    router.refresh();
  };

  const handleClick = async (notif: any) => {
    if (!notif.isRead) {
      await markNotificationRead(notif.id);
      router.refresh();
    }
    if (notif.link) {
      router.push(dashboardPath(notif.link));
    }
  };

  const filterButtons = [
    { key: 'all', label: d.all },
    { key: 'warning', label: d.warnings },
    { key: 'danger', label: d.critical },
    { key: 'info', label: d.infoLabel },
    { key: 'success', label: d.successLabel },
  ];

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="card">
      <div className="card-header">
        <h3>🔔 {d.title} {unreadCount > 0 && <span className="badge badge-pending" style={{ marginLeft: '8px' }}>{unreadCount} {d.unread}</span>}</h3>
        <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead} disabled={loading || unreadCount === 0}>
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>done_all</span>
          {loading ? d.marking : d.markAllRead}
        </button>
      </div>

      <div className="filter-bar">
        {filterButtons.map((fb) => (
          <button
            key={fb.key}
            className={`btn btn-sm ${filter === fb.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(fb.key)}
          >
            {fb.label}
          </button>
        ))}
      </div>

      <div>
        {filtered.map((n) => {
          const color = iconColorMap[n.type] || '#64748B';
          const icon = n.icon || defaultIconMap[n.type] || 'notifications';
          return (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              style={{
                display: 'flex',
                gap: '14px',
                padding: '16px 0',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: n.isRead ? 'transparent' : 'var(--primary-light)',
                margin: n.isRead ? '0' : '0 -24px',
                paddingLeft: n.isRead ? '0' : '24px',
                paddingRight: n.isRead ? '0' : '24px',
                transition: 'background .2s',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: `${color}15`,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '20px' }}>{icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <h4 style={{ fontSize: '.9rem', fontWeight: 600 }}>
                    {n.title || d.notificationFallback}
                    {!n.isRead && (
                      <span style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', display: 'inline-block', marginLeft: '6px' }} />
                    )}
                  </h4>
                  <span style={{ fontSize: '.72rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{timeAgo(n.createdAt, d)}</span>
                </div>
                <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{n.message}</p>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', fontSize: '.85rem' }}>
            {d.noNotificationsFound}
          </div>
        )}
      </div>
    </div>
  );
}
