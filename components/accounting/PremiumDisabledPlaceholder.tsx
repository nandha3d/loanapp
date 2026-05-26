'use client';

export default function PremiumDisabledPlaceholder({ addOnKey }: { addOnKey: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '2rem',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          background: 'var(--card-bg, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 16,
          padding: '2.5rem 2rem',
          textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,.06)',
        }}
      >
        <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: '1rem' }}>💎</div>

        <h2
          style={{
            margin: '0 0 0.5rem',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary, #111)',
          }}
        >
          Premium Accounting
        </h2>

        <p
          style={{
            margin: '0 0 0.5rem',
            color: 'var(--text-secondary, #6b7280)',
            fontSize: '0.95rem',
            lineHeight: 1.6,
          }}
        >
          Full double-entry bookkeeping, statutory reports (P&amp;L, Balance Sheet, GSTR-3B, TDS),
          budget vs actual, bank reconciliation, Tally XML export, and more.
        </p>

        <p
          style={{
            margin: '0 0 1.75rem',
            color: 'var(--text-secondary, #6b7280)',
            fontSize: '0.88rem',
          }}
        >
          This add-on is not yet enabled for your account. Request access and the team will review
          and activate it for you.
        </p>

        <span
          style={{
            display: 'inline-block',
            marginBottom: '1.25rem',
            padding: '3px 10px',
            background: 'var(--badge-bg, #f3f4f6)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 999,
            fontSize: '0.72rem',
            fontFamily: 'monospace',
            color: 'var(--text-secondary, #6b7280)',
            letterSpacing: 0.5,
          }}
        >
          {addOnKey}
        </span>

        <div>
          <a
            href="module-requests"
            style={{
              display: 'inline-block',
              padding: '0.65rem 1.6rem',
              background: 'var(--primary, #2563eb)',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.92rem',
              transition: 'opacity .15s',
            }}
          >
            Request Access
          </a>
        </div>
      </div>
    </div>
  );
}
