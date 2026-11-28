'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from '@/components/layout/DashboardLink';

const subscribeNoop = () => () => {};

export interface InlineAddPickerItem {
  id: string;
  label: string;
  subLabel?: string;
  count: number;
  badgeText?: string;
  disabled?: boolean;
}

interface InlineAddPickerProps {
  items: InlineAddPickerItem[];
  onIncrement: (id: string) => void;
  onDecrement?: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
  summaryText?: string;
  allowMultiple?: boolean;
  maxTotalReached?: boolean;
  onExceedMax?: (id: string) => void;
  footerAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  disabled?: boolean;
  compact?: boolean;
  ariaLabel?: string;
}

function getInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export default function InlineAddPicker({
  items,
  onIncrement,
  onDecrement,
  placeholder = 'Search & click + to add...',
  emptyText = 'No matching entries found.',
  summaryText,
  allowMultiple = true,
  maxTotalReached = false,
  onExceedMax,
  footerAction,
  disabled = false,
  compact = false,
  ariaLabel,
}: InlineAddPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuPortalRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isMounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [portalPos, setPortalPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxListHeight: number;
  }>({ top: 0, left: 0, width: 320, maxListHeight: 280 });

  const updatePortalPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(vw - 24, Math.max(rect.width, 320));
    const left = Math.max(12, Math.min(rect.left, vw - width - 12));
    const spaceBelow = vh - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const footerAllowance = 56;

    if (spaceBelow >= 210 || spaceBelow >= spaceAbove) {
      const top = Math.min(rect.bottom + 6, vh - 180);
      const maxListHeight = Math.max(140, Math.min(300, vh - top - footerAllowance - 16));
      setPortalPos({ top, left, width, maxListHeight });
    } else {
      const avail = Math.max(140, Math.min(300, spaceAbove - footerAllowance));
      const estimatedMenuH = avail + footerAllowance;
      const top = Math.max(12, rect.top - 6 - estimatedMenuH);
      setPortalPos({ top, left, width, maxListHeight: avail });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePortalPosition();
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = Boolean(containerRef.current && containerRef.current.contains(target));
      const inMenu = Boolean(menuPortalRef.current && menuPortalRef.current.contains(target));
      if (!inTrigger && !inMenu) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('resize', updatePortalPosition);
    window.addEventListener('scroll', updatePortalPosition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', updatePortalPosition);
      window.removeEventListener('scroll', updatePortalPosition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, updatePortalPosition]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = `${item.label} ${item.subLabel || ''} ${item.badgeText || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const addedTotal = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.count), 0),
    [items],
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: open ? '#FFFFFF' : '#F4F7FA',
          border: open ? '1.5px solid var(--primary)' : '1.5px solid #CBD5E1',
          borderRadius: '10px',
          padding: compact ? '4px 10px' : '6px 12px',
          minHeight: compact ? '36px' : '40px',
          boxShadow: open
            ? '0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent)'
            : 'inset 0 1px 2px rgba(15, 23, 42, 0.03)',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
        }}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <span
          className="material-icons-outlined"
          style={{ fontSize: '18px', color: open ? 'var(--primary)' : '#64748B', flexShrink: 0 }}
        >
          search
        </span>
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={query}
          aria-label={ariaLabel || placeholder}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: compact ? '.8rem' : '.85rem',
            color: '#0F172A',
            fontWeight: 500,
          }}
        />
        {query && (
          <button
            type="button"
            title="Clear search"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
              inputRef.current?.focus();
            }}
            style={{
              border: 'none',
              background: '#E2E8F0',
              color: '#475569',
              width: '20px',
              height: '20px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '.75rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        )}
        {(summaryText || addedTotal > 0) && (
          <span
            style={{
              fontSize: '.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '999px',
              background: addedTotal > 0 ? 'var(--primary-light)' : '#E2E8F0',
              color: addedTotal > 0 ? 'var(--primary-dark)' : '#475569',
              border: '1px solid var(--primary-border, #E2E8F0)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {summaryText || `${addedTotal} selected`}
          </span>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-label={open ? 'Close picker' : 'Open picker'}
          onClick={(e) => {
            e.stopPropagation();
            if (disabled) return;
            setOpen((prev) => !prev);
          }}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#64748B',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          <span
            className="material-icons-outlined"
            style={{
              fontSize: '19px',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          >
            expand_more
          </span>
        </button>
      </div>

      {open && !disabled && isMounted &&
        createPortal(
          <div
            ref={menuPortalRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: `${portalPos.top}px`,
              left: `${portalPos.left}px`,
              width: `${portalPos.width}px`,
              zIndex: 1500,
              backgroundColor: 'var(--surface)',
              color: 'var(--text)',
              border: '1.5px solid var(--border)',
              borderRadius: '12px',
              boxShadow: '0 18px 42px -6px rgba(15, 23, 42, 0.24), 0 6px 14px -2px rgba(15, 23, 42, 0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                maxHeight: `${portalPos.maxListHeight}px`,
                overflowY: 'auto',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {filteredItems.length === 0 ? (
                <div
                  style={{
                    padding: '18px 12px',
                    textAlign: 'center',
                    fontSize: '.82rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {emptyText}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isAdded = item.count > 0;
                  const canAddSlot = !item.disabled && (allowMultiple || item.count === 0);
                  const canAddWithinLimit = canAddSlot && !maxTotalReached;
                  const canTriggerExceed = canAddSlot && maxTotalReached && Boolean(onExceedMax);
                  const isClickable = canAddWithinLimit || canTriggerExceed;

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '7px 10px',
                        borderRadius: '9px',
                        backgroundColor: isAdded ? 'var(--primary-light)' : 'var(--bg)',
                        border: isAdded ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                        transition: 'background-color 0.12s ease, border-color 0.12s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '9px',
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            backgroundColor: isAdded ? 'var(--primary)' : 'var(--primary-light)',
                            color: isAdded ? '#FFFFFF' : 'var(--primary-dark)',
                            fontWeight: 700,
                            fontSize: '.72rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(item.label)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '.83rem',
                              fontWeight: 600,
                              color: 'var(--text)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.label}
                          </div>
                          {(item.subLabel || item.badgeText) && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '.72rem',
                                color: 'var(--text-secondary)',
                                marginTop: '1px',
                              }}
                            >
                              {item.subLabel && <span>{item.subLabel}</span>}
                              {item.badgeText && (
                                <span
                                  style={{
                                    padding: '1px 6px',
                                    borderRadius: '999px',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text)',
                                    fontWeight: 600,
                                    fontSize: '.68rem',
                                  }}
                                >
                                  {item.badgeText}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          flexShrink: 0,
                        }}
                      >
                        {isAdded && (
                          <>
                            <span
                              style={{
                                padding: '2px 7px',
                                borderRadius: '999px',
                                backgroundColor: 'var(--success-bg)',
                                color: 'var(--success)',
                                fontSize: '.74rem',
                                fontWeight: 700,
                              }}
                            >
                              {allowMultiple ? `×${item.count}` : 'Added'}
                            </span>
                            {onDecrement && (
                              <button
                                type="button"
                                title="Remove one"
                                aria-label={`Remove ${item.label}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDecrement(item.id);
                                }}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border)',
                                  backgroundColor: 'var(--surface)',
                                  color: 'var(--text-secondary)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                }}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                                  remove
                                </span>
                              </button>
                            )}
                          </>
                        )}

                        <button
                          type="button"
                          disabled={!isClickable}
                          title={
                            maxTotalReached
                              ? canTriggerExceed
                                ? 'Member limit reached — click to warn or increase limit'
                                : 'Group capacity reached'
                              : allowMultiple
                                ? `Add +1 for ${item.label}`
                                : `Add ${item.label}`
                          }
                          aria-label={`Add ${item.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canAddWithinLimit) {
                              onIncrement(item.id);
                            } else if (canTriggerExceed) {
                              onExceedMax?.(item.id);
                            }
                          }}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: canAddWithinLimit
                              ? 'var(--primary)'
                              : canTriggerExceed
                                ? 'var(--warning)'
                                : 'var(--border)',
                            color: '#FFFFFF',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isClickable ? 'pointer' : 'not-allowed',
                            boxShadow: isClickable ? '0 2px 6px rgba(15,23,42,0.14)' : 'none',
                          }}
                        >
                          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                            add
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: 'var(--bg)',
                borderTop: '1px solid var(--border)',
              }}
            >
              {footerAction ? (
                footerAction.href ? (
                  <Link
                    href={footerAction.href}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 10px', fontSize: '.76rem' }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '15px' }}>person_add</span>
                    {footerAction.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 10px', fontSize: '.76rem' }}
                    onClick={footerAction.onClick}
                  >
                    {footerAction.label}
                  </button>
                )
              ) : (
                <span style={{ fontSize: '.74rem', color: 'var(--text-secondary)' }}>
                  Click <strong>+</strong> to add multiple times without closing
                </span>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ padding: '4px 12px', fontSize: '.76rem' }}
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
