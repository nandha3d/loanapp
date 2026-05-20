'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';

export default function SubscriptionExpiredModal({ isExpired, role }: { isExpired: boolean; role: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isExpired) {
      setOpen(true);
    }
  }, [isExpired]);

  if (!isExpired) return null;

  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Subscription Expired">
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: '#fff3cd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px'
        }}>
          <span className="material-icons-outlined" style={{ fontSize: '40px', color: '#856404' }}>
            warning
          </span>
        </div>

        <h3 style={{ marginBottom: '12px', color: '#856404' }}>Your Subscription Has Expired</h3>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
          Your subscription has expired or been cancelled. You currently have <strong>read-only access</strong> to your data.
          To resume full operations — including creating new loans, collecting payments, and managing users — please renew your subscription.
        </p>

        <div style={{
          background: '#f8f9fa',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          textAlign: 'left'
        }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            <strong>What you can still do:</strong> View existing loans, customers, collections, and reports.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
            <strong>What is restricted:</strong> Creating new loans, recording payments, adding users, and making changes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {role === 'superadmin' && (
            <a href="/subscription" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Renew Subscription
            </a>
          )}
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>
            I Understand
          </button>
        </div>
      </div>
    </Modal>
  );
}
