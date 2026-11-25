'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function JoinChitClient({
  groupCode,
  inviteToken,
}: {
  groupCode: string;
  inviteToken: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<any>(null);
  const [alreadySignedIn, setAlreadySignedIn] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/chits/invite?code=${encodeURIComponent(groupCode)}&invite=${encodeURIComponent(inviteToken)}`,
          { cache: 'no-store' },
        );
        const data = await res.json();
        if (!active) return;
        if (!res.ok) throw new Error(data.error || 'Invite link expired or invalid.');
        setGroup(data.group);
        setAlreadySignedIn(Boolean(data.alreadySignedInForTenant));
      } catch (err: any) {
        if (active) setError(err?.message || 'Unable to load chit invite');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [groupCode, inviteToken]);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('otp');
    setError('');
    try {
      const res = await fetch('/api/chits/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupCode, invite: inviteToken, action: 'request_otp', name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send OTP');
      setOtpRequested(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP');
    } finally {
      setBusy('');
    }
  };

  const verifyAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('join');
    setError('');
    try {
      const res = await fetch('/api/chits/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupCode, invite: inviteToken, action: 'verify_and_join', name, phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not verify OTP');
      router.push(data.redirectUrl);
    } catch (err: any) {
      setError(err?.message || 'Verification failed');
    } finally {
      setBusy('');
    }
  };

  const joinExistingSession = async () => {
    setBusy('session');
    setError('');
    try {
      const res = await fetch('/api/chits/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupCode, invite: inviteToken, action: 'session_join' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not join group');
      router.push(data.redirectUrl);
    } catch (err: any) {
      setError(err?.message || 'Could not join group');
    } finally {
      setBusy('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #3b0764 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '460px', background: '#fff', borderRadius: '18px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.28)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Loading WhatsApp group invite…</div>
        ) : !group ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <h2 style={{ margin: '0 0 8px', color: '#991b1b' }}>Invite Link Unavailable</h2>
            <p style={{ color: '#475569', fontSize: '0.9rem' }}>{error || 'Ask your chit organizer for a fresh WhatsApp invite link.'}</p>
            <Link href="/borrower/login" style={{ display: 'inline-block', marginTop: '12px', padding: '9px 18px', borderRadius: '10px', background: '#7D287E', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
              Member Login
            </Link>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7D287E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {group.tenantName} · Chit Invite
            </div>
            <h1 style={{ margin: '4px 0 6px', fontSize: '1.35rem', color: '#0f172a' }}>{group.name}</h1>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '16px' }}>
              {group.engineLabel} · Group #{group.groupCode}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '18px', fontSize: '0.82rem' }}>
              <div><span style={{ color: '#64748b' }}>Chit Value</span><br /><strong>{formatCurrency(group.chitValue, '₹')}</strong></div>
              <div><span style={{ color: '#64748b' }}>Installment</span><br /><strong>{formatCurrency(group.monthlyContrib, '₹')} / {group.frequency}</strong></div>
              <div><span style={{ color: '#64748b' }}>Enrolled</span><br /><strong>{group.enrolledCount} / {group.totalMembers}</strong></div>
              <div><span style={{ color: '#64748b' }}>Open Slots</span><br /><strong style={{ color: group.availableSlots > 0 ? '#166534' : '#b91c1c' }}>{group.availableSlots} left</strong></div>
            </div>

            {group.nextAuction && (
              <div style={{ marginBottom: '16px', padding: '8px 12px', borderRadius: '8px', background: '#f5f3ff', color: '#5b21b6', fontSize: '0.8rem' }}>
                Next Cycle: Period {group.nextAuction.periodNumber} · {formatDate(group.nextAuction.date)}
              </div>
            )}

            {error && (
              <div style={{ marginBottom: '12px', padding: '9px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.82rem' }}>
                {error}
              </div>
            )}

            {alreadySignedIn && (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={joinExistingSession}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer', marginBottom: '14px' }}
              >
                {busy === 'session' ? 'Joining…' : '✅ Continue & Open Chit Chat Room →'}
              </button>
            )}

            {!otpRequested ? (
              <form onSubmit={requestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  required
                  placeholder="Your Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
                <input
                  type="tel"
                  required
                  placeholder="WhatsApp Mobile Number (e.g. 9876543210)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
                <button
                  type="submit"
                  disabled={Boolean(busy)}
                  style={{ padding: '11px', borderRadius: '10px', border: 'none', background: '#7D287E', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  {busy === 'otp' ? 'Sending OTP…' : '📲 Verify WhatsApp Number & Join'}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyAndJoin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  Enter the 6-digit OTP sent to <strong>{phone}</strong>
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1.05rem', letterSpacing: '0.2em', textAlign: 'center', fontWeight: 700 }}
                />
                <button
                  type="submit"
                  disabled={Boolean(busy)}
                  style={{ padding: '11px', borderRadius: '10px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  {busy === 'join' ? 'Enrolling…' : '✅ Confirm & Enter Group Chat Room →'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
