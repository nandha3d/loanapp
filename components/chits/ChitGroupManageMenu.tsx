'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import { cancelChitGroupAction, deleteChitGroupAction } from '@/app/(dashboard)/[module]/chits/actions';

const subscribeNoop = () => () => {};

interface ChitGroupManageMenuProps {
  groupId: string;
  groupName: string;
  status: string;
  enrolledMembers: number;
  editHref: string;
  labels?: {
    actionsLabel?: string;
    editGroup?: string;
    cancelGroup?: string;
    deleteGroup?: string;
    cancelModalTitle?: string;
    cancelModalBody?: string;
    deleteModalTitle?: string;
    deleteModalBody?: string;
    confirmCancelBtn?: string;
    confirmDeleteBtn?: string;
    closeBtn?: string;
  };
}

export default function ChitGroupManageMenu({
  groupId,
  groupName,
  status,
  enrolledMembers,
  editHref,
  labels,
}: ChitGroupManageMenuProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isMounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'cancel' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(12, Math.min(rect.right - width, vw - width - 12));
    const top = Math.min(rect.bottom + 6, vh - 170);
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    updatePos();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, updatePos]);

  const handleConfirm = async () => {
    if (!confirmMode) return;
    setBusy(true);
    setError('');
    try {
      const res =
        confirmMode === 'cancel'
          ? await cancelChitGroupAction(groupId)
          : await deleteChitGroupAction(groupId);
      if (res && !res.ok) {
        setError(res.error || 'Action failed');
        setBusy(false);
        return;
      }
      setConfirmMode(null);
      setBusy(false);
      router.refresh();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message || 'Action failed');
      setBusy(false);
    }
  };

  const canCancel = status === 'draft' || status === 'active';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={labels?.actionsLabel || `Manage ${groupName}`}
        title={labels?.actionsLabel || `Manage ${groupName}`}
        onClick={() => setMenuOpen((v) => !v)}
        className="btn btn-secondary btn-sm"
        style={{
          padding: '6px 9px',
          minWidth: '34px',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span className="material-icons-outlined" style={{ fontSize: '17px' }}>
          more_vert
        </span>
      </button>

      {menuOpen &&
        isMounted &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              width: '200px',
              zIndex: 1500,
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: '12px',
              boxShadow: '0 18px 36px -8px rgba(15, 23, 42, 0.25)',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <Link
              href={editHref}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '0.84rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>
                edit
              </span>
              {labels?.editGroup || 'Edit Group'}
            </Link>

            {canCancel && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setError('');
                  setConfirmMode('cancel');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--warning)',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                  block
                </span>
                {labels?.cancelGroup || 'Cancel Group'}
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setError('');
                setConfirmMode('delete');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'var(--danger)',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                delete_outline
              </span>
              {labels?.deleteGroup || 'Delete Group'}
            </button>
          </div>,
          document.body,
        )}

      {confirmMode &&
        isMounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1550,
              background: 'rgba(15, 23, 42, 0.58)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={() => !busy && setConfirmMode(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '460px',
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                borderRadius: '18px',
                boxShadow: '0 24px 56px -12px rgba(15, 23, 42, 0.38)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: '16px 20px',
                  background: confirmMode === 'delete' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.08rem',
                    fontWeight: 800,
                    color: confirmMode === 'delete' ? 'var(--danger)' : 'var(--warning)',
                  }}
                >
                  {confirmMode === 'delete'
                    ? labels?.deleteModalTitle || `Delete "${groupName}"?`
                    : labels?.cancelModalTitle || `Cancel "${groupName}"?`}
                </h3>
              </div>

              <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text)', lineHeight: 1.5 }}>
                  {confirmMode === 'delete'
                    ? labels?.deleteModalBody ||
                      `This removes "${groupName}" from active chit lists. Groups with recorded payments or prize payouts cannot be deleted — cancel them instead to keep accounting intact.`
                    : labels?.cancelModalBody ||
                      `Cancelling "${groupName}" (${enrolledMembers} enrolled members) halts all upcoming pending auctions while preserving existing ledger history.`}
                </p>

                {error && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--danger-bg)',
                      border: '1px solid var(--danger)',
                      color: 'var(--danger)',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => setConfirmMode(null)}
                >
                  {labels?.closeBtn || 'Keep Group'}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${confirmMode === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                  disabled={busy}
                  onClick={() => void handleConfirm()}
                >
                  {busy
                    ? 'Processing…'
                    : confirmMode === 'delete'
                      ? labels?.confirmDeleteBtn || 'Delete Group'
                      : labels?.confirmCancelBtn || 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
