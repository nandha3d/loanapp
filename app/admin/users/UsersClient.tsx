'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { manageMasterUser, toggleUserStatus } from '../actions';
import { useRouter } from 'next/navigation';

export default function UsersClient({ users, branches }: { users: any[], branches: any[] }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAppType, setSelectedAppType] = useState('microlending');

  const handleEdit = (u: any) => {
    setEditingUser(u);
    setSelectedAppType(u.appType);
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingUser(null);
    setSelectedAppType('microlending');
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    await toggleUserStatus(id, currentStatus === 'active' ? 'inactive' : 'active');
  };

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>Master User Management</h1>
          <p className="text-muted">Manage all administrators and agents across the platform</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleOpenNew}>
            <span className="material-icons-outlined">add</span> New User
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>App / Branch</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{fontWeight: 500}}>{u.name}</div>
                    <div style={{fontSize: '0.85rem', color: 'var(--text-light)'}}>{u.phone}</div>
                  </td>
                  <td>{u.username}</td>
                  <td><span className="badge badge-pending" style={{textTransform:'capitalize'}}>{u.role}</span></td>
                  <td>
                    <div style={{fontWeight: 500, textTransform:'capitalize'}}>{u.appType}</div>
                    {u.branch && <div style={{fontSize: '0.85rem', color: 'var(--text-light)'}}>{u.branch.name}</div>}
                  </td>
                  <td>
                    <span className={`badge ${u.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(u)}>Edit</button>
                    {u.role !== 'superadmin' && (
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{color: u.status === 'active' ? 'var(--danger)' : 'var(--success)'}}
                        onClick={() => handleToggleStatus(u.id, u.status)}
                      >
                        {u.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? "Edit User" : "Add New User"}>
        <form action={async (fd) => {
          setLoading(true);
          const res = await manageMasterUser(fd);
          setLoading(false);
          if (res.success) {
            setIsModalOpen(false);
          } else {
            alert(res.error);
          }
        }}>
          {editingUser && <input type="hidden" name="id" value={editingUser.id} />}
          
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
            <label className="form-label">Password {editingUser && <span className="text-muted">(Leave blank to keep current)</span>}</label>
            <input type="password" name="password" className="form-control" required={!editingUser} />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Application</label>
              <select 
                name="appType" 
                className="form-control" 
                value={selectedAppType}
                onChange={(e) => setSelectedAppType(e.target.value)}
              >
                <option value="microlending">Micro Lending</option>
                <option value="autofinance">Auto Finance</option>
                <option value="chitfunds">Chit Funds</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select name="role" className="form-control" defaultValue={editingUser?.role || 'agent'}>
                <option value="admin">Admin</option>
                <option value="agent">Agent</option>
              </select>
            </div>
          </div>

          {selectedAppType === 'microlending' && (
            <div className="form-group">
              <label className="form-label">Branch Assignment</label>
              <select name="branchId" className="form-control" defaultValue={editingUser?.branchId || ''}>
                <option value="">Global / All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-actions" style={{marginTop:'20px'}}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save User'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
