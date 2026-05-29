'use client';

import { signOut } from 'next-auth/react';

export default function LogoutButton({ className = "btn btn-ghost btn-sm" }: { className?: string }) {
  return (
    <button
      className={className}
      title="Logout"
      onClick={() => signOut({ callbackUrl: window.location.origin + '/login' })}
      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
    >
      <span className="material-icons-outlined" style={{ fontSize: '20px' }}>logout</span>
      <span style={{ fontSize: '0.85rem' }}>Logout</span>
    </button>
  );
}
