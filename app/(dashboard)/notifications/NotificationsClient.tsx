'use client';

import { useState } from 'react';
import { markNotificationRead, markAllNotificationsRead } from './actions';
import { useRouter } from 'next/navigation';

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

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return 'Yesterday';
  return `${Math.floor(diff / 86400)} days ago`;
}

export default function NotificationsClient({
  notifications,
}: {
  notifications: any[];
}) {
  const router = useRouter();
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
      router.push(notif.link);
    }
  };

  const filterButtons = [
    { key: 'all', label: 'All' },
    { key: 'warning', label: '⚠️ Warnings' },
    { key: 'danger', label: '🔴 Critical' },
    { key: 'info', label: 'ℹ️ Info' },
    { key: 'success', label: '✅ Success' },
  ];

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="card">
      <div className="card-header">
        <h3>🔔 Notifications {unreadCount > 0 && <span className="badge badge-pending" style={{ marginLeft: '8px' }}>{unreadCount} unread</span>}</h3>
        <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead} disabled={loading || unreadCount === 0}>
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>done_all</span>
          {loading ? 'Marking...' : 'Mark All Read'}
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
                    {n.title || 'Notification'}
                    {!n.isRead && (
                      <span style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', display: 'inline-block', marginLeft: '6px' }} />
                    )}
                  </h4>
                  <span style={{ fontSize: '.72rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{timeAgo(n.createdAt)}</span>
                </div>
                <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{n.message}</p>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', fontSize: '.85rem' }}>
            No notifications found.
          </div>
        )}
      </div>
    </div>
  );
}
