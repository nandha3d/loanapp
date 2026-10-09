'use client';

import React, { useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, Loader2, Globe } from 'lucide-react';

interface CustomEmbedPageProps {
  title?: string;
  embedUrl?: string;
  customHtml?: string;
  actionLabel?: string;
  actionUrl?: string;
  onAction?: () => void;
}

export default function CustomEmbedPage({
  title,
  embedUrl,
  customHtml,
  actionLabel,
  actionUrl,
  onAction,
}: CustomEmbedPageProps) {
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  // If raw HTML is provided
  if (customHtml) {
    return (
      <div className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 sm:p-8">
        {title && (
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            {title}
          </h2>
        )}
        <div
          className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
          dangerouslySetInnerHTML={{ __html: customHtml }}
        />
        {actionLabel && (
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={onAction}
              className="px-6 py-2.5 rounded-xl bg-[#7D287E] hover:bg-[#681E69] text-white font-bold text-sm shadow-md transition-all"
            >
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    );
  }

  // If Embed URL / iFrame is provided
  if (embedUrl) {
    return (
      <div
        className={`w-full rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          fullscreen ? 'fixed inset-4 z-50 rounded-2xl' : 'h-[650px] max-h-[75vh]'
        }`}
      >
        {/* Chrome Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 select-none">
          <div className="flex items-center gap-2 truncate max-w-[70%]">
            <Globe className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="font-mono truncate">{embedUrl}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFullscreen(!fullscreen)}
              title={fullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Iframe Viewport */}
        <div className="relative flex-1 w-full bg-white">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-400 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-2" />
              <p className="text-xs">Loading embedded announcement page...</p>
            </div>
          )}

          <iframe
            src={embedUrl}
            title={title || 'Embedded Announcement'}
            onLoad={() => setLoading(false)}
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      </div>
    );
  }

  return null;
}
