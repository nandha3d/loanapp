'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function ReferralRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);

  useEffect(() => {
    if (resolvedParams?.code) {
      // Set attribution cookie that expires in 30 days
      const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
      document.cookie = `ref_code=${resolvedParams.code}; path=/; max-age=${maxAge}; SameSite=Lax`;
      
      // Also backup to localStorage
      localStorage.setItem('ref_code', resolvedParams.code);

      // Instantly redirect to the main register page
      router.push(`/register?ref=${resolvedParams.code}`);
    } else {
      router.push('/register');
    }
  }, [resolvedParams, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F0F1A 0%, #1A1A2E 100%)',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        padding: '40px',
        borderRadius: '24px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        maxWidth: '450px',
        width: '100%',
      }}>
        {/* Animated logo/spinner */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #E94560 0%, #FF6B8B 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 8px 24px rgba(233, 69, 96, 0.3)',
          animation: 'pulse 2s infinite'
        }}>
          <span style={{ fontSize: '32px' }}>🚀</span>
        </div>

        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          marginBottom: '12px',
          background: 'linear-gradient(to right, #fff, #bbb)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Welcome to ZoloFund
        </h1>
        <p style={{
          fontSize: '0.9rem',
          color: 'rgba(255, 255, 255, 0.6)',
          lineHeight: '1.6',
          margin: '0 0 24px'
        }}>
          Applying referral code <code style={{
            background: 'rgba(233, 69, 96, 0.15)',
            color: '#E94560',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: 600
          }}>{resolvedParams?.code}</code> to your business registration...
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          fontSize: '0.82rem',
          color: 'rgba(255, 255, 255, 0.4)'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#E94560',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          Redirecting securely...
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
