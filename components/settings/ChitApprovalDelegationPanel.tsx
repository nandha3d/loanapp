'use client';

import { useMemo, useState } from 'react';
import {
  mergeStaffPermissions,
  parseStaffPermissions,
} from '@/lib/staffPermissions';

export type ChitDelegationUser = {
  id: string;
  name: string;
  username?: string | null;
  role: string;
  isPrimaryAdmin?: boolean;
  status?: string | null;
  branchId?: string | null;
  customRoleId?: string | null;
  customRoleName?: string | null;
  staffPermissions?: string | null;
  customRole?: {
    id: string;
    name: string;
    status?: string | null;
    permissionsJson: string;
  } | null;
  branch?: { id: string; name: string } | null;
};

type ApprovalPolicyState = {
  adminCanApproveSecurity: boolean;
  adminCanReleasePayout: boolean;
};

type Props = {
  canModify: boolean;
  policy: ApprovalPolicyState;
  onSavePolicy: (next: ApprovalPolicyState) => Promise<{ success: boolean; error?: string }>;
  users: ChitDelegationUser[];
  onToggleUserPermission: (input: {
    userId: string;
    permissionKey: 'canApproveSecurity' | 'canReleasePayout';
    enabled: boolean;
  }) => Promise<{
    success: boolean;
    error?: string;
    canApproveSecurity?: boolean;
    canReleasePayout?: boolean;
  }>;
  manageBranchName?: string | null;
};

function TogglePill({
  checked,
  disabled,
  busy,
  label,
  onClick,
}: {
  checked: boolean;
  disabled: boolean;
  busy: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 10px 4px 6px',
        borderRadius: '999px',
        border: checked ? '1px solid var(--primary)' : '1px solid var(--border, #CBD5E1)',
        backgroundColor: checked ? 'var(--primary-light, #FFF3E0)' : 'var(--bg, #F8FAFC)',
        color: checked ? 'var(--primary-dark, #B45309)' : 'var(--text-secondary, #64748B)',
        cursor: disabled || busy ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : busy ? 0.75 : 1,
        fontSize: '.74rem',
        fontWeight: 700,
        transition: 'all .14s ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '32px',
          height: '18px',
          borderRadius: '999px',
          backgroundColor: checked ? 'var(--primary)' : '#CBD5E1',
          position: 'relative',
          display: 'inline-block',
          transition: 'background-color .14s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '16px' : '2px',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left .14s ease',
          }}
        />
      </span>
      <span>{busy ? 'Saving…' : checked ? 'ON' : 'OFF'}</span>
    </button>
  );
}

export default function ChitApprovalDelegationPanel({
  canModify,
  policy,
  onSavePolicy,
  users,
  onToggleUserPermission,
  manageBranchName,
}: Props) {
  const [policyBusy, setPolicyBusy] = useState<'security' | 'payout' | null>(null);
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, { canApproveSecurity?: boolean; canReleasePayout?: boolean }>
  >({});
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'agent'>('all');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const delegatableUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => u.role === 'admin' || u.role === 'agent')
      .filter((u) => (roleFilter === 'all' ? true : u.role === roleFilter))
      .filter((u) => {
        if (!q) return true;
        const designation = u.customRoleName || u.customRole?.name || '';
        return `${u.name} ${u.username || ''} ${designation} ${u.branch?.name || ''}`
          .toLowerCase()
          .includes(q);
      });
  }, [users, roleFilter, search]);

  const handlePolicyToggle = async (field: 'adminCanApproveSecurity' | 'adminCanReleasePayout') => {
    if (!canModify || policyBusy) return;
    setFeedback(null);
    setPolicyBusy(field === 'adminCanApproveSecurity' ? 'security' : 'payout');
    const next: ApprovalPolicyState = {
      ...policy,
      [field]: !policy[field],
    };
    const res = await onSavePolicy(next);
    setPolicyBusy(null);
    if (!res.success) {
      setFeedback({ type: 'err', msg: res.error || 'Failed to update Admin permission setting.' });
    } else {
      setFeedback({
        type: 'ok',
        msg:
          field === 'adminCanApproveSecurity'
            ? `Branch Admin security & document approval turned ${next.adminCanApproveSecurity ? 'ON' : 'OFF'}.`
            : `Branch Admin prize payout release turned ${next.adminCanReleasePayout ? 'ON' : 'OFF'}.`,
      });
    }
  };

  const handleUserToggle = async (
    u: ChitDelegationUser,
    permissionKey: 'canApproveSecurity' | 'canReleasePayout',
    nextEnabled: boolean,
  ) => {
    if (!canModify || busyCell) return;
    const cellKey = `${u.id}:${permissionKey}`;
    setFeedback(null);
    setBusyCell(cellKey);
    const res = await onToggleUserPermission({
      userId: u.id,
      permissionKey,
      enabled: nextEnabled,
    });
    setBusyCell(null);
    if (!res.success) {
      setFeedback({ type: 'err', msg: res.error || 'Failed to update permission.' });
    } else {
      setLocalOverrides((prev) => ({
        ...prev,
        [u.id]: {
          canApproveSecurity:
            res.canApproveSecurity ?? (permissionKey === 'canApproveSecurity' ? nextEnabled : prev[u.id]?.canApproveSecurity),
          canReleasePayout:
            res.canReleasePayout ?? (permissionKey === 'canReleasePayout' ? nextEnabled : prev[u.id]?.canReleasePayout),
        },
      }));
      const label = permissionKey === 'canApproveSecurity' ? 'Security Approval' : 'Prize Payout Release';
      setFeedback({
        type: 'ok',
        msg: `${label} ${nextEnabled ? 'enabled' : 'disabled'} for ${u.name}.`,
      });
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border, #DCE3EC)',
        borderRadius: '14px',
        padding: '16px',
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '12px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border, #EEF2F6)',
        }}
      >
        <div>
          <h4
            style={{
              margin: 0,
              fontSize: '.96rem',
              fontWeight: 700,
              color: 'var(--text, #0F172A)',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              flexWrap: 'wrap',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '19px', color: 'var(--primary)' }}>
              verified_user
            </span>
            Chit Security Approval &amp; Prize Payout Permissions
            <span
              className="badge"
              style={{
                backgroundColor: canModify ? 'var(--primary-light)' : '#F1F5F9',
                color: canModify ? 'var(--primary-dark)' : '#475569',
                fontSize: '.7rem',
                fontWeight: 700,
              }}
            >
              {canModify ? 'Superadmin Control' : 'Superadmin Only (Read-only)'}
            </span>
          </h4>
          <p style={{ margin: '3px 0 0', fontSize: '.76rem', color: 'var(--text-secondary, #64748B)' }}>
            Enable or disable who can approve auction winner collateral documents and release prize payouts across Admins, Foremen, and Chit Staff
            {manageBranchName ? ` (${manageBranchName})` : ''}.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '10px',
            border: feedback.type === 'ok' ? '1px solid #86EFAC' : '1px solid #FCA5A5',
            backgroundColor: feedback.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
            color: feedback.type === 'ok' ? '#065F46' : '#991B1B',
            fontSize: '.78rem',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>{feedback.msg}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 700,
              fontSize: '.82rem',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tenant-wide Admin switches */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '11px',
            border: policy.adminCanApproveSecurity ? '1.5px solid var(--primary)' : '1px solid var(--border, #CBD5E1)',
            backgroundColor: policy.adminCanApproveSecurity ? 'var(--primary-tint, rgba(245,166,35,0.06))' : 'var(--bg, #F8FAFC)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '.83rem', fontWeight: 700, color: 'var(--text, #0F172A)' }}>
              Allow Branch Admins to Approve Winner Security
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--text-secondary, #64748B)', marginTop: '3px', lineHeight: 1.35 }}>
              Lets Admins directly approve/reject collateral documents &amp; unlock prize payout without waiting for Superadmin.
            </div>
          </div>
          <TogglePill
            checked={policy.adminCanApproveSecurity}
            disabled={!canModify}
            busy={policyBusy === 'security'}
            label="Allow Branch Admins to Approve Winner Security"
            onClick={() => handlePolicyToggle('adminCanApproveSecurity')}
          />
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '11px',
            border: policy.adminCanReleasePayout ? '1.5px solid var(--primary)' : '1px solid var(--border, #CBD5E1)',
            backgroundColor: policy.adminCanReleasePayout ? 'var(--primary-tint, rgba(245,166,35,0.06))' : 'var(--bg, #F8FAFC)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '.83rem', fontWeight: 700, color: 'var(--text, #0F172A)' }}>
              Allow Branch Admins to Release Prize Payouts
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--text-secondary, #64748B)', marginTop: '3px', lineHeight: 1.35 }}>
              Lets Admins disburse prize money to winners once security documents are approved.
            </div>
          </div>
          <TogglePill
            checked={policy.adminCanReleasePayout}
            disabled={!canModify}
            busy={policyBusy === 'payout'}
            label="Allow Branch Admins to Release Prize Payouts"
            onClick={() => handlePolicyToggle('adminCanReleasePayout')}
          />
        </div>
      </div>

      {/* Individual Admin / Foreman / Staff Overrides Table */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '10px',
        }}
      >
        <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--text, #0F172A)' }}>
          Per-Member Override — Admins, Foremen &amp; Staff ({delegatableUsers.length})
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'admin', 'agent'] as const).map((rf) => (
            <button
              key={rf}
              type="button"
              className={`btn btn-sm ${roleFilter === rf ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '.72rem', padding: '4px 10px' }}
              onClick={() => setRoleFilter(rf)}
            >
              {rf === 'all' ? 'All Members' : rf === 'admin' ? 'Admins Only' : 'Foremen & Staff'}
            </button>
          ))}
          <input
            type="search"
            className="form-control"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter name or role…"
            style={{ width: '175px', padding: '4px 9px', fontSize: '.74rem', minHeight: '30px' }}
          />
        </div>
      </div>

      {delegatableUsers.length === 0 ? (
        <div
          style={{
            padding: '16px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg, #F8FAFC)',
            border: '1px dashed var(--border, #CBD5E1)',
            fontSize: '.78rem',
            color: 'var(--text-secondary, #64748B)',
            textAlign: 'center',
          }}
        >
          No matching Admin, Foreman, or Staff logins found in this scope.
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role / Foreman Title</th>
                <th>Approve Security</th>
                <th>Release Payout</th>
              </tr>
            </thead>
            <tbody>
              {delegatableUsers.map((u) => {
                const activeCustomJson =
                  u.customRole?.status === 'active' ? u.customRole.permissionsJson : null;
                const effPerms = mergeStaffPermissions(activeCustomJson, u.staffPermissions);
                const roleLabel =
                  u.role === 'admin'
                    ? u.isPrimaryAdmin
                      ? 'Primary Admin'
                      : 'Branch Admin'
                    : u.customRoleName || u.customRole?.name || 'Foreman / Staff';
                const ownApprove =
                  localOverrides[u.id]?.canApproveSecurity ?? Boolean(effPerms.canApproveSecurity);
                const ownPayout =
                  localOverrides[u.id]?.canReleasePayout ?? Boolean(effPerms.canReleasePayout);
                const viaAdminPolicyApprove = u.role === 'admin' && policy.adminCanApproveSecurity && !ownApprove;
                const viaAdminPolicyPayout = u.role === 'admin' && policy.adminCanReleasePayout && !ownPayout;
                const inheritedRolePerms = parseStaffPermissions(activeCustomJson);

                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text, #0F172A)', fontSize: '.82rem' }}>{u.name}</div>
                      <div style={{ fontSize: '.71rem', color: 'var(--text-secondary, #64748B)' }}>
                        {u.username ? `@${u.username}` : ''}
                        {u.branch?.name ? ` · ${u.branch.name}` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: u.role === 'admin' ? 'var(--primary-light)' : '#EEF2FF',
                            color: u.role === 'admin' ? 'var(--primary-dark)' : '#3730A3',
                            fontSize: '.7rem',
                            fontWeight: 700,
                          }}
                        >
                          {roleLabel}
                        </span>
                        {u.role === 'admin' && (u.customRoleName || u.customRole?.name) && (
                          <span style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>
                            ({u.customRoleName || u.customRole?.name})
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <TogglePill
                          checked={ownApprove}
                          disabled={!canModify}
                          busy={busyCell === `${u.id}:canApproveSecurity`}
                          label={`Approve Security for ${u.name}`}
                          onClick={() => handleUserToggle(u, 'canApproveSecurity', !ownApprove)}
                        />
                        {viaAdminPolicyApprove && (
                          <span className="badge badge-success" style={{ fontSize: '.67rem' }}>
                            Active via Admin Policy
                          </span>
                        )}
                        {inheritedRolePerms.canApproveSecurity && u.customRole?.name && (
                          <span style={{ fontSize: '.68rem', color: 'var(--text-secondary)' }}>
                            from {u.customRole.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <TogglePill
                          checked={ownPayout}
                          disabled={!canModify}
                          busy={busyCell === `${u.id}:canReleasePayout`}
                          label={`Release Payout for ${u.name}`}
                          onClick={() => handleUserToggle(u, 'canReleasePayout', !ownPayout)}
                        />
                        {viaAdminPolicyPayout && (
                          <span className="badge badge-success" style={{ fontSize: '.67rem' }}>
                            Active via Admin Policy
                          </span>
                        )}
                        {inheritedRolePerms.canReleasePayout && u.customRole?.name && (
                          <span style={{ fontSize: '.68rem', color: 'var(--text-secondary)' }}>
                            from {u.customRole.name}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
