'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function FieldHelpIcon({
  text,
  title,
  inverted = false,
}: {
  text: string;
  title?: string;
  inverted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placeAbove: boolean;
  }>({ top: 0, left: 0, placeAbove: true });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const updateCoords = useCallback(() => {
    if (!btnRef.current || typeof window === 'undefined') return;
    const rect = btnRef.current.getBoundingClientRect();
    const tooltipWidth = Math.min(310, window.innerWidth - 24);
    const half = tooltipWidth / 2;
    const rawCenter = rect.left + rect.width / 2;
    const clampedLeft = Math.max(
      12 + half,
      Math.min(window.innerWidth - 12 - half, rawCenter),
    );
    const placeAbove = rect.top > 180;
    setCoords({
      top: placeAbove ? rect.top - 10 : rect.bottom + 10,
      left: clampedLeft,
      placeAbove,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const onScrollOrResize = () => updateCoords();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!pinned) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (
        btnRef.current &&
        !btnRef.current.contains(target) &&
        (!tooltipRef.current || !tooltipRef.current.contains(target))
      ) {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [pinned]);

  if (!text) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '6px',
        verticalAlign: 'middle',
      }}
      onMouseEnter={() => {
        updateCoords();
        setOpen(true);
      }}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label={title ? `${title}: ${text}` : text}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          updateCoords();
          setPinned((wasPinned) => {
            const next = !wasPinned;
            setOpen(next);
            return next;
          });
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '21px',
          height: '21px',
          borderRadius: '999px',
          border: inverted
            ? '1.5px solid rgba(255,255,255,0.65)'
            : open
              ? '1.5px solid var(--primary-dark)'
              : '1.5px solid var(--primary-border)',
          background: open
            ? 'var(--primary)'
            : inverted
              ? 'rgba(255,255,255,0.22)'
              : 'var(--primary-light)',
          color: open || inverted ? '#ffffff' : 'var(--primary-dark)',
          fontSize: '12px',
          fontWeight: 800,
          fontStyle: 'italic',
          lineHeight: 1,
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          transition: 'all 0.14s ease',
        }}
      >
        i
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              transform: coords.placeAbove
                ? 'translate(-50%, -100%)'
                : 'translate(-50%, 0)',
              width: 'min(310px, calc(100vw - 24px))',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '0.88rem',
              lineHeight: 1.5,
              fontWeight: 500,
              boxShadow: '0 18px 36px -8px rgba(15, 23, 42, 0.28)',
              border: '1.5px solid var(--primary)',
              zIndex: 9999,
              pointerEvents: pinned ? 'auto' : 'none',
              whiteSpace: 'normal',
              textAlign: 'left',
            }}
          >
            {title && (
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '0.94rem',
                  marginBottom: '4px',
                  color: 'var(--primary-dark)',
                }}
              >
                {title}
              </div>
            )}
            <div>{text}</div>
          </div>,
          document.body,
        )}
    </span>
  );
}
