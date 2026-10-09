'use client';

import React from 'react';
import { Wrench, Clock, AlertCircle, CheckCircle, PhoneCall, ArrowRight } from 'lucide-react';

interface MaintenanceProps {
  title?: string;
  message?: string;
  windowTime?: string;
  actionLabel?: string;
  actionUrl?: string;
  onAction?: () => void;
}

export default function MaintenanceDowntimePage({
  title = "Scheduled Database Optimization & Cloud Infrastructure Upgrade",
  message = "We will be executing a planned core banking database index maintenance. While web portal access will be briefly read-only, all field collections made offline on mobile apps will safely sync immediately upon completion.",
  windowTime = "Tonight · 02:00 AM – 03:30 AM IST",
  actionLabel = "System Health Dashboard",
  actionUrl = "/status",
  onAction,
}: MaintenanceProps) {
  const services = [
    { name: "Field Agent Offline Collection", status: "Operational (Offline Sync)", ok: true },
    { name: "Web Administration & Approvals", status: "Read-Only (30 mins)", ok: false },
    { name: "WhatsApp & SMS Notifications", status: "Queued & Auto-dispatched", ok: true },
    { name: "Automated Daily Day-Book Cron", status: "Reschedules to 04:00 AM", ok: true },
  ];

  return (
    <div className="w-full rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
      {/* Top Banner Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <Wrench className="w-4 h-4 text-amber-400" />
          <span>Scheduled Maintenance Notice</span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span>{windowTime}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
          {title}
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          {message}
        </p>
      </div>

      {/* Services Impact Table */}
      <div className="p-4 sm:p-5 rounded-xl bg-slate-800/60 border border-slate-700/60 mb-8">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Service Impact & Offline Redundancy
        </h4>
        <div className="space-y-2.5">
          {services.map((svc, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs sm:text-sm py-1.5 border-b border-slate-700/40 last:border-b-0">
              <span className="text-slate-300 font-medium">{svc.name}</span>
              <span className={`inline-flex items-center gap-1 font-semibold ${svc.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                {svc.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {svc.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Help & Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <PhoneCall className="w-4 h-4 text-purple-400" />
          <span>Need immediate assistance? Contact <strong className="text-slate-200">support@zolofunds.com</strong></span>
        </div>

        <button
          onClick={onAction}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2 border border-slate-600 transition-all"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
