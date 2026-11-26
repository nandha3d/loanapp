'use client';

import { useState } from 'react';

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

  if (!text) return null;

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '4px',
        verticalAlign: 'middle',
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={title ? `${title}: ${text}` : text}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '15px',
          height: '15px',
          borderRadius: '999px',
          border: inverted ? '1px solid rgba(255,255,255,0.45)' : '1px solid #94a3b8',
          background: open ? '#0ea5e9' : inverted ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
          color: open || inverted ? '#ffffff' : '#475569',
          fontSize: '10px',
          fontWeight: 700,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
        }}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '235px',
            maxWidth: '75vw',
            padding: '7px 9px',
            borderRadius: '7px',
            background: '#0f172a',
            color: '#f8fafc',
            fontSize: '0.71rem',
            lineHeight: 1.38,
            fontWeight: 400,
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.28)',
            zIndex: 60,
            pointerEvents: 'none',
            whiteSpace: 'normal',
            textAlign: 'left',
          }}
        >
          {title && (
            <span style={{ display: 'block', fontWeight: 700, marginBottom: '2px', color: '#38bdf8' }}>
              {title}
            </span>
          )}
          {text}
        </span>
      )}
    </span>
  );
}
