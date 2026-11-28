'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PDF_LANGUAGES } from '@/lib/reports/pdfLanguages';

interface ChitPdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  previewUrl: string;
  downloadUrl: string;
  title: string;
  pdfLang?: string;
  onChangePdfLang?: (lang: string) => void;
}

export default function ChitPdfPreviewModal({
  open,
  onClose,
  previewUrl,
  downloadUrl,
  title,
  pdfLang,
  onChangePdfLang,
}: ChitPdfPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
  }, [open, previewUrl]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: 'min(1040px, 96vw)',
          height: 'min(90vh, 920px)',
          background: 'var(--surface, #ffffff)',
          color: 'var(--text, #0f172a)',
          border: '1px solid var(--border, #cbd5e1)',
          borderRadius: '14px',
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border, #cbd5e1)',
            background: 'var(--bg, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>
              picture_as_pdf
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text, #0f172a)' }}>
                {title}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                Preview report pages before downloading
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {typeof pdfLang === 'string' && onChangePdfLang && (
              <select
                aria-label="Preview PDF Language"
                className="form-control"
                style={{
                  width: 'auto',
                  minWidth: '130px',
                  height: '34px',
                  padding: '4px 10px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
                value={pdfLang}
                onChange={(e) => onChangePdfLang(e.target.value)}
              >
                {PDF_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName}
                  </option>
                ))}
              </select>
            )}

            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              Open Tab
            </a>

            <a
              href={downloadUrl}
              download
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                download
              </span>
              Download PDF
            </a>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close PDF preview"
              className="btn btn-secondary btn-sm"
            >
              Close ✕
            </button>
          </div>
        </div>

        <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#525659' }}>
          {loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(15, 23, 42, 0.55)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.92rem',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              Generating PDF preview…
            </div>
          )}
          <iframe
            key={previewUrl}
            title={title}
            src={previewUrl}
            onLoad={() => setLoading(false)}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
