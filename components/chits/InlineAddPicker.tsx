'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/layout/DashboardLink';

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

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

      {open && !disabled && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 70,
            backgroundColor: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '12px',
            boxShadow: '0 14px 32px -6px rgba(15, 23, 42, 0.18), 0 4px 10px -2px rgba(15, 23, 42, 0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              maxHeight: '280px',
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
                  color: '#64748B',
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
                      backgroundColor: isAdded ? '#F0FDF4' : '#F8FAFC',
                      border: isAdded ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
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
                          backgroundColor: isAdded ? '#DCFCE7' : 'var(--primary-light)',
                          color: isAdded ? '#15803D' : 'var(--primary-dark)',
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
                            color: '#0F172A',
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
                              color: '#64748B',
                              marginTop: '1px',
                            }}
                          >
                            {item.subLabel && <span>{item.subLabel}</span>}
                            {item.badgeText && (
                              <span
                                style={{
                                  padding: '1px 6px',
                                  borderRadius: '999px',
                                  background: '#E2E8F0',
                                  color: '#334155',
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
                              backgroundColor: 'var(--success-bg, #DCFCE7)',
                              color: '#15803D',
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
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                color: '#475569',
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
                              ? `Member limit reached — click to warn or increase limit`
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
                              ? '#F59E0B'
                              : '#CBD5E1',
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
              backgroundColor: '#F1F5F9',
              borderTop: '1px solid #E2E8F0',
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
              <span style={{ fontSize: '.74rem', color: '#64748B' }}>
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
        </div>
      )}
    </div>
  );
}
