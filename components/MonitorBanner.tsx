import { auth } from '@/lib/auth';

export default async function MonitorBanner() {
  const session = await auth();
  
  if (!(session?.user as any)?.isMonitoring) {
    return null;
  }

  const targetName = (session?.user as any)?.monitorTargetName || 'Client';

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 9999,
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      color: '#ffffff',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      fontSize: '0.9rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="material-icons-outlined" style={{ fontSize: '20px', color: '#ffd700' }}>visibility</span>
        <strong>Monitor Mode Active</strong>
        <span style={{ opacity: 0.8 }}>| Viewing workflow as: <strong>{targetName}</strong></span>
      </div>
      <form action="/api/developer/monitor/exit" method="POST">
        <button
          type="submit"
          className="btn btn-sm"
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '4px 12px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>logout</span>
          Exit Monitor Mode
        </button>
      </form>
    </div>
  );
}
