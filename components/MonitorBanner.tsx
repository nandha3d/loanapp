import { auth } from '@/lib/auth';

export default async function MonitorBanner() {
  let session = null;
  try {
    session = await auth();
  } catch (error) {
    console.error('[MonitorBanner] Session verification failed:', error);
  }
  
  if (!(session?.user as any)?.isMonitoring) {
    return null;
  }

  const targetName = (session?.user as any)?.monitorTargetName || 'this account';

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 9999,
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      color: '#ffffff',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      fontSize: '0.92rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="material-icons-outlined" style={{ fontSize: '20px', color: '#ffd700' }}>visibility</span>
        <span style={{ opacity: 0.85 }}>You are inside</span>
        <strong style={{ fontSize: '1rem' }}>{targetName}</strong>
        <span style={{ opacity: 0.6, fontSize: '.8rem' }}>(developer view)</span>
      </div>
      <form action="/api/developer/monitor/exit" method="POST">
        <button
          type="submit"
          className="btn btn-sm"
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '5px 14px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 600,
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>logout</span>
          Exit to Admin
        </button>
      </form>
    </div>
  );
}
