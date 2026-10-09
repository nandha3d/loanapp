'use client';

import React from 'react';
import { Zap, MapPin, MessageSquare, ShieldCheck, BarChart3, ArrowRight, CheckCircle2 } from 'lucide-react';

interface FeatureShowcaseProps {
  title?: string;
  message?: string;
  versionBadge?: string;
  actionLabel?: string;
  actionUrl?: string;
  onAction?: () => void;
}

export default function FeatureShowcasePage({
  title = "Major Update: Field Collection GPS & Live Agent Tracking is Live!",
  message = "Empower your recovery operations with tamper-proof geofenced collection receipts, real-time agent battery/location status, and automated route optimization.",
  versionBadge = "Zolo Funds Release · v2.5",
  actionLabel = "Explore New Features",
  actionUrl = "/reports",
  onAction,
}: FeatureShowcaseProps) {
  const features = [
    {
      icon: MapPin,
      title: "Geofenced Collections",
      desc: "Instantly stamps latitude, longitude, and accuracy radius on every cash collection receipt.",
      tag: "Zero Fraud"
    },
    {
      icon: MessageSquare,
      title: "Instant WhatsApp Slips",
      desc: "Borrowers receive official bilingual payment confirmations within 3 seconds of cash handover.",
      tag: "Automated"
    },
    {
      icon: ShieldCheck,
      title: "CRIF & CIBIL Check",
      desc: "One-click bureau score pulling directly during the loan application review.",
      tag: "Instant"
    },
    {
      icon: BarChart3,
      title: "Live Day-Book Audit",
      desc: "Real-time reconciliation of agent cash-in-hand against physical branch cash handovers.",
      tag: "Audited"
    }
  ];

  return (
    <div className="w-full rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 p-6 sm:p-10 shadow-2xl overflow-hidden relative">
      {/* Background Accent Gradients */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Badge */}
      <div className="flex items-center gap-2 mb-5 relative z-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
          <Zap className="w-3.5 h-3.5 text-purple-400" />
          {versionBadge}
        </span>
        <span className="text-xs text-slate-400">Available across Web & Mobile</span>
      </div>

      {/* Title & Description */}
      <div className="max-w-3xl mb-8 relative z-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
          {title}
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          {message}
        </p>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 relative z-10">
        {features.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <div
              key={idx}
              className="p-4 sm:p-5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-purple-500/40 hover:bg-slate-800 transition-all flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-white text-sm sm:text-base">{feat.title}</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-purple-300">
                    {feat.tag}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800 relative z-10">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Already activated for your tenant account with zero downtime</span>
        </div>

        <button
          onClick={onAction}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
