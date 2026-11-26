'use client';

import { useMemo, useState } from 'react';
import {
  ALL_STAFF_PERMISSION_KEYS,
  EMPTY_STAFF_PERMISSIONS,
  STAFF_PERMISSION_GROUPS,
  STAFF_PERMISSION_META,
  type StaffPermissionGroupKey,
  type StaffPermissionKey,
  type StaffPermissions,
} from '@/lib/staffPermissions';

interface ElementPrivilegeSelectorProps {
  value: StaffPermissions;
  onChange: (next: StaffPermissions) => void;
  title?: string;
  subtitle?: string;
}

export default function ElementPrivilegeSelector({
  value,
  onChange,
  title = 'Element-Level Privilege Selector',
  subtitle = 'Enable or disable each portal page, chit workflow, and UI action individually.',
}: ElementPrivilegeSelectorProps) {
  const [filterText, setFilterText] = useState('');

  const enabledTotal = useMemo(
    () => ALL_STAFF_PERMISSION_KEYS.filter((k) => Boolean(value[k])).length,
    [value],
  );

  const toggleKey = (key: StaffPermissionKey, nextVal: boolean) => {
    onChange({
      ...value,
      [key]: nextVal,
    });
  };

  const setAll = (enabled: boolean) => {
    const next: StaffPermissions = { ...EMPTY_STAFF_PERMISSIONS };
    for (const key of ALL_STAFF_PERMISSION_KEYS) {
      next[key] = enabled;
    }
    onChange(next);
  };

  const setGroupAll = (group: StaffPermissionGroupKey, enabled: boolean) => {
    const next: StaffPermissions = { ...value };
    for (const meta of STAFF_PERMISSION_META) {
      if (meta.group === group) {
        next[meta.key] = enabled;
      }
    }
    onChange(next);
  };

  const q = filterText.trim().toLowerCase();

  return (
    <div
      style={{
        borderRadius: '12px',
        border: '1px solid #CBD5E1',
        backgroundColor: '#EEF2F6',
        padding: '12px',
      }}
    >
      {/* Top toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '10px',
          padding: '10px 12px',
          borderRadius: '10px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #DCE3EC',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>
              tune
            </span>
            <strong style={{ fontSize: '.86rem', color: '#0F172A' }}>{title}</strong>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '.72rem',
                fontWeight: 700,
                backgroundColor: enabledTotal > 0 ? 'var(--primary-light)' : '#E2E8F0',
                color: enabledTotal > 0 ? 'var(--primary-dark)' : '#475569',
                border: '1px solid var(--primary-border, #CBD5E1)',
              }}
            >
              {enabledTotal} / {ALL_STAFF_PERMISSION_KEYS.length} enabled
            </span>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: '.74rem', color: '#64748B' }}>{subtitle}</p>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter elements..."
            aria-label="Filter privilege elements"
            style={{
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              backgroundColor: '#F4F7FA',
              fontSize: '.76rem',
              width: '150px',
              color: '#0F172A',
              outline: 'none',
            }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 10px', fontSize: '.72rem', backgroundColor: '#FFFFFF' }}
            onClick={() => setAll(true)}
          >
            Enable All
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 10px', fontSize: '.72rem', backgroundColor: '#FFFFFF' }}
            onClick={() => setAll(false)}
          >
            Disable All
          </button>
        </div>
      </div>

      {/* Categorized element groups */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxHeight: '340px',
          overflowY: 'auto',
          paddingRight: '2px',
        }}
      >
        {STAFF_PERMISSION_GROUPS.map((grp) => {
          const groupItems = STAFF_PERMISSION_META.filter((m) => {
            if (m.group !== grp.id) return false;
            if (!q) return true;
            return `${m.label} ${m.description} ${grp.title}`.toLowerCase().includes(q);
          });
          if (groupItems.length === 0) return null;

          const activeInGroup = groupItems.filter((m) => Boolean(value[m.key])).length;

          return (
            <div
              key={grp.id}
              style={{
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #DCE3EC',
                padding: '10px 12px',
                boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '8px',
                  paddingBottom: '6px',
                  borderBottom: '1px solid #EEF2F6',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span
                    className="material-icons-outlined"
                    style={{ fontSize: '17px', color: 'var(--primary)' }}
                  >
                    {grp.icon}
                  </span>
                  <strong style={{ fontSize: '.82rem', color: '#0F172A' }}>{grp.title}</strong>
                  <span
                    style={{
                      fontSize: '.7rem',
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: '999px',
                      backgroundColor: activeInGroup > 0 ? 'var(--primary-light)' : '#F1F5F9',
                      color: activeInGroup > 0 ? 'var(--primary-dark)' : '#64748B',
                    }}
                  >
                    {activeInGroup}/{groupItems.length}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    type="button"
                    onClick={() => setGroupAll(grp.id, true)}
                    style={{
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#334155',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    All On
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupAll(grp.id, false)}
                    style={{
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#64748B',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    All Off
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(225px, 1fr))',
                  gap: '7px',
                }}
              >
                {groupItems.map((pm) => {
                  const checked = Boolean(value[pm.key]);
                  return (
                    <button
                      key={pm.key}
                      type="button"
                      role="switch"
                      aria-checked={checked}
                      onClick={() => toggleKey(pm.key, !checked)}
                      style={{
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '8px 10px',
                        borderRadius: '9px',
                        border: checked
                          ? '1.5px solid var(--primary)'
                          : '1px solid #DCE3EC',
                        backgroundColor: checked ? 'var(--primary-light)' : '#F8FAFC',
                        cursor: 'pointer',
                        transition: 'all .14s ease',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '.78rem',
                            fontWeight: 700,
                            color: checked ? 'var(--primary-dark)' : '#0F172A',
                            lineHeight: 1.25,
                          }}
                        >
                          {pm.label}
                        </div>
                        <div
                          style={{
                            fontSize: '.69rem',
                            color: '#64748B',
                            marginTop: '2px',
                            lineHeight: 1.3,
                          }}
                        >
                          {pm.description}
                        </div>
                      </div>
                      <span
                        aria-hidden="true"
                        style={{
                          width: '34px',
                          height: '20px',
                          borderRadius: '999px',
                          backgroundColor: checked ? 'var(--primary)' : '#CBD5E1',
                          position: 'relative',
                          flexShrink: 0,
                          marginTop: '2px',
                          transition: 'background-color .15s ease',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: '2px',
                            left: checked ? '16px' : '2px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: '#FFFFFF',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            transition: 'left .15s ease',
                          }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
