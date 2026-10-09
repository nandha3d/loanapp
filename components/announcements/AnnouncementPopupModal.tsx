'use client';

import React, { useState } from 'react';
import { AnnouncementItem } from './ScrollingAnnouncementBar';

interface AnnouncementPopupModalProps {
  announcement: AnnouncementItem | null;
  onClose: () => void;
  onDismiss: (id: string) => Promise<void>;
}

export default function AnnouncementPopupModal({
  announcement,
  onClose,
  onDismiss,
}: AnnouncementPopupModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!announcement) return null;

  const getTypeTheme = (type: string) => {
    switch (type) {
      case 'critical':
        return {
          icon: 'error',
          headerBg: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
          iconColor: '#FEF2F2',
          badgeText: 'CRITICAL ANNOUNCEMENT',
          borderColor: '#F87171',
        };
      case 'warning':
        return {
          icon: 'warning',
          headerBg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
          iconColor: '#FFFBEB',
          badgeText: 'SYSTEM ADVISORY',
          borderColor: '#FBBF24',
        };
      case 'update':
        return {
          icon: 'rocket_launch',
          headerBg: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
          iconColor: '#EEF2FF',
          badgeText: 'FEATURE & PLATFORM UPDATE',
          borderColor: '#818CF8',
        };
      case 'celebration':
        return {
          icon: 'celebration',
          headerBg: 'linear-gradient(135deg, #A21CAF 0%, #701A75 100%)',
          iconColor: '#FDF4FF',
          badgeText: 'SPECIAL CELEBRATION',
          borderColor: '#E879F9',
        };
      default:
        return {
          icon: 'campaign',
          headerBg: 'linear-gradient(135deg, #7D287E 0%, #5A195B 100%)',
          iconColor: '#FDF2F8',
          badgeText: 'OFFICIAL ANNOUNCEMENT',
          borderColor: '#C084FC',
        };
    }
  };

  const theme = getTypeTheme(announcement.type);

  const handleAcknowledge = async () => {
    setSubmitting(true);
    try {
      if (dontShowAgain) {
        await onDismiss(announcement.id);
      }
      onClose();
    } catch (e) {
      console.error(e);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 15, 26, 0.75)',
        backdropFilter: 'blur(5px)',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'popupFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            background: theme.headerBg,
            padding: '24px 28px 20px 28px',
            color: '#FFFFFF',
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backdropFilter: 'blur(4px)',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '28px', color: theme.iconColor }}>
              {theme.icon}
            </span>
          </div>

          <div style={{ flex: 1, paddingRight: '24px' }}>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                opacity: 0.9,
                display: 'block',
                marginBottom: '4px',
              }}
            >
              {theme.badgeText}
            </span>
            <h3
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                margin: 0,
                lineHeight: 1.3,
                color: '#FFFFFF',
              }}
            >
              {announcement.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255,255,255,0.18)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            title="Close popup"
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
              close
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '26px 28px', flex: 1 }}>
          <div
            style={{
              fontSize: '0.94rem',
              color: '#374151',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              maxHeight: '320px',
              overflowY: 'auto',
              paddingRight: '6px',
            }}
          >
            {announcement.message}
          </div>

          {/* Action Link button if configured */}
          {announcement.actionLabel && announcement.actionUrl && (
            <div style={{ marginTop: '20px' }}>
              <a
                href={announcement.actionUrl}
                target={announcement.actionUrl.startsWith('http') ? '_blank' : '_self'}
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--brand-purple, #7D287E)',
                  color: '#FFFFFF',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(125, 40, 126, 0.25)',
                }}
              >
                <span>{announcement.actionLabel}</span>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                  arrow_forward
                </span>
              </a>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 28px 20px 28px',
            backgroundColor: '#F9FAFB',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            flexWrap: 'wrap',
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.82rem',
              color: '#6B7280',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                accentColor: 'var(--brand-purple, #7D287E)',
                cursor: 'pointer',
              }}
            />
            <span>Don&apos;t show this popup again</span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleAcknowledge}
              disabled={submitting}
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'var(--brand-purple, #7D287E)',
                color: '#FFFFFF',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'opacity 0.2s',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                check_circle
              </span>
              <span>{submitting ? 'Acknowledging...' : 'Acknowledge & Close'}</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes popupFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
