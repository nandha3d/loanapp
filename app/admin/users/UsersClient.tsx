'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { manageMasterUser, toggleUserStatus } from '../actions';
import { updateSubscription } from '../billing/billingActions';
import { ALL_MODULES, MODULE_LABELS, normalizeModuleList, type ModuleKey } from '@/types/modules';
import { PLAN_LABELS, PLAN_FEATURES } from '@/lib/plans';

type BranchOption = {
  id: string;
  name: string;
  code: string | null;
  tenantId: string;
  enabledModules: unknown;
  _count?: {
    users: number;
    routes: number;
    customers: number;
    loans: number;
  };
};

type SuperadminSummary = {
  id: string;
  tenantId: string;
  name: string;
  username: string;
  phone: string;
  status: string;
  subscription: any;
  adminCount: number;
  agentCount: number;
  modules: ModuleKey[];
  assignedBranchIds: string[];
  branches: {
    id: string;
    name: string;
    code: string | null;
    enabledModules: ModuleKey[];
    usersCount: number;
    routesCount: number;
    customersCount: number;
    loansCount: number;
  }[];
};

type Props = {
  users: any[];
  branches: BranchOption[];
  viewerRole: string;
  defaultAppType: string;
  subscription: any;
  planModules: string[];
  superadmins: SuperadminSummary[];
  allBranches: { id: string; name: string; code: string | null; tenantId: string }[];
};

type AvailabilityField = { checking: boolean; available: boolean | null; message: string };

const emptyAvailability: AvailabilityField = { checking: false, available: null, message: '' };

function modulePill(module: ModuleKey, disabled = false) {
  return (
    <span
      key={module}
      className="badge"
      style={{
        background: disabled ? 'var(--bg)' : 'var(--success-bg)',
        color: disabled ? 'var(--text-light)' : 'var(--success)',
        border: `1px solid ${disabled ? 'var(--border)' : 'var(--success)'}`,
      }}
    >
      {MODULE_LABELS[module]}
    </span>
  );
}

export default function UsersClient({
  users,
  branches,
  viewerRole,
  defaultAppType,
  subscription,
  planModules,
  superadmins,
  allBranches,
}: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('agent');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  // Multi-branch selection for superadmin (developer assigns)
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>(normalizeModuleList([defaultAppType]));
  const [userUsername, setUserUsername] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [availability, setAvailability] = useState<Record<'username' | 'phone', AvailabilityField>>({
    username: emptyAvailability,
    phone: emptyAvailability,
  });
  const [viewingSuperadminId, setViewingSuperadminId] = useState<string | null>(
    viewerRole === 'superadmin' && superadmins.length > 0 ? superadmins[0].id : null
  );

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const activeSuperadmin = superadmins.find(s => s.id === viewingSuperadminId);
  const activeSub = activeSuperadmin?.subscription || subscription;

  const [subPlan, setSubPlan] = useState(activeSub?.plan || 'trial');
  const [subModules, setSubModules] = useState<ModuleKey[]>(normalizeModuleList(activeSub?.enabledModules));

  const allowedPlanModules = normalizeModuleList(activeSub?.enabledModules || planModules);
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);
  const selectedBranchModules = normalizeModuleList(selectedBranch?.enabledModules);
  const availableModules = selectedBranchModules.length > 0
    ? selectedBranchModules.filter((module) => allowedPlanModules.includes(module))
    : allowedPlanModules;
  const primaryAppType = selectedModules[0] || availableModules[0] || 'microlending';

  function resetModuleSelection(branchId: string, role: string, user?: any) {
    const branch = branches.find((item) => item.id === branchId);
    const branchModules = normalizeModuleList(branch?.enabledModules);
    const allowed = branchModules.length > 0
      ? branchModules.filter((module) => allowedPlanModules.includes(module))
      : allowedPlanModules;
    const assigned = user?.userBranchModules?.find((row: any) => row.branchId === branchId);
    const assignedModules = normalizeModuleList(assigned?.enabledModules);
    const globalModules = normalizeModuleList((user?.userModules || []).map((module: any) => module.appType));
    const fallback = normalizeModuleList([user?.appType || defaultAppType]);
    const preferredModules = assignedModules.length > 0
      ? assignedModules
      : globalModules.length > 0
        ? globalModules
        : fallback;
    const constrainedModules = viewerRole === 'developer'
      ? preferredModules
      : preferredModules.filter((module) => allowed.includes(module));

    if ((role === 'admin' || role === 'agent') && constrainedModules.length > 0) {
      setSelectedModules(constrainedModules);
      return;
    }
    
    setSelectedModules(allowed.length > 0 ? allowed : fallback);
  }

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedBranchId(user.branchId || '');
    setUserUsername(user.username || '');
    setUserPhone(user.phone || '');
    
    if (user.role === 'superadmin') {
      const summary = superadmins.find(s => s.id === user.id);
      if (summary) {
        setSelectedModules(normalizeModuleList(summary.modules));
        setSelectedBranchIds(summary.assignedBranchIds || []);
      } else {
        setSelectedModules(normalizeModuleList([user.appType || defaultAppType]));
        setSelectedBranchIds([]);
      }
    } else {
      resetModuleSelection(user.branchId || '', user.role, user);
      setSelectedBranchIds([]);
    }
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingUser(null);
    setSelectedRole('agent');
    setSelectedBranchId('');
    setUserUsername('');
    setUserPhone('');
    setSelectedBranchIds([]);
    setSelectedModules(allowedPlanModules.length > 0 ? [allowedPlanModules[0] as ModuleKey] : normalizeModuleList([defaultAppType]));
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!isModalOpen) return;
    const params = new URLSearchParams();
    if (userUsername.trim()) params.set('username', userUsername.trim());
    if (userPhone.trim()) params.set('phone', userPhone.trim());
    if (editingUser?.id) params.set('excludeUserId', editingUser.id);
    if (!params.has('username') && !params.has('phone')) {
      setAvailability({ username: emptyAvailability, phone: emptyAvailability });
      return;
    }

    const controller = new AbortController();
    setAvailability((prev) => ({
      username: userUsername.trim() ? { ...prev.username, checking: true, message: '' } : emptyAvailability,
      phone: userPhone.trim() ? { ...prev.phone, checking: true, message: '' } : emptyAvailability,
    }));

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/availability?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();
        setAvailability({
          username: data.fields.username.checked ? { checking: false, available: data.fields.username.available, message: data.fields.username.message || '' } : emptyAvailability,
          phone: data.fields.phone.checked ? { checking: false, available: data.fields.phone.available, message: data.fields.phone.message || '' } : emptyAvailability,
        });
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setAvailability((prev) => ({
          username: { ...prev.username, checking: false },
          phone: { ...prev.phone, checking: false },
        }));
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [editingUser?.id, isModalOpen, userPhone, userUsername]);

  function handleBranchChange(branchId: string) {
    setSelectedBranchId(branchId);
    resetModuleSelection(branchId, selectedRole, editingUser);
  }

  function handleRoleChange(role: string) {
    setSelectedRole(role);
    resetModuleSelection(selectedBranchId, role, editingUser);
  }

  function toggleModule(module: ModuleKey) {
    const isDeveloper = viewerRole === 'developer';
    if (!isDeveloper && !availableModules.includes(module)) return;

    setSelectedModules((prev) => {
      if (prev.includes(module)) {
        const next = prev.filter((item) => item !== module);
        if (isDeveloper) return next;
        return next.length > 0 ? next : prev;
      }
      if (isDeveloper) return [...prev, module];
      return [...prev, module];
    });
  }

  // Manual email-verification fallback (developer only): when the activation
  // email never arrives, a developer can flip a pending account to active —
  // same end-state as clicking the verification link.
  const [verifying, setVerifying] = useState<string | null>(null);
  async function handleVerifyActivate(userId: string, name: string) {
    if (!confirm(`Manually verify & activate "${name}"? This is the same as confirming their email.`)) return;
    setVerifying(userId);
    try {
      const res = await toggleUserStatus(userId, 'active');
      if (res?.success) {
        router.refresh();
      } else {
        alert('Could not activate this account.');
      }
    } catch {
      alert('Network error while activating.');
    } finally {
      setVerifying(null);
    }
  }

  async function handleImpersonate(superadminId: string, name: string) {
    setImpersonating(superadminId);
    try {
      const res = await fetch('/api/developer/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ superadminId }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.redirectUrl || '/portal';
      } else {
        alert(data.error || 'Could not open this account');
        setImpersonating(null);
      }
    } catch (err) {
      alert('Network error during impersonation');
      setImpersonating(null);
    }
  }

  const filteredAndSortedSuperadmins = useMemo(() => {
    let filtered = [...superadmins];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(sa => 
        sa.name.toLowerCase().includes(q) || 
        sa.username.toLowerCase().includes(q) || 
        sa.phone.includes(q)
      );
    }

    if (filterPlan) {
      filtered = filtered.filter(sa => (sa.subscription?.plan?.toLowerCase() || 'trial') === filterPlan.toLowerCase());
    }

    if (sortConfig) {
      filtered.sort((a, b) => {
        let valA: any = a[sortConfig.key as keyof typeof a];
        let valB: any = b[sortConfig.key as keyof typeof b];

        if (sortConfig.key === 'plan') {
          valA = PLAN_LABELS[a.subscription?.plan?.toLowerCase() || 'trial'] || '';
          valB = PLAN_LABELS[b.subscription?.plan?.toLowerCase() || 'trial'] || '';
        } else if (sortConfig.key === 'amount') {
          valA = a.subscription?.totalMonthlyPrice || 0;
          valB = b.subscription?.totalMonthlyPrice || 0;
        } else if (sortConfig.key === 'team') {
          valA = a.branches.length;
          valB = b.branches.length;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [superadmins, searchQuery, filterPlan, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return 'unfold_more';
    return sortConfig.direction === 'asc' ? 'expand_less' : 'expand_more';
  };

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>{viewingSuperadminId ? `Super Admin: ${activeSuperadmin?.name}` : 'Master User Management'}</h1>
          <p className="text-muted">
            {viewingSuperadminId 
              ? 'View detailed statistics and management for this Super Admin.' 
              : 'Manage tenant owners, branch teams, module access, and subscription limits.'}
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
          {viewingSuperadminId && viewerRole === 'developer' ? (
            <>
              {activeSuperadmin && activeSuperadmin.status !== 'active' && (
                <button
                  className="btn btn-primary"
                  style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                  disabled={verifying === activeSuperadmin.id}
                  onClick={() => handleVerifyActivate(activeSuperadmin.id, activeSuperadmin.name)}
                  title="Manually verify this account (email-fallback)"
                >
                  <span className="material-icons-outlined">verified_user</span>
                  {verifying === activeSuperadmin.id ? 'Activating…' : 'Manually Verify & Activate'}
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setViewingSuperadminId(null)}>
                <span className="material-icons-outlined">arrow_back</span> Back to List
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleOpenNew}>
              <span className="material-icons-outlined">add</span> New User
            </button>
          )}
        </div>
      </div>

      {!viewingSuperadminId && (
        <div className="card fade-up" style={{ padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--bg-lighter)' }}>
            <div className="input-group" style={{ flex: 1, maxWidth: '300px', margin: 0 }}>
              <span className="material-icons-outlined">search</span>
              <input 
                type="text" 
                placeholder="Search name, phone..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select 
              value={filterPlan} 
              onChange={(e) => setFilterPlan(e.target.value)}
              className="input-field"
              style={{ width: 'auto' }}
            >
              <option value="">All Plans</option>
              {Object.entries(PLAN_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ padding: '16px 24px', cursor: 'pointer' }} onClick={() => handleSort('name')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Super Admin <span className="material-icons-outlined" style={{ fontSize: '16px', color: sortConfig?.key === 'name' ? 'var(--primary)' : 'inherit' }}>{getSortIcon('name')}</span></div>
                  </th>
                  <th>Status</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('team')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Team <span className="material-icons-outlined" style={{ fontSize: '16px', color: sortConfig?.key === 'team' ? 'var(--primary)' : 'inherit' }}>{getSortIcon('team')}</span></div>
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('amount')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Subscription <span className="material-icons-outlined" style={{ fontSize: '16px', color: sortConfig?.key === 'amount' ? 'var(--primary)' : 'inherit' }}>{getSortIcon('amount')}</span></div>
                  </th>
                  <th>Modules</th>
                  <th style={{ textAlign: 'right', paddingRight: '24px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedSuperadmins.map((superadmin) => (
                  <tr 
                    key={superadmin.id} 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => setViewingSuperadminId(superadmin.id)}
                  >
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0 }}>
                          {superadmin.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '2px' }}>{superadmin.name}</div>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>{superadmin.username} &middot; {superadmin.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${superadmin.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
                        {superadmin.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{superadmin.branches.length}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Branches</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{superadmin.adminCount}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Admins</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{superadmin.agentCount}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Agents</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          {PLAN_LABELS[superadmin.subscription?.plan?.toLowerCase() || 'trial'] || superadmin.subscription?.plan || 'Trial'}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          ₹{(superadmin.subscription?.totalMonthlyPrice || 0).toLocaleString('en-IN')} / mo
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {superadmin.modules.length > 0 ? (
                          superadmin.modules.map((module) => modulePill(module))
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>No modules</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {viewerRole === 'developer' && superadmin.status !== 'active' && (
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--success)', color: '#fff', border: 'none', gap: '4px' }}
                            disabled={verifying === superadmin.id}
                            onClick={(e) => { e.stopPropagation(); handleVerifyActivate(superadmin.id, superadmin.name); }}
                            title="Manually verify & activate (email-fallback)"
                          >
                            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                              {verifying === superadmin.id ? 'hourglass_top' : 'verified_user'}
                            </span>
                            {verifying === superadmin.id ? 'Activating…' : 'Verify'}
                          </button>
                        )}
                        {viewerRole === 'developer' && (
                          <button
                            className="btn btn-sm"
                            style={{
                              background: impersonating === superadmin.id ? 'var(--warning-bg)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: '#fff',
                              border: 'none',
                              gap: '4px',
                              opacity: impersonating ? 0.7 : 1,
                            }}
                            disabled={!!impersonating}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImpersonate(superadmin.id, superadmin.name);
                            }}
                            title="Open this account (no login)"
                          >
                            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                              {impersonating === superadmin.id ? 'hourglass_top' : 'login'}
                            </span>
                            {impersonating === superadmin.id ? 'Opening...' : 'Open'}
                          </button>
                        )}
                        {viewerRole === 'developer' && (
                          <button className="btn btn-ghost btn-sm" onClick={(e) => {
                            e.stopPropagation();
                            const sa = superadmins.find(s => s.id === superadmin.id);
                            setViewingSuperadminId(superadmin.id);
                            setSubPlan(sa?.subscription?.plan || 'trial');
                            setSubModules(normalizeModuleList(sa?.subscription?.enabledModules));
                            setIsSubModalOpen(true);
                          }} title="Subscription">
                            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>credit_card</span>
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(users.find(u => u.id === superadmin.id));
                        }} title="Edit User">
                          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>edit</span>
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={(e) => {
                          e.stopPropagation();
                          setViewingSuperadminId(superadmin.id);
                        }}>
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAndSortedSuperadmins.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                      <div className="empty-state">
                        <span className="material-icons-outlined">group_off</span>
                        <h3>No Super Admins Found</h3>
                        <p>There are currently no active super admins in the system.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewingSuperadminId && activeSuperadmin && (
        <div className="fade-up">
          <div className="grid-3" style={{ marginBottom: '20px' }}>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Subscription Plan</h3>
                {viewerRole === 'developer' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setSubPlan(activeSub?.plan || 'trial');
                    setSubModules(normalizeModuleList(activeSub?.enabledModules));
                    setIsSubModalOpen(true);
                  }}>
                    Manage
                  </button>
                )}
              </div>
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>
                  {PLAN_LABELS[activeSub?.plan || 'trial'] || activeSub?.plan || 'Trial'}
                </div>
                <div className="text-muted" style={{ marginBottom: '16px' }}>
                  Status: <span style={{ color: activeSub?.status === 'active' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{activeSub?.status || 'Unknown'}</span>
                </div>
                <div className="stats-list">
                  <div className="stats-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>Max Agents</span>
                    <span style={{ fontWeight: 600 }}>{activeSuperadmin.agentCount} / {activeSub?.maxAgents || 3}</span>
                  </div>
                  <div className="stats-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>Max Active Loans</span>
                    <span style={{ fontWeight: 600 }}>{activeSub?.maxActiveLoans || 50}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>User Statistics</h3>
              </div>
              <div style={{ padding: '0 20px 20px' }}>
                <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="kpi-card" style={{ padding: '16px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div className="kpi-value">{activeSuperadmin.adminCount}</div>
                    <div className="kpi-label">Admins</div>
                  </div>
                  <div className="kpi-card" style={{ padding: '16px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div className="kpi-value">{activeSuperadmin.agentCount}</div>
                    <div className="kpi-label">Agents</div>
                  </div>
                </div>
                <div style={{ marginTop: '20px' }}>
                  <h4>Enabled Modules</h4>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {activeSuperadmin.modules.map((module) => modulePill(module))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Branches</h3>
              </div>
              <div style={{ padding: '0 20px 20px' }}>
                <div className="kpi-value" style={{ fontSize: '2rem' }}>{activeSuperadmin.branches.length}</div>
                <div className="kpi-label">Total Active Branches</div>
                <div style={{ marginTop: '20px' }}>
                  {activeSuperadmin.branches.slice(0, 3).map(b => (
                    <div key={b.id} style={{ fontSize: '0.9rem', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      {b.name} ({b.code})
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Team Members</h3>
            </div>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter(u => u.role !== 'superadmin' && u.role !== 'developer' && u.tenantId === activeSuperadmin.tenantId)
                    .map(user => (
                      <tr key={user.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{user.name}</div>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>{user.username}</div>
                        </td>
                        <td><span className="badge badge-pending">{user.role}</span></td>
                        <td>{user.branch?.name || 'Global'}</td>
                        <td><span className={`badge ${user.status === 'active' ? 'badge-active' : 'badge-closed'}`}>{user.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(user)}>Edit</button>
                            <button 
                              className="btn btn-ghost btn-sm"
                              style={{ color: user.status === 'active' ? 'var(--danger)' : 'var(--success)' }}
                              onClick={async () => {
                                if (confirm(`Are you sure you want to ${user.status === 'active' ? 'deactivate' : 'activate'} this user?`)) {
                                  const res = await toggleUserStatus(user.id, user.status === 'active' ? 'inactive' : 'active');
                                  if (!res?.success) {
                                    alert('Failed to toggle status');
                                  } else {
                                    router.refresh();
                                  }
                                }
                              }}
                            >
                              {user.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? 'Edit User' : 'Add New User'}>
        <form action={async (fd) => {
          const duplicate = Object.values(availability).find((item) => item.available === false);
          if (duplicate) { alert(duplicate.message); return; }
          if (Object.values(availability).some((item) => item.checking)) { alert('Checking username and phone availability. Please try again in a moment.'); return; }
          setLoading(true);
          const res = await manageMasterUser(fd);
          setLoading(false);
          if (res.success) {
            setIsModalOpen(false);
            router.refresh();
          } else alert(res.error);
        }}>
          {editingUser && <input type="hidden" name="id" value={editingUser.id} />}
          <input type="hidden" name="appType" value={primaryAppType} />
          <div className="form-group">
            <label className="form-label">Name</label>
            <input type="text" name="name" className="form-control" defaultValue={editingUser?.name} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" name="username" className="form-control" value={userUsername} onChange={(e) => setUserUsername(e.target.value)} required />
              {availability.username.checking && <small className="text-muted">Checking username...</small>}
              {availability.username.available === false && <small style={{ color: 'var(--danger)' }}>{availability.username.message}</small>}
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="text" name="phone" className="form-control" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} required />
              {availability.phone.checking && <small className="text-muted">Checking phone...</small>}
              {availability.phone.available === false && <small style={{ color: 'var(--danger)' }}>{availability.phone.message}</small>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password {editingUser && <span className="text-muted">(Leave blank to keep)</span>}</label>
            <input type="password" name="password" className="form-control" required={!editingUser} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Aadhaar Number</label>
              <input name="aadharNumber" className="form-control" defaultValue={editingUser?.aadharNumber || ''} placeholder="Optional" />
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input name="dob" type="date" className="form-control" defaultValue={editingUser?.dob ? new Date(editingUser.dob).toISOString().split('T')[0] : ''} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Experience</label>
              <input name="experience" className="form-control" defaultValue={editingUser?.experience || ''} placeholder="e.g. 2 years, Optional" />
            </div>
            <div className="form-group">
              <label className="form-label">Age</label>
              <input name="age" type="number" className="form-control" defaultValue={editingUser?.age || ''} placeholder="Optional" />
            </div>
          </div>
          {/* Agent-only: these toggles are privilege downgrades meant for field
              agents. Other roles keep full privileges, so the block is hidden. */}
          {selectedRole === 'agent' && (
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '.9rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-dark)' }}>
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>admin_panel_settings</span>
              Agent Permissions & Autopay Controls
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  name="bypassCustomerApproval" 
                  value="true" 
                  defaultChecked={!!editingUser?.bypassCustomerApproval} 
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ fontSize: '.85rem', display: 'block' }}>Bypass Customer Approval</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>Allow user to create active customers without admin review.</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  name="bypassLoanApproval" 
                  value="true" 
                  defaultChecked={!!editingUser?.bypassLoanApproval} 
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ fontSize: '.85rem', display: 'block' }}>Bypass Loan Approval</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>Allow user to create active loans immediately.</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  name="autoReleaseFloat" 
                  value="true" 
                  defaultChecked={!!editingUser?.autoReleaseFloat} 
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ fontSize: '.85rem', display: 'block' }}>Auto-Release Float</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>Automatically disburse funds when loan is created/approved.</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  name="feeConfirmationMandatory" 
                  value="true" 
                  defaultChecked={!!editingUser?.feeConfirmationMandatory} 
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ fontSize: '.85rem', display: 'block' }}>Mandatory Customer Confirmation</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>Require borrower to confirm cash collection before it reflects to admin dashboard.</span>
                </div>
              </label>
            </div>
          </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Role</label>
              <select name="role" className="form-control" value={selectedRole} onChange={(e) => handleRoleChange(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="agent">Agent</option>
                {viewerRole === 'developer' && <option value="superadmin">Super Admin</option>}
                {/* A superadmin can add a co-owner (another superadmin) to their OWN account. */}
                {viewerRole === 'superadmin' && !editingUser && <option value="superadmin">Co-Owner (Super Admin)</option>}
                {viewerRole === 'developer' && <option value="developer">Developer</option>}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="status" className="form-control" defaultValue={editingUser?.status || 'active'}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          {/* Branch assignment — multi-select for superadmin (developer only), single select otherwise */}
          {selectedRole === 'superadmin' && viewerRole === 'developer' ? (
            <div className="form-group">
              <label className="form-label">Branch Assignments</label>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '8px' }}>
                Select which branches this superadmin manages.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}>
                {allBranches
                  .filter(b => !editingUser || b.tenantId === editingUser.tenantId)
                  .map((branch) => {
                    const checked = selectedBranchIds.includes(branch.id);
                    return (
                      <label key={branch.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 6px', borderRadius: '6px', background: checked ? 'var(--primary-light)' : 'transparent' }}>
                        <input
                          type="checkbox"
                          name="branchIds"
                          value={branch.id}
                          checked={checked}
                          onChange={() => setSelectedBranchIds(prev => checked ? prev.filter(id => id !== branch.id) : [...prev, branch.id])}
                        />
                        <span style={{ fontWeight: checked ? 600 : 400, color: checked ? 'var(--primary-dark)' : 'inherit' }}>
                          {branch.name}{branch.code ? ` (${branch.code})` : ''}
                        </span>
                      </label>
                    );
                  })}
                {allBranches.filter(b => !editingUser || b.tenantId === editingUser.tenantId).length === 0 && (
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>No branches available for this tenant.</span>
                )}
              </div>
            </div>
          ) : selectedRole !== 'superadmin' ? (
            <div className="form-group">
              <label className="form-label">Branch Assignment</label>
              <select name="branchId" className="form-control" value={selectedBranchId} onChange={(e) => handleBranchChange(e.target.value)}>
                <option value="">No branch assigned</option>
                {branches
                  .filter(b => !editingUser || b.tenantId === editingUser.tenantId)
                  .map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </div>
          ) : null}

          {editingUser?.role === 'superadmin' && viewerRole === 'developer' && (
            <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--primary-dark)', fontWeight: 600 }}>This is a Super Admin user. Subscription limits and modules should be managed separately.</span>
                <button type="button" className="btn btn-sm" style={{ background: 'var(--primary)', color: 'white' }} onClick={() => {
                  const sa = superadmins.find(s => s.id === editingUser.id);
                  setViewingSuperadminId(editingUser.id);
                  setSubPlan(sa?.subscription?.plan || 'trial');
                  setSubModules(normalizeModuleList(sa?.subscription?.enabledModules));
                  setIsModalOpen(false);
                  setIsSubModalOpen(true);
                }}>
                  Manage Subscription
                </button>
              </div>
            </div>
          )}
          {/* Module Access - one picker for admin/agent access, persisted to both legacy tables */}
          {selectedRole !== 'superadmin' && (
            <div className="form-group">
              <label className="form-label">Module Access</label>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '8px' }}>
                Modules this user can access. Branch assignments limit the available choices.
              </p>
              {selectedModules.map((module) => (
                <input key={`user-module-${module}`} type="hidden" name="userModules" value={module} />
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {ALL_MODULES.map((module) => {
                  const isDeveloper = viewerRole === 'developer';
                  const enabled = isDeveloper || availableModules.includes(module);
                  const checked = selectedModules.includes(module);
                  return (
                    <label key={module} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px', background: checked ? 'var(--primary-light)' : 'var(--surface)', opacity: enabled ? 1 : 0.45, cursor: enabled ? 'pointer' : 'not-allowed', color: checked ? 'var(--primary-dark)' : 'inherit', fontWeight: checked ? 600 : 400 }}>
                      <input type="checkbox" name="adminModules" value={module} checked={checked} disabled={!enabled} onChange={() => toggleModule(module)} />
                      <span>{MODULE_LABELS[module]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save User'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Subscription Modal */}
      <Modal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} title="Manage Tenant Subscription">
        <form action={async (fd) => {
          setLoading(true);
          const res = await updateSubscription(fd);
          setLoading(false);
          if (res.success) {
            setIsSubModalOpen(false);
            router.refresh();
          } else alert(res.error);
        }}>
          <input type="hidden" name="tenantId" value={activeSuperadmin?.tenantId || subscription?.tenantId} />
          <div className="form-group">
            <label className="form-label">Plan</label>
            <select name="plan" className="form-control" value={subPlan} onChange={(e) => {
              const val = e.target.value;
              setSubPlan(val);
              const feat = PLAN_FEATURES[val];
              if (feat) {
                (document.querySelector('[name="maxAgents"]') as HTMLInputElement).value = feat.agents.toString();
                (document.querySelector('[name="maxActiveLoans"]') as HTMLInputElement).value = feat.loans.toString();
                (document.querySelector('[name="maxBranches"]') as HTMLInputElement).value = feat.branches.toString();
                setSubModules(normalizeModuleList(feat.modules));
              }
            }}>
              {Object.entries(PLAN_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Max Agents</label>
              <input type="number" name="maxAgents" className="form-control" defaultValue={activeSub?.maxAgents} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Active Loans</label>
              <input type="number" name="maxActiveLoans" className="form-control" defaultValue={activeSub?.maxActiveLoans} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Branches</label>
              <input type="number" name="maxBranches" className="form-control" defaultValue={activeSub?.maxBranches ?? 1} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="status" className="form-control" defaultValue={activeSub?.status}>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input 
                type="date" 
                name="currentPeriodEnd" 
                className="form-control" 
                defaultValue={activeSub?.currentPeriodEnd ? new Date(activeSub.currentPeriodEnd).toISOString().split('T')[0] : ''} 
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Enabled Modules</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {ALL_MODULES.map((module) => (
                <label key={module} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: `1px solid ${subModules.includes(module) ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px' }}>
                  <input type="checkbox" name="enabledModules" value={module} checked={subModules.includes(module)} onChange={() => {
                    setSubModules(prev => prev.includes(module) ? prev.filter(m => m !== module) : [...prev, module]);
                  }} />
                  <span>{MODULE_LABELS[module]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Add-ons</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" name="whatsappSmsEnabled" value="true" defaultChecked={activeSub?.whatsappSmsEnabled || false} />
                Allow WhatsApp &amp; SMS Notifications
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" name="receiptPdfAllowed" value="true" defaultChecked={activeSub?.receiptPdfAllowed || false} />
                Allow Receipt PDF Downloads
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" name="bureauEnabled" value="true" defaultChecked={activeSub?.bureauEnabled || false} />
                Allow Credit Bureau Checks (CRIF/CIBIL)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" name="npaEnabled" value="true" defaultChecked={activeSub?.npaEnabled || false} />
                Allow NPA Classification Engine (RBI Compliance)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" name="kycEnabled" value="true" defaultChecked={activeSub?.kycEnabled || false} />
                Allow Aadhaar OTP &amp; Video KYC Verification (Digio)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" name="gpsTrackingEnabled" value="true" defaultChecked={activeSub?.gpsTrackingEnabled || false} />
                Allow GPS Collection Tracking
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" name="premiumAccountingEnabled" value="true" defaultChecked={activeSub?.premiumAccountingEnabled || false} />
                💎 Allow Premium Accounting (double-entry, GST, Tally export)
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Updating...' : 'Update Subscription'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsSubModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
