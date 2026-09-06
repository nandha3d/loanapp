// Zero-JS accordion built on native <details>/<summary> — RSC-safe (no
// 'use client' needed), matches the server-component nature of pages that
// use it. Prefer this over a JS-driven accordion library.
export function Collapse({
  summary,
  badge,
  tone,
  defaultOpen,
  children,
}: {
  summary: string;
  badge?: number;
  tone?: 'default' | 'danger';
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} style={{ marginTop: '10px' }}>
      <summary
        style={{
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '0.88rem',
          color: '#334155',
          padding: '8px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          listStyle: 'none',
        }}
      >
        {summary}
        {badge != null && badge > 0 && (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '999px',
              background: tone === 'danger' ? '#fee2e2' : '#e2e8f0',
              color: tone === 'danger' ? '#991b1b' : '#475569',
            }}
          >
            {badge}
          </span>
        )}
      </summary>
      <div style={{ padding: '4px 4px 8px' }}>{children}</div>
    </details>
  );
}
