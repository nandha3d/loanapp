import React from 'react';
import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import {
  FestivalOfferPage,
  FeatureShowcasePage,
  ComplianceNoticePage,
  MaintenanceDowntimePage,
  CustomEmbedPage,
} from '@/components/announcements/pages';
import Link from 'next/link';
import { ArrowLeft, Calendar, Tag, ShieldCheck } from 'lucide-react';

interface AnnouncementPageProps {
  params: Promise<{ id: string }>;
}

export default async function DedicatedAnnouncementPage({ params }: AnnouncementPageProps) {
  const { id } = await params;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!announcement) {
    notFound();
  }

  const templateId = announcement.templateId;
  const contentType = announcement.contentType || 'standard';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-purple-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(announcement.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200">
              {announcement.type}
            </span>
          </div>
        </div>

        {/* Dynamic Render based on Template or Custom HTML */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
          {templateId === 'festival_offer' && (
            <FestivalOfferPage
              title={announcement.title}
              message={announcement.message}
              actionLabel={announcement.actionLabel || undefined}
              actionUrl={announcement.actionUrl || undefined}
            />
          )}

          {templateId === 'feature_showcase' && (
            <FeatureShowcasePage
              title={announcement.title}
              message={announcement.message}
              actionLabel={announcement.actionLabel || undefined}
              actionUrl={announcement.actionUrl || undefined}
            />
          )}

          {templateId === 'compliance_notice' && (
            <ComplianceNoticePage
              title={announcement.title}
              message={announcement.message}
              actionLabel={announcement.actionLabel || undefined}
              actionUrl={announcement.actionUrl || undefined}
            />
          )}

          {templateId === 'maintenance_downtime' && (
            <MaintenanceDowntimePage
              title={announcement.title}
              message={announcement.message}
              actionLabel={announcement.actionLabel || undefined}
              actionUrl={announcement.actionUrl || undefined}
            />
          )}

          {contentType === 'custom_html' && announcement.customHtml && (
            <CustomEmbedPage
              title={announcement.title}
              customHtml={announcement.customHtml}
              actionLabel={announcement.actionLabel || undefined}
            />
          )}

          {contentType === 'embed_url' && announcement.embedUrl && (
            <CustomEmbedPage
              title={announcement.title}
              embedUrl={announcement.embedUrl}
              actionLabel={announcement.actionLabel || undefined}
            />
          )}

          {contentType === 'standard' && !templateId && (
            <div className="p-8 sm:p-12 space-y-6">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
                {announcement.title}
              </h1>
              <div className="text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {announcement.message}
              </div>
              {announcement.actionLabel && announcement.actionUrl && (
                <div className="pt-4">
                  <a
                    href={announcement.actionUrl}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#7D287E] hover:bg-[#681E69] text-white font-bold text-sm shadow-md transition-all"
                  >
                    <span>{announcement.actionLabel}</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
