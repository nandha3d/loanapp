'use client';

import React, { useState } from 'react';
import { Sparkles, Gift, Tag, Check, ArrowRight, Clock, Star, Flame } from 'lucide-react';

interface FestivalOfferProps {
  title?: string;
  message?: string;
  couponCode?: string;
  discountBadge?: string;
  validUntil?: string;
  actionLabel?: string;
  actionUrl?: string;
  onAction?: () => void;
}

export default function FestivalOfferPage({
  title = 'Festive Celebration Exclusive: 0% Processing Fee & Double Rewards!',
  message = 'Celebrate this festive season with elevated lending limits and zero processing charges on all new daily and microfinance disbursements.',
  couponCode = 'FESTIVEZOLO2026',
  discountBadge = 'Special Festive Bonanza · Limited Time',
  validUntil = 'Valid until Sunday midnight',
  actionLabel = 'Claim Festive Offer Now',
  actionUrl = '/checkout',
  onAction,
}: FestivalOfferProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (couponCode) {
      navigator.clipboard?.writeText(couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#4A124B] via-[#7D287E] to-[#2E0830] text-white p-6 sm:p-10 md:p-12 shadow-2xl">
      {/* Decorative Golden Ambient Glows */}
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#FCF6AB]/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />

      {/* Top Banner Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FCF6AB]/20 border border-[#FCF6AB]/40 text-[#FCF6AB] text-xs sm:text-sm font-semibold tracking-wide backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-[#FCF6AB] animate-pulse" />
          <span>{discountBadge}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs text-[#FCF6AB]/90 font-medium">
          <Clock className="w-3.5 h-3.5" />
          <span>{validUntil}</span>
        </div>
      </div>

      {/* Hero Content */}
      <div className="max-w-3xl relative z-10">
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-white mb-4">
          {title}
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-purple-100/90 leading-relaxed mb-8">
          {message}
        </p>
      </div>

      {/* Offer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 relative z-10">
        <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 hover:border-[#FCF6AB]/50 transition-all">
          <div className="w-10 h-10 rounded-lg bg-[#FCF6AB]/25 flex items-center justify-center text-[#FCF6AB] mb-3">
            <Gift className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-white text-base mb-1">0% Processing Fee</h4>
          <p className="text-xs text-purple-200">Save up to ₹2,500 on all new loan onboarding and disbursals.</p>
        </div>

        <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 hover:border-[#FCF6AB]/50 transition-all">
          <div className="w-10 h-10 rounded-lg bg-[#FCF6AB]/25 flex items-center justify-center text-[#FCF6AB] mb-3">
            <Flame className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-white text-base mb-1">Extended Limits</h4>
          <p className="text-xs text-purple-200">Pre-approved +25% active borrower capacity across all branches.</p>
        </div>

        <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 hover:border-[#FCF6AB]/50 transition-all">
          <div className="w-10 h-10 rounded-lg bg-[#FCF6AB]/25 flex items-center justify-center text-[#FCF6AB] mb-3">
            <Star className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-white text-base mb-1">Priority Support</h4>
          <p className="text-xs text-purple-200">Direct dedicated WhatsApp manager for high-volume collection days.</p>
        </div>
      </div>

      {/* Coupon Code Strip & CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-xl bg-black/30 border border-[#FCF6AB]/30 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="px-3 py-1.5 rounded-lg bg-[#FCF6AB]/20 border border-[#FCF6AB]/40 text-[#FCF6AB] text-xs font-mono font-bold tracking-wider flex items-center gap-2">
            <Tag className="w-3.5 h-3.5" />
            <span>{couponCode}</span>
          </div>
          <button
            onClick={handleCopy}
            className="text-xs text-white/90 hover:text-white underline underline-offset-4 flex items-center gap-1 font-medium transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              'Copy Coupon'
            )}
          </button>
        </div>

        <button
          onClick={onAction}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#FCF6AB] hover:bg-[#FFFAC2] text-[#4A124B] font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg hover:shadow-xl shadow-[#FCF6AB]/20 transition-all transform hover:-translate-y-0.5"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
