'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { manageAgent, toggleAgentStatus } from './actions';
import { ALL_MODULES, MODULE_LABELS, normalizeModuleList, type ModuleKey } from '@/types/modules';
import PasswordInput from '@/components/ui/PasswordInput';

type Agent = {
  id: string;
  name: string;
  username: string;
  phone: string;
  status: string;
  branchId: string | null;
  createdAt: Date;
  appType?: string;
  userBranchModules?: {
    id: string;
    userId: string;
    branchId: string;
    enabledModules: string;
  }[];
};

type Props = {
  initialAgents: Agent[];
  branches: { id: string; name: string; code: string | null }[];
  activeBranch: { name: string; code: string | null; enabledModules?: string } | null;
  viewerRole: string;
  allowedModules: string[];
  dict: any;
};

export default function TeamClient({
  initialAgents,
  branches,
  activeBranch,
  viewerRole,
  allowedModules,
  dict,
}: Props) {
  const a = dict.admin || {};
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('active');
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>([]);

  const activeBranchModules = useMemo(() => {
    if (viewerRole === 'developer') return ALL_MODULES;
    return normalizeModuleList(allowedModules);
  }, [allowedModules, viewerRole]);

  const filteredAgents = useMemo(() => {
    return initialAgents.filter((agent) => {
      const matchesSearch =
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.phone.includes(searchQuery);
      const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [initialAgents, searchQuery, statusFilter]);

  const handleOpenNew = () => {
    setEditingAgent(null);
    setName(''); setUsername(''); setPhone(''); setPassword('');
    setStatus('active');
    setSelectedModules(activeBranchModules.length > 0 ? [activeBranchModules[0]] : ['microlending']);
    setError(null);
    setIsModalOpen(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setName(agent.name); setUsername(agent.username);
    setPhone(agent.phone); setPassword(''); setStatus(agent.status);
    const assigned = agent.userBranchModules?.find((row: any) => row.branchId === agent.branchId);
    const assignedModules = normalizeModuleList(assigned?.enabledModules);
    setSelectedModules(assignedModules.length > 0 ? assignedModules : (agent.appType ? [agent.appType as ModuleKey] : []));
    setError(null);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (agent: Agent) => {
    const confirmMsg = agent.status === 'active'
      ? (a.deactivateConfirm || 'Are you sure you want to deactivate this agent?')
      : (a.activateConfirm || 'Are you sure you want to activate this agent?');
    if (!confirm(confirmMsg)) return;

    try {
      const res = await toggleAgentStatus(agent.id, agent.status);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || a.failedToUpdate || 'Failed to update agent status');
      }
    } catch (err) {
      console.error(err);
      alert(a.unexpectedError || 'An unexpected error occurred.');
    }
  };

  function toggleModule(module: ModuleKey) {
    if (!activeBranchModules.includes(module) && viewerRole !== 'developer') return;
    setSelectedModules((prev) => {
      if (prev.includes(module)) {
        const next = prev.filter((item) => item !== module);
        return next.length > 0 ? next : prev;
      }
      return [...prev, module];
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    if (editingAgent) formData.append('id', editingAgent.id);
    formData.append('name', name);
    formData.append('username', username);
    formData.append('phone', phone);
    formData.append('password', password);
    formData.append('status', status);
    selectedModules.forEach((module) => formData.append('adminModules', module));

    try {
      const res = await manageAgent(formData);
      if (res.success) {
        setIsModalOpen(false);
        router.refresh();
      } else {
        setError(res.error || a.failedToSave || 'Failed to save agent');
      }
    } catch (err) {
      console.error(err);
      setError(a.unexpectedError || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid" style={{ padding: '24px' }}>
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            {a.manageAgents || 'Manage Agents'}
          </h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0' }}>
            {activeBranch ? (
              <span className="badge" style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '20px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>storefront</span>
                {a.branch || 'Branch'}: {activeBranch.name} {activeBranch.code ? `(${activeBranch.code})` : ''}
              </span>
            ) : (
              a.manageAgentsDesc || 'Manage field collection agents and view performance.'
            )}
          </p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={handleOpenNew}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: 'var(--radius-md)' }}>
            <span className="material-icons-outlined">add</span>
            {a.newAgent || 'New Agent'}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '24px', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
            <span className="material-icons-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}>search</span>
            <input
              type="text"
              placeholder={a.searchAgents || 'Search by name, username, or phone...'}
              className="form-control"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px', height: '42px', borderRadius: 'var(--radius-sm)' }}
            />
          </div>
          <div style={{ width: '180px' }}>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: '42px', borderRadius: 'var(--radius-sm)' }}
            >
              <option value="all">{a.allStatuses || 'All Statuses'}</option>
              <option value="active">{a.activeOnly || 'Active Only'}</option>
              <option value="inactive">{a.inactiveOnly || 'Inactive Only'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Agents */}
      {filteredAgents.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', borderRadius: 'var(--radius-md)' }}>
          <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)', marginBottom: '12px' }}>badge</span>
          <h3 style={{ margin: 0, fontWeight: 600 }}>{a.noAgentsFound || 'No Agents Found'}</h3>
          <p className="text-muted" style={{ margin: '8px 0 0 0' }}>{a.noAgentsHint || 'Try adjusting your search query or create a new agent.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredAgents.map((agent) => (
            <div key={agent.id} className="card" style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      background: agent.status === 'active' ? 'var(--primary-bg)' : 'var(--bg-dark)',
                      color: agent.status === 'active' ? 'var(--primary)' : 'var(--text-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '1.1rem'
                    }}>
                      {agent.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{agent.name}</h3>
                      <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>@{agent.username}</p>
                    </div>
                  </div>
                  <span style={{
                    background: agent.status === 'active' ? 'var(--success-bg)' : 'var(--danger-bg)',
                    color: agent.status === 'active' ? 'var(--success)' : 'var(--danger)',
                    padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600
                  }}>
                    {agent.status === 'active' ? (a.active || 'ACTIVE') : (a.inactive || 'INACTIVE')}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', color: 'var(--text-light)', borderTop: '1px solid var(--border)', paddingTop: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>phone</span>
                    <span>{agent.phone}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>calendar_today</span>
                    <span>{a.joinDate || 'Joined'} {new Date(agent.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>apps</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {(() => {
                        const assigned = agent.userBranchModules?.find((row: any) => row.branchId === agent.branchId);
                        const assignedModules = normalizeModuleList(assigned?.enabledModules);
                        const list = assignedModules.length > 0 ? assignedModules : (agent.appType ? [agent.appType] : []);
                        return list.map((module: any) => (
                          <span key={module} style={{ background: 'var(--primary-bg)', color: 'var(--primary)', border: '1px solid var(--primary-light)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                            {MODULE_LABELS[module as ModuleKey] || module}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <button className="btn btn-outline" onClick={() => handleEdit(agent)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', fontSize: '0.85rem' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>edit</span>
                    {a.editAgent || 'Edit'}
                  </button>
                  <button
                    className={`btn ${agent.status === 'active' ? 'btn-ghost' : 'btn-primary'}`}
                    onClick={() => handleToggleStatus(agent)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '6px', padding: '8px', fontSize: '0.85rem',
                      color: agent.status === 'active' ? 'var(--danger)' : undefined,
                      background: agent.status === 'active' ? 'var(--danger-bg)' : undefined,
                    }}>
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                      {agent.status === 'active' ? 'block' : 'check_circle'}
                    </span>
                    {agent.status === 'active' ? (a.deactivateConfirm ? (dict.settings?.deactivate || 'Deactivate') : 'Deactivate') : (a.active || 'Activate')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Agent Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={editingAgent ? (a.editAgent || 'Edit Agent Details') : (a.addAgent || 'Add New Field Agent')}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <span className="material-icons-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>{a.name || 'Agent Name'} *</label>
            <input type="text" className="form-control" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" required />
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>{a.username || 'Username'} *</label>
              <input type="text" className="form-control" value={username}
                onChange={(e) => setUsername(e.target.value)} placeholder="e.g. johndoe" required />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>{a.phone || 'Phone Number'} *</label>
              <input type="tel" className="form-control" value={phone}
                onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
              {editingAgent ? `${a.password || 'Password'} (leave blank to keep unchanged)` : `${a.password || 'Password'} *`}
            </label>
            <PasswordInput className="form-control" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editingAgent ? 'Enter new password' : 'Enter agent password'}
              required={!editingAgent} />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>{a.modules || 'Module Access'}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
              {activeBranchModules.map((module) => {
                const checked = selectedModules.includes(module);
                return (
                  <label key={module} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px', background: checked ? 'var(--primary-light)' : 'var(--surface)', cursor: 'pointer', color: checked ? 'var(--primary-dark)' : 'inherit', fontWeight: checked ? 600 : 400 }}>
                    <input type="checkbox" name="adminModules" value={module} checked={checked} onChange={() => toggleModule(module)} />
                    <span>{MODULE_LABELS[module]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {editingAgent && (
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>{a.status || 'Status'}</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">{a.active || 'Active'}</option>
                <option value="inactive">{a.inactive || 'Inactive'}</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
              {a.cancel || 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loading && <span className="material-icons-outlined style-spin">sync</span>}
              {loading ? (a.saving || 'Saving...') : (a.save || 'Save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
