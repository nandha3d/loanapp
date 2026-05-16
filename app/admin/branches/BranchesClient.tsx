'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { createBranch, updateBranch } from '../actions';
import { MODULE_LABELS, normalizeModuleList, type ModuleKey } from '@/types/modules';

export default function BranchesClient({ branches, superadmins }: { branches: any[]; superadmins: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [selectedSaId, setSelectedSaId] = useState('');

  const selectedSa = superadmins.find(sa => sa.id === selectedSaId);
  const saModules = selectedSa?.modules || [];

  const handleEdit = (branch: any) => {
    setEditingBranch(branch);
    setSelectedSaId(branch.superadminId || '');
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingBranch(null);
    setSelectedSaId('');
    setIsModalOpen(true);
  };

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>Branch Management</h1>
          <p className="text-muted">Manage branches and their assigned owners</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleOpenNew}>
            <span className="material-icons-outlined">add</span> New Branch
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Branch Name</th>
                <th>Code</th>
                <th>Phone</th>
                <th>Owner</th>
                <th>Active Modules</th>
                <th>Users</th>
                <th>Routes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>
                    <div className="empty-state">
                      <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--text-light)' }}>store</span>
                      <h3>No Branches Found</h3>
                      <p className="text-muted">Create a branch to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : branches.map((b) => (
                <tr key={b.id}>
                  <td><div style={{fontWeight: 500}}>{b.name}</div></td>
                  <td>{b.code}</td>
                  <td>{b.phone || '—'}</td>
                  <td>{b.superadmin?.name || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {normalizeModuleList(b.enabledModules).map((m: ModuleKey) => (
                        <span key={m} className="badge badge-pending" style={{ fontSize: '0.7rem' }}>
                          {MODULE_LABELS[m]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{b._count.users}</td>
                  <td>{b._count.routes}</td>
                  <td>
                    <span className={`badge ${b.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(b)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBranch ? 'Edit Branch' : 'Add New Branch'}>
        <form action={async (fd) => {
          setLoading(true);
          // Auto-add enabled modules based on SA
          saModules.forEach(m => fd.append('enabledModules', m));
          
          const res = editingBranch ? await updateBranch(fd) : await createBranch(fd);
          setLoading(false);
          if (res.success) {
            setIsModalOpen(false);
          } else {
            alert(res.error);
          }
        }}>
          {editingBranch && <input type="hidden" name="id" value={editingBranch.id} />}
          <div className="form-group">
            <label className="form-label">Branch Name</label>
            <input type="text" name="name" className="form-control" required defaultValue={editingBranch?.name} placeholder="e.g. Main Branch" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Branch Code</label>
              <input type="text" name="code" className="form-control" required defaultValue={editingBranch?.code} placeholder="e.g. MB01" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="text" name="phone" className="form-control" defaultValue={editingBranch?.phone} placeholder="Optional" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Owning Superadmin</label>
              <select 
                name="superadminId" 
                className="form-control" 
                value={selectedSaId}
                onChange={(e) => setSelectedSaId(e.target.value)}
                required
              >
                <option value="">Select Owner</option>
                {superadmins.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} ({user.username})</option>
                ))}
              </select>
            </div>
            {editingBranch && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select name="status" className="form-control" defaultValue={editingBranch?.status}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-group" style={{ background: 'var(--bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '10px' }}>
            <label className="form-label" style={{ marginBottom: '12px', display: 'block' }}>Inherited Modules</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {saModules.length > 0 ? saModules.map((m: ModuleKey) => (
                <span key={m} className="badge badge-active" style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                  {MODULE_LABELS[m]}
                </span>
              )) : <span className="text-muted" style={{ fontSize: '0.9rem' }}>Select an owner to see enabled modules</span>}
            </div>
            <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '12px', marginBottom: 0 }}>
              * Modules are automatically inherited from the Superadmin's subscription plan.
            </p>
          </div>
          
          <div className="form-actions" style={{marginTop:'20px'}}>
            <button type="submit" className="btn btn-primary" disabled={loading || !selectedSaId}>
              {loading ? 'Saving...' : 'Save Branch'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
