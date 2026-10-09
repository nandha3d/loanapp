'use client';

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, FileText, CheckCircle2, ArrowRight } from 'lucide-react';

interface ComplianceNoticeProps {
  title?: string;
  message?: string;
  circularRef?: string;
  effectiveDate?: string;
  actionLabel?: string;
  actionUrl?: string;
  onAction?: () => void;
}

export default function ComplianceNoticePage({
  title = "Statutory Regulatory Advisory: RBI Fair Practices & Digital Lending Guidelines",
  message = "Please ensure all field collection schedules, moratorium protocols, and electronic collection receipts comply with the latest regulatory guidelines effective this quarter.",
  circularRef = "RBI/2026/DOR-FPC.14",
  effectiveDate = "Effective immediately across all lending branches",
  actionLabel = "Acknowledge & View Guidelines",
  actionUrl = "/settings/compliance",
  onAction,
}: ComplianceNoticeProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="w-full rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/60 p-6 sm:p-10 shadow-2xl relative overflow-hidden text-slate-800 dark:text-slate-100">
      {/* Top Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-400 dark:border-amber-600">
          <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-300" />
          <span>Statutory Compliance Notice</span>
        </div>
        <div className="text-xs font-mono font-medium text-amber-800 dark:text-amber-300">
          Ref: {circularRef}
        </div>
      </div>

      {/* Main Notice */}
      <div className="max-w-3xl mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
          {title}
        </h1>
        <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
          {message}
        </p>
      </div>

      {/* Checklist / Requirements */}
      <div className="p-5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800/50 mb-8 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-400 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Mandatory Compliance Checklist
        </h4>
        <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>Every recovery transaction must generate an instant verifiable digital receipt.</span>
        </div>
        <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>Field collection visits are strictly permissible between 08:00 AM and 07:00 PM IST only.</span>
        </div>
        <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>All borrower grievances must log a system tracking ticket within 24 hours.</span>
        </div>
      </div>

      {/* Acknowledgment & Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-amber-200 dark:border-amber-800/40">
        <label className="flex items-center gap-3 cursor-pointer text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
          />
          <span>I have reviewed these operational guidelines for my branch</span>
        </label>

        <button
          onClick={onAction}
          disabled={!acknowledged}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            acknowledged
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
              : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
