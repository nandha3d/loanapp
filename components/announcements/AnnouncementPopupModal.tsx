'use client';

import React, { useState } from 'react';
import { AnnouncementItem } from './ScrollingAnnouncementBar';
import {
  FestivalOfferPage,
  FeatureShowcasePage,
  ComplianceNoticePage,
  MaintenanceDowntimePage,
  CustomEmbedPage,
} from './pages';
import { Sparkles, X, Check, ArrowRight, ExternalLink } from 'lucide-react';

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

  const popupStyle = announcement.popupStyle || 'box_75';
  const contentType = announcement.contentType || 'standard';
  const templateId = announcement.templateId;

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

  const handleAction = () => {
    if (announcement.actionUrl) {
      if (announcement.actionUrl.startsWith('http')) {
        window.open(announcement.actionUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = announcement.actionUrl;
      }
    }
    handleAcknowledge();
  };

  // Render Template Body if selected
  const renderContentBody = () => {
    if (templateId === 'festival_offer') {
      return (
        <FestivalOfferPage
          title={announcement.title}
          message={announcement.message}
          actionLabel={announcement.actionLabel || 'Claim Festive Offer'}
          actionUrl={announcement.actionUrl || undefined}
          onAction={handleAction}
        />
      );
    }

    if (templateId === 'feature_showcase') {
      return (
        <FeatureShowcasePage
          title={announcement.title}
          message={announcement.message}
          actionLabel={announcement.actionLabel || 'Explore Features'}
          actionUrl={announcement.actionUrl || undefined}
          onAction={handleAction}
        />
      );
    }

    if (templateId === 'compliance_notice') {
      return (
        <ComplianceNoticePage
          title={announcement.title}
          message={announcement.message}
          actionLabel={announcement.actionLabel || 'Acknowledge Guidelines'}
          actionUrl={announcement.actionUrl || undefined}
          onAction={handleAction}
        />
      );
    }

    if (templateId === 'maintenance_downtime') {
      return (
        <MaintenanceDowntimePage
          title={announcement.title}
          message={announcement.message}
          actionLabel={announcement.actionLabel || 'System Health Status'}
          actionUrl={announcement.actionUrl || undefined}
          onAction={handleAction}
        />
      );
    }

    if (contentType === 'custom_html' && announcement.customHtml) {
      return (
        <CustomEmbedPage
          title={announcement.title}
          customHtml={announcement.customHtml}
          actionLabel={announcement.actionLabel || undefined}
          onAction={handleAction}
        />
      );
    }

    if (contentType === 'embed_url' && announcement.embedUrl) {
      return (
        <CustomEmbedPage
          title={announcement.title}
          embedUrl={announcement.embedUrl}
          actionLabel={announcement.actionLabel || undefined}
          onAction={handleAction}
        />
      );
    }

    // Default Standard Layout
    return (
      <div className="p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-purple-100 text-[#7D287E] dark:bg-purple-950/80 dark:text-purple-300">
            {announcement.type}
          </span>
          <span className="text-xs text-slate-400">Official Announcement</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
          {announcement.title}
        </h2>

        <div className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
          {announcement.message}
        </div>

        {announcement.actionLabel && (
          <div className="pt-4 flex justify-end">
            <button
              onClick={handleAction}
              className="px-6 py-2.5 rounded-xl bg-[#7D287E] hover:bg-[#6A206B] text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all"
            >
              <span>{announcement.actionLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Full Page Takeover Style
  if (popupStyle === 'full_page') {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-xl overflow-y-auto flex flex-col">
        {/* Sticky Control Topbar */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#7D287E] flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400 block">Zolo Funds Platform Notice</span>
              <span className="text-sm font-semibold text-white truncate max-w-md block">{announcement.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="hidden sm:flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 text-purple-600"
              />
              <span>Don&apos;t show again</span>
            </label>

            <button
              onClick={handleAcknowledge}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition-all"
            >
              <span>Done</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 md:p-12">
          {renderContentBody()}
        </main>
      </div>
    );
  }

  // 75% Box Popup (or Standard) Modal
  const isBox75 = popupStyle === 'box_75';
  const containerClasses = isBox75
    ? 'w-[94vw] sm:w-[85vw] lg:w-[75vw] max-w-6xl h-[90vh] sm:h-[82vh] lg:h-[75vh] max-h-[88vh] rounded-3xl'
    : 'w-full max-w-xl max-h-[85vh] rounded-2xl';

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden relative ${containerClasses}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/20 shadow-md"
          title="Close announcement"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {renderContentBody()}
        </div>

        {/* Bottom Persistent Dismiss Bar */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-[#7D287E] focus:ring-purple-500"
            />
            <span className="font-medium">Do not display this announcement popup again</span>
          </label>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 font-semibold transition-colors"
            >
              Remind Later
            </button>
            <button
              onClick={handleAcknowledge}
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-[#7D287E] hover:bg-[#681E69] text-white font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Acknowledging...' : 'Acknowledge & Close'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
