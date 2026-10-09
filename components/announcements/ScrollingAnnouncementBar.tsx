'use client';

import React, { useState } from 'react';

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  isScrollingBar: boolean;
  isPopup: boolean;
  popupStyle?: 'box_75' | 'full_page' | 'standard' | string;
  contentType?: 'standard' | 'template' | 'custom_html' | 'embed_url' | string;
  templateId?: string | null;
  customHtml?: string | null;
  embedUrl?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  createdAt: string;
}

interface ScrollingAnnouncementBarProps {
  announcements: AnnouncementItem[];
  onOpenDetails: (item: AnnouncementItem) => void;
}

export default function ScrollingAnnouncementBar({
  announcements,
  onOpenDetails,
}: ScrollingAnnouncementBarProps) {
  const [dismissedLocally, setDismissedLocally] = useState<Record<string, boolean>>({});

  const visibleList = announcements.filter((a) => !dismissedLocally[a.id]);
  if (visibleList.length === 0) return null;

  const current = visibleList[0];

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'critical':
        return {
          bg: 'linear-gradient(90deg, #7F1D1D 0%, #991B1B 50%, #B91C1C 100%)',
          text: '#FEF2F2',
          badgeBg: '#EF4444',
          badgeText: '#FFFFFF',
          icon: 'error',
          label: 'CRITICAL ALERT',
        };
      case 'warning':
        return {
          bg: 'linear-gradient(90deg, #78350F 0%, #92400E 50%, #B45309 100%)',
          text: '#FFFBEB',
          badgeBg: '#F59E0B',
          badgeText: '#78350F',
          icon: 'warning',
          label: 'ATTENTION',
        };
      case 'update':
        return {
          bg: 'linear-gradient(90deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)',
          text: '#EEF2FF',
          badgeBg: '#6366F1',
          badgeText: '#FFFFFF',
          icon: 'rocket_launch',
          label: 'SYSTEM UPDATE',
        };
      case 'celebration':
        return {
          bg: 'linear-gradient(90deg, #4A044E 0%, #701A75 50%, #86198F 100%)',
          text: '#FDF4FF',
          badgeBg: '#FCF6AB',
          badgeText: '#4D164E',
          icon: 'celebration',
          label: 'SPECIAL ANNOUNCEMENT',
        };
      default:
        return {
          bg: 'linear-gradient(90deg, #1A1A2E 0%, #2A2438 50%, #352F44 100%)',
          text: '#F8F9FA',
          badgeBg: '#7D287E',
          badgeText: '#FFFFFF',
          icon: 'campaign',
          label: 'ANNOUNCEMENT',
        };
    }
  };

  const style = getTypeStyle(current.type);

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9998,
        background: style.bg,
        color: style.text,
        boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
        fontSize: '0.86rem',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        height: '38px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Category Pill Tag */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 14px',
          background: 'rgba(0,0,0,0.25)',
          height: '100%',
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        <span
          style={{
            backgroundColor: style.badgeBg,
            color: style.badgeText,
            fontSize: '0.68rem',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '9999px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '13px' }}>
            {style.icon}
          </span>
          {style.label}
        </span>
      </div>

      {/* Marquee Ticker Container */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          position: 'relative',
          cursor: 'pointer',
        }}
        onClick={() => onOpenDetails(current)}
        title="Click to view full announcement details"
      >
        <div
          className="announcement-ticker-track"
          style={{
            display: 'inline-block',
            animation: 'marquee 28s linear infinite',
            paddingLeft: '100%',
          }}
        >
          <span style={{ fontWeight: 700, marginRight: '10px' }}>{current.title}:</span>
          <span style={{ opacity: 0.9 }}>{current.message}</span>
          {current.actionLabel && (
            <span
              style={{
                marginLeft: '12px',
                textDecoration: 'underline',
                fontWeight: 700,
                color: '#FCF6AB',
              }}
            >
              [{current.actionLabel}]
            </span>
          )}
        </div>
      </div>

      {/* Action / Dismiss Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 12px',
          background: 'rgba(0,0,0,0.25)',
          height: '100%',
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        <button
          type="button"
          onClick={() => onOpenDetails(current)}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: '#FFFFFF',
            borderRadius: '4px',
            padding: '3px 9px',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <span>View</span>
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
            open_in_new
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDismissedLocally((prev) => ({ ...prev, [current.id]: true }));
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '50%',
          }}
          title="Dismiss top bar"
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
            close
          </span>
        </button>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(-100%, 0);
          }
        }
        .announcement-ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
