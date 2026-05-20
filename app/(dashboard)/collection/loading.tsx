export default function CollectionLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div className="skeleton" style={{ width: '220px', height: '32px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ width: '150px', height: '18px' }} />
        </div>
        <div className="skeleton" style={{ width: '160px', height: '40px', borderRadius: '8px' }} />
      </div>

      {/* Tabs Skeleton */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
        <div className="skeleton" style={{ width: '180px', height: '36px', borderRadius: '6px' }} />
        <div className="skeleton" style={{ width: '160px', height: '36px', borderRadius: '6px' }} />
      </div>

      {/* Filter Bar Skeleton */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div className="skeleton" style={{ flex: '1 1 300px', height: '40px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ width: '150px', height: '40px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ width: '150px', height: '40px', borderRadius: '8px' }} />
      </div>

      {/* List / Cards Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-card skeleton" style={{ height: '76px', borderRadius: '12px', display: 'flex', alignItems: 'center', padding: '0 16px', justifyContent: 'space-between', marginBottom: '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
              <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#CBD5E1' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '180px', height: '16px', marginBottom: '8px', background: '#CBD5E1' }} />
                <div className="skeleton" style={{ width: '100px', height: '12px', background: '#CBD5E1' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ textAlign: 'right' }}>
                <div className="skeleton" style={{ width: '60px', height: '12px', marginBottom: '6px', background: '#CBD5E1' }} />
                <div className="skeleton" style={{ width: '80px', height: '16px', background: '#CBD5E1' }} />
              </div>
              <div className="skeleton" style={{ width: '80px', height: '36px', borderRadius: '6px', background: '#CBD5E1' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
