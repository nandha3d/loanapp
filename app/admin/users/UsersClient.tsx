'use client';

import { useMemo, useState } from 'react';
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
};

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
}: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('agent');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>(normalizeModuleList([defaultAppType]));
  const [viewingSuperadminId, setViewingSuperadminId] = useState<string | null>(
    viewerRole === 'superadmin' && superadmins.length > 0 ? superadmins[0].id : null
  );

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
    const fallback = normalizeModuleList([user?.appType || defaultAppType]);

    if (role === 'admin' && assignedModules.length > 0) {
      setSelectedModules(assignedModules.filter((module) => allowed.includes(module)));
      return;
    }
    
    if (viewerRole === 'developer') {
        setSelectedModules(allowed.length > 0 ? allowed : fallback);
    } else {
        setSelectedModules(allowed.length > 0 ? allowed : fallback);
    }
  }

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedBranchId(user.branchId || '');
    
    if (user.role === 'superadmin') {
      const summary = superadmins.find(s => s.id === user.id);
      if (summary) {
        setSelectedModules(normalizeModuleList(summary.modules));
      } else {
        setSelectedModules(normalizeModuleList([user.appType || defaultAppType]));
      }
    } else {
      resetModuleSelection(user.branchId || '', user.role, user);
    }
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingUser(null);
    setSelectedRole('agent');
    setSelectedBranchId('');
    setSelectedModules(allowedPlanModules.length > 0 ? [allowedPlanModules[0]] : normalizeModuleList([defaultAppType]));
    setIsModalOpen(true);
  };

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
        <div className="header-actions">
          {viewingSuperadminId && viewerRole === 'developer' ? (
            <button className="btn btn-ghost" onClick={() => setViewingSuperadminId(null)}>
              <span className="material-icons-outlined">arrow_back</span> Back to List
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleOpenNew}>
              <span className="material-icons-outlined">add</span> New User
            </button>
          )}
        </div>
      </div>

      {!viewingSuperadminId && (
        <div className="grid-2" style={{ marginBottom: '20px' }}>
          {superadmins.map((superadmin) => (
            <div className="card" key={superadmin.id}>
              <div className="card-header">
                <div>
                  <h3>{superadmin.name}</h3>
                  <p className="text-muted" style={{ margin: 0 }}>{superadmin.username} · {superadmin.phone}</p>
                </div>
                <span className={`badge ${superadmin.status === 'active' ? 'badge-active' : 'badge-closed'}`}>{superadmin.status}</span>
              </div>

              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '16px' }}>
                <div className="summary-item"><strong>{superadmin.branches.length}</strong><span className="text-muted">Branches</span></div>
                <div className="summary-item"><strong>{superadmin.adminCount}</strong><span className="text-muted">Admins</span></div>
                <div className="summary-item"><strong>{superadmin.agentCount}</strong><span className="text-muted">Agents</span></div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {superadmin.modules.length > 0
                  ? superadmin.modules.map((module) => modulePill(module))
                  : <span className="text-muted">No modules assigned</span>}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary btn-sm" style={{flex: 1}} onClick={() => setViewingSuperadminId(superadmin.id)}>
                  View Details
                </button>
                {viewerRole === 'developer' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    const sa = superadmins.find(s => s.id === superadmin.id);
                    setViewingSuperadminId(superadmin.id);
                    setSubPlan(sa?.subscription?.plan || 'trial');
                    setSubModules(normalizeModuleList(sa?.subscription?.enabledModules));
                    setIsSubModalOpen(true);
                  }}>
                    Subscription
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(users.find(u => u.id === superadmin.id))}>
                  Edit User
                </button>
              </div>
            </div>
          ))}
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
              <input type="text" name="username" className="form-control" defaultValue={editingUser?.username} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="text" name="phone" className="form-control" defaultValue={editingUser?.phone} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password {editingUser && <span className="text-muted">(Leave blank to keep)</span>}</label>
            <input type="password" name="password" className="form-control" required={!editingUser} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Role</label>
              <select name="role" className="form-control" value={selectedRole} onChange={(e) => handleRoleChange(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="agent">Agent</option>
                {viewerRole === 'developer' && <option value="superadmin">Super Admin</option>}
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
          <div className="form-group">
            <label className="form-label">Branch Assignment</label>
            <select name="branchId" className="form-control" value={selectedBranchId} onChange={(e) => handleBranchChange(e.target.value)}>
              <option value="">Global / Not assigned</option>
              {branches
                .filter(b => !editingUser || b.tenantId === editingUser.tenantId)
                .map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>

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
          <div className="form-group">
            <label className="form-label">Module Access</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {ALL_MODULES.map((module) => {
                const isDeveloper = viewerRole === 'developer';
                const enabled = isDeveloper || (allowedPlanModules.includes(module) && selectedBranchModules.length === 0 || selectedBranchModules.includes(module));
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
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Updating...' : 'Update Subscription'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsSubModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
