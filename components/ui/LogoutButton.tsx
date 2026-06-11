'use client';

import { signOut } from 'next-auth/react';

export default function LogoutButton({ className = "btn btn-ghost btn-sm" }: { className?: string }) {
  return (
    <button
      className={className}
      title="Logout"
      onClick={async () => {
        // redirect:false + manual navigation keeps logout on the current domain
        // (custom tenant domains would otherwise bounce to the root SaaS host).
        await signOut({ redirect: false });
        window.location.href = '/login';
      }}
      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
    >
      <span className="material-icons-outlined" style={{ fontSize: '20px' }}>logout</span>
      <span style={{ fontSize: '0.85rem' }}>Logout</span>
    </button>
  );
}
