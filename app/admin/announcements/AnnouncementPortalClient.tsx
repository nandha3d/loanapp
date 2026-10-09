'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  createAnnouncementAction,
  archiveAnnouncementAction,
  deleteAnnouncementAction,
  resendAnnouncementAction,
  getAnnouncementRecipientsList,
} from './actions';
import {
  ANNOUNCEMENT_TEMPLATES,
  FestivalOfferPage,
  FeatureShowcasePage,
  ComplianceNoticePage,
  MaintenanceDowntimePage,
  CustomEmbedPage,
} from '@/components/announcements/pages';

interface AnnouncementPortalClientProps {
  initialAnnouncements: any[];
  directory: {
    users: any[];
    branches: any[];
    tenants: any[];
  };
  stats: {
    totalCount: number;
    activeCount: number;
    totalTargeted: number;
    totalRead: number;
    totalDismissed: number;
    overallReadRate: number;
  };
}

export default function AnnouncementPortalClient({
  initialAnnouncements,
  directory,
  stats: initialStats,
}: AnnouncementPortalClientProps) {
  const [announcements, setAnnouncements] = useState<any[]>(initialAnnouncements);
  const [stats, setStats] = useState(initialStats);
  const [activeTab, setActiveTab] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer Modal State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState<'popup' | 'scrolling'>('popup');

  // Form Fields
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'update' | 'warning' | 'critical' | 'celebration'>('info');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [isScrollingBar, setIsScrollingBar] = useState(true);
  const [isPopup, setIsPopup] = useState(true);
  const [actionLabel, setActionLabel] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // Custom Styled Page & Popup Options
  const [popupStyle, setPopupStyle] = useState<'standard' | 'box_75' | 'full_page'>('box_75');
  const [contentType, setContentType] = useState<'standard' | 'template' | 'custom_html' | 'embed_url'>('standard');
  const [templateId, setTemplateId] = useState<string>('festival');
  const [customHtml, setCustomHtml] = useState<string>('');
  const [embedUrl, setEmbedUrl] = useState<string>('');

  // Audience Targeting State
  const [targetScope, setTargetScope] = useState<'all' | 'role' | 'subscription' | 'geo' | 'selected' | 'single'>('all');
  const [targetRole, setTargetRole] = useState('agent');
  const [targetSubscription, setTargetSubscription] = useState('business');
  const [targetGeo, setTargetGeo] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [singleUserId, setSingleUserId] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Recipient Analytics Modal
  const [selectedAnnouncementForRecipients, setSelectedAnnouncementForRecipients] = useState<any | null>(null);
  const [recipientsList, setRecipientsList] = useState<any[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'read' | 'unread'>('all');

  // Filtered Users for Multi-Select Checklist
  const filteredDirectoryUsers = useMemo(() => {
    return directory.users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        (u.phone && u.phone.includes(userSearchTerm));
      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [directory.users, userSearchTerm, userRoleFilter]);

  // Target count estimate
  const estimatedTargetCount = useMemo(() => {
    switch (targetScope) {
      case 'all':
        return directory.users.length;
      case 'role':
        return directory.users.filter((u) => u.role === targetRole).length;
      case 'selected':
        return selectedUserIds.length;
      case 'single':
        return singleUserId ? 1 : 0;
      case 'geo':
        if (!targetGeo.trim()) return 0;
        return directory.users.filter((u) =>
          u.branch?.address?.toLowerCase().includes(targetGeo.toLowerCase()) ||
          u.branch?.name?.toLowerCase().includes(targetGeo.toLowerCase())
        ).length;
      case 'subscription':
        // Rough estimate based on subscription
        return directory.users.length;
      default:
        return directory.users.length;
    }
  }, [targetScope, targetRole, selectedUserIds, singleUserId, targetGeo, directory.users]);

  // Filtered Announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      const matchesTab = activeTab === 'all' || a.status === activeTab;
      const matchesType = typeFilter === 'all' || a.type === typeFilter;
      const matchesSearch =
        !searchQuery ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.message.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesType && matchesSearch;
    });
  }, [announcements, activeTab, typeFilter, searchQuery]);

  const handleOpenComposer = () => {
    setTitle('');
    setMessage('');
    setType('info');
    setPriority('normal');
    setIsScrollingBar(true);
    setIsPopup(true);
    setActionLabel('');
    setActionUrl('');
    setExpiresAt('');
    setPopupStyle('box_75');
    setContentType('standard');
    setTemplateId('festival');
    setCustomHtml('');
    setEmbedUrl('');
    setTargetScope('all');
    setSelectedUserIds([]);
    setSingleUserId('');
    setTargetGeo('');
    setIsComposerOpen(true);
  };

  const handleSubmitAnnouncement = async (status: 'published' | 'draft') => {
    if (!title.trim() || !message.trim()) {
      alert('Please provide both Title and Message.');
      return;
    }
    if (contentType === 'custom_html' && !customHtml.trim()) {
      alert('Please provide the Custom HTML code for the announcement page.');
      return;
    }
    if (contentType === 'embed_url' && !embedUrl.trim()) {
      alert('Please provide the URL to embed for the announcement page.');
      return;
    }
    if (targetScope === 'selected' && selectedUserIds.length === 0) {
      alert('Please select at least one user from the list.');
      return;
    }
    if (targetScope === 'single' && !singleUserId) {
      alert('Please choose a particular user.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createAnnouncementAction({
        title,
        message,
        type,
        priority,
        targetScope,
        targetRole: targetScope === 'role' ? targetRole : null,
        targetSubscription: targetScope === 'subscription' ? targetSubscription : null,
        targetGeo: targetScope === 'geo' ? targetGeo : null,
        targetUserIds: targetScope === 'selected' ? selectedUserIds : targetScope === 'single' ? [singleUserId] : [],
        isScrollingBar,
        isPopup,
        popupStyle,
        contentType,
        templateId: contentType === 'template' ? templateId : null,
        customHtml: contentType === 'custom_html' ? customHtml : null,
        embedUrl: contentType === 'embed_url' ? embedUrl : null,
        actionLabel: actionLabel.trim() || null,
        actionUrl: actionUrl.trim() || null,
        expiresAt: expiresAt || null,
        status,
      });

      if (res.success) {
        setIsComposerOpen(false);
        // Refresh local items
        const newItem = {
          id: res.id,
          title,
          message,
          type,
          priority,
          targetScope,
          isScrollingBar,
          isPopup,
          popupStyle,
          contentType,
          templateId: contentType === 'template' ? templateId : null,
          customHtml: contentType === 'custom_html' ? customHtml : null,
          embedUrl: contentType === 'embed_url' ? embedUrl : null,
          actionLabel,
          actionUrl,
          status,
          totalTargeted: estimatedTargetCount,
          totalRead: 0,
          totalDismissed: 0,
          createdAt: new Date().toISOString(),
        };
        setAnnouncements([newItem, ...announcements]);
        setStats((prev) => ({
          ...prev,
          totalCount: prev.totalCount + 1,
          activeCount: status === 'published' ? prev.activeCount + 1 : prev.activeCount,
          totalTargeted: prev.totalTargeted + estimatedTargetCount,
        }));
      }
    } catch (e: any) {
      alert('Error creating announcement: ' + (e?.message || 'Failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this announcement? It will stop appearing for all users.')) return;
    try {
      await archiveAnnouncementAction(id);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'archived' } : a))
      );
    } catch (e: any) {
      alert(e?.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this announcement?')) return;
    try {
      await deleteAnnouncementAction(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      alert(e?.message);
    }
  };

  const handleResend = async (id: string) => {
    try {
      const res = await resendAnnouncementAction(id);
      alert(`Sent notification reminder to ${res.count} unread users!`);
    } catch (e: any) {
      alert(e?.message);
    }
  };

  const handleOpenRecipients = async (announcement: any) => {
    setSelectedAnnouncementForRecipients(announcement);
    setLoadingRecipients(true);
    try {
      const list = await getAnnouncementRecipientsList(announcement.id);
      setRecipientsList(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const getTypeBadge = (itemType: string) => {
    const config: Record<string, { label: string; bg: string; color: string; icon: string }> = {
      critical: { label: 'Critical', bg: '#FEE2E2', color: '#991B1B', icon: 'error' },
      warning: { label: 'Warning', bg: '#FEF3C7', color: '#92400E', icon: 'warning' },
      update: { label: 'Update', bg: '#E0E7FF', color: '#3730A3', icon: 'rocket_launch' },
      celebration: { label: 'Celebration', bg: '#F3E8FF', color: '#6B21A8', icon: 'celebration' },
      info: { label: 'Info', bg: '#F9F1FA', color: '#7D287E', icon: 'campaign' },
    };
    const c = config[itemType] || config.info;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '9999px',
          backgroundColor: c.bg,
          color: c.color,
          fontSize: '0.72rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        <span className="material-icons-outlined" style={{ fontSize: '13px' }}>
          {c.icon}
        </span>
        {c.label}
      </span>
    );
  };

  const getScopeLabel = (a: any) => {
    switch (a.targetScope) {
      case 'all':
        return '🌍 All Users';
      case 'role':
        return `👥 Role: ${a.targetRole || 'Specific'}`;
      case 'subscription':
        return `💳 Subscription: ${a.targetSubscription || 'Plan'}`;
      case 'geo':
        return `📍 Geo: ${a.targetGeo || 'Location'}`;
      case 'selected':
        return `☑️ Selected (${a.totalTargeted} Users)`;
      case 'single':
        return '👤 1 User Direct';
      default:
        return 'Broadcast';
    }
  };

  return (
    <div style={{ maxWidth: '1320px', margin: '0 auto' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '26px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                backgroundColor: 'var(--brand-purple-light, #F9F1FA)',
                color: 'var(--brand-purple, #7D287E)',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '0.74rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                border: '1px solid var(--brand-purple-border, #E8D3EB)',
              }}
            >
              Developer Console
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--primary, #1A1A2E)', margin: 0 }}>
            Announcement Portal
          </h1>
          <p style={{ color: '#6B7280', fontSize: '0.92rem', margin: '4px 0 0 0' }}>
            Broadcast targeted banners, dedicated popups, and notification alerts to all users, specific roles, subscription tiers, or individual accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenComposer}
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            fontSize: '0.92rem',
            fontWeight: 800,
            borderRadius: '12px',
            backgroundColor: 'var(--brand-purple, #7D287E)',
            color: '#FFFFFF',
            boxShadow: '0 4px 14px rgba(125, 40, 126, 0.28)',
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
            add_alert
          </span>
          <span>New Announcement</span>
        </button>
      </div>

      {/* Analytics Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '18px',
          marginBottom: '28px',
        }}
      >
        <div className="card" style={{ padding: '20px', borderRadius: '16px', backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
              Total Created
            </span>
            <span className="material-icons-outlined" style={{ color: 'var(--brand-purple, #7D287E)', fontSize: '22px' }}>
              campaign
            </span>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#111827' }}>{stats.totalCount}</div>
          <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: '2px' }}>Lifetime broadcasts & drafts</div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '16px', backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
              Live Active
            </span>
            <span className="material-icons-outlined" style={{ color: '#10B981', fontSize: '22px' }}>
              sensors
            </span>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#10B981' }}>{stats.activeCount}</div>
          <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: '2px' }}>Currently broadcasting</div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '16px', backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
              Delivered Reach
            </span>
            <span className="material-icons-outlined" style={{ color: '#6366F1', fontSize: '22px' }}>
              mark_email_read
            </span>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#111827' }}>{stats.totalTargeted}</div>
          <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: '2px' }}>Total user receipts generated</div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '16px', backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
              Read Rate
            </span>
            <span className="material-icons-outlined" style={{ color: '#F59E0B', fontSize: '22px' }}>
              insights
            </span>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--brand-purple, #7D287E)' }}>
            {stats.overallReadRate}%
          </div>
          <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: '2px' }}>
            {stats.totalRead} of {stats.totalTargeted} acknowledged
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          backgroundColor: '#FFFFFF',
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1.5px solid #E5E7EB',
          marginBottom: '20px',
        }}
      >
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['all', 'published', 'draft', 'archived'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '7px 16px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: activeTab === tab ? 'var(--brand-purple, #7D287E)' : '#F3F4F6',
                color: activeTab === tab ? '#FFFFFF' : '#4B5563',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
              }}
            >
              {tab === 'published' ? 'Active Live' : tab}
            </button>
          ))}
        </div>

        {/* Type Filter & Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1.5px solid #D1D5DB',
              fontSize: '0.84rem',
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              color: '#374151',
            }}
          >
            <option value="all">All Types</option>
            <option value="info">Info</option>
            <option value="update">Update</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
            <option value="celebration">Celebration</option>
          </select>

          <div style={{ position: 'relative' }}>
            <span
              className="material-icons-outlined"
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9CA3AF',
                fontSize: '18px',
              }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 14px 8px 34px',
                borderRadius: '10px',
                border: '1.5px solid #D1D5DB',
                fontSize: '0.84rem',
                width: '240px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Announcements Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1.5px solid #E5E7EB',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        }}
      >
        {filteredAnnouncements.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#6B7280' }}>
            <span className="material-icons-outlined" style={{ fontSize: '48px', color: '#D1D5DB', marginBottom: '12px' }}>
              campaign
            </span>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#374151' }}>No Announcements Found</div>
            <p style={{ fontSize: '0.86rem', marginTop: '4px' }}>
              Create your first announcement to broadcast to all or selected users.
            </p>
            <button
              type="button"
              onClick={handleOpenComposer}
              className="btn btn-primary"
              style={{ marginTop: '16px', padding: '9px 20px', fontSize: '0.88rem' }}
            >
              Compose Announcement
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1.5px solid #E5E7EB', color: '#4B5563' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Type & Title
                  </th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Audience Target
                  </th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Channels
                  </th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Read & Acknowledged
                  </th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    Status
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAnnouncements.map((a) => {
                  const readPct = a.totalTargeted > 0 ? Math.round((a.totalRead / a.totalTargeted) * 100) : 0;
                  return (
                    <tr
                      key={a.id}
                      style={{
                        borderBottom: '1px solid #F3F4F6',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9F1FA')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Title & Preview */}
                      <td style={{ padding: '16px 20px', maxWidth: '340px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          {getTypeBadge(a.type)}
                          {a.priority === 'urgent' && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#DC2626', backgroundColor: '#FEE2E2', padding: '1px 6px', borderRadius: '4px' }}>
                              URGENT
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 800, color: '#111827', fontSize: '0.94rem', marginBottom: '3px' }}>
                          {a.title}
                        </div>
                        <div style={{ color: '#6B7280', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.message}
                        </div>
                      </td>

                      {/* Audience */}
                      <td style={{ padding: '16px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            backgroundColor: '#F3F4F6',
                            color: '#374151',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                          }}
                        >
                          {getScopeLabel(a)}
                        </span>
                      </td>

                      {/* Display Channels */}
                      <td style={{ padding: '16px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {a.isScrollingBar && (
                            <span
                              title="Scrolling Top Bar"
                              style={{
                                backgroundColor: '#E0E7FF',
                                color: '#3730A3',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '13px' }}>
                                view_headline
                              </span>
                              Top Bar
                            </span>
                          )}
                          {a.isPopup && (
                            <span
                              title="Dedicated Popup Modal"
                              style={{
                                backgroundColor: '#FEF3C7',
                                color: '#92400E',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '13px' }}>
                                open_in_browser
                              </span>
                              Popup
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Engagement */}
                      <td style={{ padding: '16px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', backgroundColor: '#E5E7EB', borderRadius: '9999px', overflow: 'hidden', maxWidth: '90px' }}>
                            <div
                              style={{
                                width: `${readPct}%`,
                                height: '100%',
                                backgroundColor: 'var(--brand-purple, #7D287E)',
                                borderRadius: '9999px',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151' }}>
                            {a.totalRead}/{a.totalTargeted} ({readPct}%)
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 16px' }}>
                        {a.status === 'published' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: '#059669',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: '#10B981',
                                display: 'inline-block',
                              }}
                            />
                            Live
                          </span>
                        ) : (
                          <span style={{ color: '#9CA3AF', fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' }}>
                            {a.status}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Link
                            href={`/announcements/${a.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Direct Styled Page"
                            style={{
                              padding: '6px',
                              borderRadius: '8px',
                              border: '1px solid #D1D5DB',
                              backgroundColor: '#FFFFFF',
                              cursor: 'pointer',
                              color: '#3B82F6',
                              display: 'flex',
                              alignItems: 'center',
                              textDecoration: 'none',
                            }}
                          >
                            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                              open_in_new
                            </span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleOpenRecipients(a)}
                            title="View Recipients & Delivery Stats"
                            style={{
                              padding: '6px',
                              borderRadius: '8px',
                              border: '1px solid #D1D5DB',
                              backgroundColor: '#FFFFFF',
                              cursor: 'pointer',
                              color: '#374151',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                              people
                            </span>
                          </button>

                          {a.status === 'published' && (
                            <button
                              type="button"
                              onClick={() => handleResend(a.id)}
                              title="Resend / Ping unread users"
                              style={{
                                padding: '6px',
                                borderRadius: '8px',
                                border: '1px solid #D1D5DB',
                                backgroundColor: '#FFFFFF',
                                cursor: 'pointer',
                                color: 'var(--brand-purple, #7D287E)',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                                send
                              </span>
                            </button>
                          )}

                          {a.status === 'published' ? (
                            <button
                              type="button"
                              onClick={() => handleArchive(a.id)}
                              title="Archive Announcement"
                              style={{
                                padding: '6px',
                                borderRadius: '8px',
                                border: '1px solid #D1D5DB',
                                backgroundColor: '#FFFFFF',
                                cursor: 'pointer',
                                color: '#F59E0B',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                                archive
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDelete(a.id)}
                              title="Delete Permanently"
                              style={{
                                padding: '6px',
                                borderRadius: '8px',
                                border: '1px solid #D1D5DB',
                                backgroundColor: '#FFFFFF',
                                cursor: 'pointer',
                                color: '#EF4444',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                                delete
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* COMPOSER MODAL WIZARD */}
      {isComposerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(17, 24, 39, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsComposerOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '860px',
              maxHeight: '92vh',
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '22px 28px',
                borderBottom: '1.5px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#111827', margin: 0 }}>
                  Compose Announcement
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#6B7280', margin: '3px 0 0 0' }}>
                  Target all users, selected accounts, subscription tiers, or locations with scrolling top bars and popups.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9CA3AF',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '24px' }}>
                  close
                </span>
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                {/* Left Column: Form Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Title & Type */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>
                      Announcement Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Scheduled System Maintenance Tonight"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #D1D5DB',
                        fontSize: '0.92rem',
                        fontWeight: 600,
                      }}
                    />
                  </div>

                  {/* Category Type & Priority */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>
                        Category Type
                      </label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1.5px solid #D1D5DB',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                        }}
                      >
                        <option value="info">ℹ️ General Information</option>
                        <option value="update">🚀 Feature / Platform Update</option>
                        <option value="warning">⚠️ System Advisory</option>
                        <option value="critical">🚨 Critical Alert</option>
                        <option value="celebration">🎉 Celebration / Offer</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>
                        Priority
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1.5px solid #D1D5DB',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                        }}
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>

                  {/* Message Body */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>
                      Message Content *
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Write your announcement details here..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #D1D5DB',
                        fontSize: '0.9rem',
                        lineHeight: 1.5,
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  {/* Display Presentation Options */}
                  <div style={{ backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#374151', marginBottom: '10px' }}>
                      Display Presentation Channels:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', fontWeight: 600, color: '#1F2937', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isScrollingBar}
                          onChange={(e) => setIsScrollingBar(e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--brand-purple, #7D287E)' }}
                        />
                        <span>Scrolling Top Bar (Ticker across web & mobile dashboards)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', fontWeight: 600, color: '#1F2937', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isPopup}
                          onChange={(e) => setIsPopup(e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--brand-purple, #7D287E)' }}
                        />
                        <span>Dedicated Popup Modal / Styled Page</span>
                      </label>
                    </div>
                  </div>

                  {/* Popup Presentation Style & Content Mode */}
                  {isPopup && (
                    <div style={{ backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '12px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>
                          Popup Presentation Layout:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                          {[
                            { id: 'box_75', label: '75% Box Popup', sub: 'Floating 75vw Card', icon: 'aspect_ratio' },
                            { id: 'full_page', label: 'Full Page Takeover', sub: '100% Immersive View', icon: 'fullscreen' },
                            { id: 'standard', label: 'Standard Dialog', sub: 'Compact Dialog Box', icon: 'picture_in_picture' },
                          ].map((style) => (
                            <button
                              key={style.id}
                              type="button"
                              onClick={() => setPopupStyle(style.id as any)}
                              style={{
                                padding: '10px 8px',
                                borderRadius: '10px',
                                border: popupStyle === style.id ? '2px solid var(--brand-purple, #7D287E)' : '1px solid #D1D5DB',
                                backgroundColor: popupStyle === style.id ? '#F9F1FA' : '#FFFFFF',
                                color: popupStyle === style.id ? 'var(--brand-purple, #7D287E)' : '#374151',
                                cursor: 'pointer',
                                textAlign: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{style.icon}</span>
                              <span style={{ fontSize: '0.76rem', fontWeight: 800 }}>{style.label}</span>
                              <span style={{ fontSize: '0.68rem', color: '#6B7280' }}>{style.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Content Mode */}
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>
                          Page Design & Content Mode:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                          {[
                            { id: 'standard', label: 'Standard', icon: 'chat' },
                            { id: 'template', label: 'Templates', icon: 'auto_awesome' },
                            { id: 'custom_html', label: 'HTML Page', icon: 'code' },
                            { id: 'embed_url', label: 'Embed URL', icon: 'link' },
                          ].map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setContentType(c.id as any)}
                              style={{
                                padding: '8px 6px',
                                borderRadius: '8px',
                                border: contentType === c.id ? '2px solid var(--brand-purple, #7D287E)' : '1px solid #D1D5DB',
                                backgroundColor: contentType === c.id ? '#F9F1FA' : '#FFFFFF',
                                color: contentType === c.id ? 'var(--brand-purple, #7D287E)' : '#4B5563',
                                cursor: 'pointer',
                                textAlign: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '17px' }}>{c.icon}</span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Template Selector */}
                      {contentType === 'template' && (
                        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#374151', marginBottom: '8px' }}>
                            Choose Designed Template:
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {ANNOUNCEMENT_TEMPLATES.map((tmpl) => (
                              <button
                                key={tmpl.id}
                                type="button"
                                onClick={() => setTemplateId(tmpl.id)}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: '10px',
                                  border: templateId === tmpl.id ? '2px solid var(--brand-purple, #7D287E)' : '1px solid #E5E7EB',
                                  backgroundColor: templateId === tmpl.id ? '#FAF5FF' : '#FFFFFF',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--brand-purple, #7D287E)' }}>
                                    {tmpl.icon}
                                  </span>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827' }}>{tmpl.name}</span>
                                </div>
                                <span style={{ fontSize: '0.70rem', color: '#6B7280', lineHeight: 1.2 }}>{tmpl.description}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom HTML Editor */}
                      {contentType === 'custom_html' && (
                        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#374151' }}>
                              Custom HTML Markup:
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomHtml(`<div style="background: linear-gradient(135deg, #7D287E, #4A154B); color: #FFFFFF; padding: 48px; border-radius: 20px; text-align: center; font-family: sans-serif;">
  <span style="font-size: 48px;">✨</span>
  <h1 style="font-size: 2rem; margin: 16px 0 8px 0; color: #FCF6AB;">Special Milestone Celebration</h1>
  <p style="font-size: 1.05rem; opacity: 0.9; max-width: 500px; margin: 0 auto 24px auto;">
    We have just crossed 100,000 active loans disbursed across 24 branches. Thank you for your partnership!
  </p>
  <div style="display: inline-block; background: #FCF6AB; color: #7D287E; font-weight: 800; padding: 12px 28px; border-radius: 9999px; text-decoration: none;">
    Claim Partner Reward
  </div>
</div>`);
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--brand-purple, #7D287E)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                            >
                              Load Sample Template
                            </button>
                          </div>
                          <textarea
                            rows={6}
                            placeholder="<div>Your styled HTML announcement page...</div>"
                            value={customHtml}
                            onChange={(e) => setCustomHtml(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: '1.5px solid #D1D5DB',
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                              lineHeight: 1.4,
                              backgroundColor: '#1E1B2E',
                              color: '#A7F3D0',
                            }}
                          />
                        </div>
                      )}

                      {/* Embed URL Input */}
                      {contentType === 'embed_url' && (
                        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#374151', marginBottom: '4px' }}>
                            Page / Embed URL (Internal or External):
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. https://zolofunds.com/#pricing or /pricing"
                            value={embedUrl}
                            onChange={(e) => setEmbedUrl(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '0.86rem' }}
                          />
                          <p style={{ fontSize: '0.72rem', color: '#6B7280', margin: '4px 0 0 0' }}>
                            Embedded directly inside the announcement modal / page with responsive viewport and open-in-tab fallback.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Link & Expiry */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#374151', marginBottom: '4px' }}>
                        Button Label (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Learn More"
                        value={actionLabel}
                        onChange={(e) => setActionLabel(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '0.84rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#374151', marginBottom: '4px' }}>
                        Button URL (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. /portal/billing or https://..."
                        value={actionUrl}
                        onChange={(e) => setActionUrl(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '0.84rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#374151', marginBottom: '4px' }}>
                      Auto-Expiration Date (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #D1D5DB', fontSize: '0.84rem' }}
                    />
                  </div>
                </div>

                {/* Right Column: Audience Targeting & Live Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Audience Targeting Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, color: '#374151', marginBottom: '8px' }}>
                      Target Audience Scope
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                      {[
                        { id: 'all', label: '🌍 All People' },
                        { id: 'role', label: '👥 By Role' },
                        { id: 'subscription', label: '💳 Subscription' },
                        { id: 'geo', label: '📍 Geography' },
                        { id: 'selected', label: '☑️ Selected' },
                        { id: 'single', label: '👤 Single User' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setTargetScope(item.id as any)}
                          style={{
                            padding: '9px 8px',
                            borderRadius: '10px',
                            border: targetScope === item.id ? '2px solid var(--brand-purple, #7D287E)' : '1px solid #D1D5DB',
                            backgroundColor: targetScope === item.id ? 'var(--brand-purple-light, #F9F1FA)' : '#FFFFFF',
                            color: targetScope === item.id ? 'var(--brand-purple, #7D287E)' : '#374151',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Scope specific settings */}
                    {targetScope === 'role' && (
                      <div style={{ backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
                          Select Role:
                        </label>
                        <select
                          value={targetRole}
                          onChange={(e) => setTargetRole(e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.86rem', fontWeight: 600 }}
                        >
                          <option value="agent">Collection Agents Only</option>
                          <option value="admin">Branch Admins Only</option>
                          <option value="superadmin">Company Owners (Superadmins) Only</option>
                          <option value="developer">Developers Only</option>
                        </select>
                      </div>
                    )}

                    {targetScope === 'subscription' && (
                      <div style={{ backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
                          Subscription Tier:
                        </label>
                        <select
                          value={targetSubscription}
                          onChange={(e) => setTargetSubscription(e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.86rem', fontWeight: 600 }}
                        >
                          <option value="free">Free Forever Tier</option>
                          <option value="basic">Basic Plan (₹799/mo)</option>
                          <option value="business">Business Plan (₹1,499/mo)</option>
                          <option value="enterprise">Enterprise Plan (₹2,999/mo)</option>
                          <option value="yearly">All Annual Billing Customers</option>
                          <option value="monthly">All Monthly Billing Customers</option>
                        </select>
                      </div>
                    )}

                    {targetScope === 'geo' && (
                      <div style={{ backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
                          Geographic Query (State, City, or District):
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Tamil Nadu, Chennai, Coimbatore"
                          value={targetGeo}
                          onChange={(e) => setTargetGeo(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.86rem' }}
                        />
                        <div style={{ fontSize: '0.74rem', color: '#6B7280', marginTop: '4px' }}>
                          Matches branch addresses and region tags.
                        </div>
                      </div>
                    )}

                    {targetScope === 'single' && (
                      <div style={{ backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
                          Choose Particular User:
                        </label>
                        <select
                          value={singleUserId}
                          onChange={(e) => setSingleUserId(e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.86rem', fontWeight: 600 }}
                        >
                          <option value="">Select a user...</option>
                          {directory.users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} (@{u.username}) • {u.role}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {targetScope === 'selected' && (
                      <div style={{ backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#374151' }}>
                            Select Recipients ({selectedUserIds.length} Selected)
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedUserIds(filteredDirectoryUsers.map((u) => u.id))}
                              style={{ background: 'none', border: 'none', color: 'var(--brand-purple, #7D287E)', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Select All
                            </button>
                            <span style={{ color: '#D1D5DB' }}>|</span>
                            <button
                              type="button"
                              onClick={() => setSelectedUserIds([])}
                              style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {/* Search and Role Filter */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input
                            type="text"
                            placeholder="Filter users..."
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.78rem' }}
                          />
                          <select
                            value={userRoleFilter}
                            onChange={(e) => setUserRoleFilter(e.target.value)}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.78rem' }}
                          >
                            <option value="all">All Roles</option>
                            <option value="agent">Agents</option>
                            <option value="admin">Admins</option>
                            <option value="superadmin">Superadmins</option>
                          </select>
                        </div>

                        {/* Checklist box */}
                        <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#FFFFFF', padding: '6px' }}>
                          {filteredDirectoryUsers.map((u) => {
                            const isChecked = selectedUserIds.includes(u.id);
                            return (
                              <label
                                key={u.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: isChecked ? 'var(--brand-purple-light, #F9F1FA)' : 'transparent',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUserIds([...selectedUserIds, u.id]);
                                    } else {
                                      setSelectedUserIds(selectedUserIds.filter((id) => id !== u.id));
                                    }
                                  }}
                                  style={{ accentColor: 'var(--brand-purple, #7D287E)' }}
                                />
                                <span style={{ fontWeight: 700, color: '#111827' }}>{u.name}</span>
                                <span style={{ color: '#6B7280', fontSize: '0.74rem' }}>({u.role})</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '8px', fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-purple, #7D287E)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                        group
                      </span>
                      <span>Targeting ~{estimatedTargetCount} users</span>
                    </div>
                  </div>

                  {/* Interactive Live Preview Box */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#374151' }}>
                        Live Interactive Preview
                      </span>
                      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#E5E7EB', padding: '2px', borderRadius: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewMode('popup')}
                          style={{
                            padding: '3px 9px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            backgroundColor: previewMode === 'popup' ? '#FFFFFF' : 'transparent',
                            color: previewMode === 'popup' ? '#111827' : '#6B7280',
                          }}
                        >
                          Popup View
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewMode('scrolling')}
                          style={{
                            padding: '3px 9px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            backgroundColor: previewMode === 'scrolling' ? '#FFFFFF' : 'transparent',
                            color: previewMode === 'scrolling' ? '#111827' : '#6B7280',
                          }}
                        >
                          Top Bar View
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: '#1E1B2E',
                        borderRadius: '14px',
                        padding: '16px',
                        minHeight: '160px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {previewMode === 'scrolling' ? (
                        <div
                          style={{
                            width: '100%',
                            backgroundColor: '#2A2438',
                            color: '#FFFFFF',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.15)',
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: 'var(--brand-purple, #7D287E)',
                              color: '#FFFFFF',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 800,
                              fontSize: '0.68rem',
                            }}
                          >
                            {type.toUpperCase()}
                          </span>
                          <span style={{ fontWeight: 700 }}>{title || 'Announcement Title'}</span>:
                          <span style={{ opacity: 0.85, whiteSpace: 'nowrap' }}>
                            {message ? `${message.slice(0, 45)}...` : 'Announcement body text appears here...'}
                          </span>
                        </div>
                      ) : (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontSize: '0.70rem', color: '#9CA3AF', fontWeight: 700, alignSelf: 'flex-start' }}>
                            Previewing layout: <span style={{ color: '#FCF6AB' }}>{popupStyle === 'box_75' ? '75% Screen Box Popup' : popupStyle === 'full_page' ? 'Full Page Takeover' : 'Standard Dialog'}</span>
                          </div>
                          {contentType === 'template' ? (
                            <div style={{ width: '100%', maxHeight: '300px', overflowY: 'auto', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)' }}>
                              {templateId === 'festival' && <FestivalOfferPage announcement={{ title: title || 'Festival Mega Offer', message: message || 'Special interest rate rebate on festival loans.', type, priority, actionLabel, actionUrl } as any} />}
                              {templateId === 'showcase' && <FeatureShowcasePage announcement={{ title: title || 'What’s New in Zolo Funds', message: message || 'Explore newly shipped workflow automations.', type, priority, actionLabel, actionUrl } as any} />}
                              {templateId === 'compliance' && <ComplianceNoticePage announcement={{ title: title || 'Regulatory Compliance Notice', message: message || 'Updated RBI KYC and lending disclosures.', type, priority, actionLabel, actionUrl } as any} />}
                              {templateId === 'maintenance' && <MaintenanceDowntimePage announcement={{ title: title || 'Scheduled Platform Maintenance', message: message || 'Database upgrade window tonight.', type, priority, actionLabel, actionUrl } as any} />}
                            </div>
                          ) : contentType === 'custom_html' || contentType === 'embed_url' ? (
                            <div style={{ width: '100%', maxHeight: '300px', overflowY: 'auto', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)' }}>
                              <CustomEmbedPage announcement={{ title, message, customHtml, embedUrl, contentType, type, priority, actionLabel, actionUrl } as any} />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                maxWidth: '340px',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                              }}
                            >
                              <div
                                style={{
                                  background: 'var(--brand-purple, #7D287E)',
                                  color: '#FFFFFF',
                                  padding: '10px 14px',
                                  fontWeight: 800,
                                  fontSize: '0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                                    campaign
                                  </span>
                                  <span>{title || 'Announcement Title'}</span>
                                </div>
                                <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(255,255,255,0.25)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {popupStyle === 'box_75' ? '75% Box' : popupStyle === 'full_page' ? 'Full Page' : 'Dialog'}
                                </span>
                              </div>
                              <div style={{ padding: '12px', fontSize: '0.78rem', color: '#4B5563', lineHeight: 1.4 }}>
                                {message || 'Announcement message preview...'}
                              </div>
                              <div style={{ padding: '8px 12px', backgroundColor: '#F9FAFB', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                {actionLabel && (
                                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563EB' }}>
                                    [{actionLabel}]
                                  </span>
                                )}
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-purple, #7D287E)' }}>
                                  [Acknowledge Button]
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '18px 28px',
                borderTop: '1.5px solid #E5E7EB',
                backgroundColor: '#F9FAFB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                disabled={submitting}
                className="btn btn-secondary"
                style={{ padding: '10px 20px', fontSize: '0.88rem' }}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSubmitAnnouncement('draft')}
                  disabled={submitting}
                  className="btn btn-secondary"
                  style={{ padding: '10px 20px', fontSize: '0.88rem' }}
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitAnnouncement('published')}
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 24px',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    backgroundColor: 'var(--brand-purple, #7D287E)',
                    color: '#FFFFFF',
                  }}
                >
                  {submitting ? 'Publishing...' : '🚀 Publish Announcement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECIPIENT ANALYTICS BREAKDOWN MODAL */}
      {selectedAnnouncementForRecipients && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(17, 24, 39, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedAnnouncementForRecipients(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1.5px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#111827', margin: 0 }}>
                  Recipients & Delivery Stats
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: '2px' }}>
                  {selectedAnnouncementForRecipients.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncementForRecipients(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '24px' }}>
                  close
                </span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: '8px' }}>
              {(['all', 'read', 'unread'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setRecipientFilter(f)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: recipientFilter === f ? 'var(--brand-purple, #7D287E)' : '#F3F4F6',
                    color: recipientFilter === f ? '#FFFFFF' : '#4B5563',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Recipients List */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              {loadingRecipients ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                  Loading recipient receipts...
                </div>
              ) : recipientsList.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                  No recipients recorded for this announcement yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recipientsList
                    .filter((r) => {
                      if (recipientFilter === 'read') return r.isRead;
                      if (recipientFilter === 'unread') return !r.isRead;
                      return true;
                    })
                    .map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          backgroundColor: '#F9FAFB',
                          border: '1px solid #E5E7EB',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, color: '#111827', fontSize: '0.88rem' }}>
                            {r.user?.name || 'Unknown User'}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#6B7280' }}>
                            @{r.user?.username} • Role: {r.user?.role}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          {r.isRead ? (
                            <span
                              style={{
                                color: '#059669',
                                fontSize: '0.76rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '15px' }}>
                                done_all
                              </span>
                              Read {r.readAt ? new Date(r.readAt).toLocaleDateString() : ''}
                            </span>
                          ) : (
                            <span style={{ color: '#9CA3AF', fontSize: '0.76rem', fontWeight: 700 }}>
                              Delivered (Unread)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setSelectedAnnouncementForRecipients(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 18px', fontSize: '0.84rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
