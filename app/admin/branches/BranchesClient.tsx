'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { createBranch } from '../actions';
import { useRouter } from 'next/navigation';

export default function BranchesClient({ branches }: { branches: any[] }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>Branch Management</h1>
          <p className="text-muted">Manage branches for the Micro Lending application</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
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
                <th>Users</th>
                <th>Routes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {branches.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>
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
                  <td>{b._count.users}</td>
                  <td>{b._count.routes}</td>
                  <td>
                    <span className={`badge ${b.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Branch">
        <form action={async (fd) => {
          setLoading(true);
          const res = await createBranch(fd);
          setLoading(false);
          if (res.success) {
            setIsModalOpen(false);
          } else {
            alert(res.error);
          }
        }}>
          <div className="form-group">
            <label className="form-label">Branch Name</label>
            <input type="text" name="name" className="form-control" required placeholder="e.g. Main Branch" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Branch Code</label>
              <input type="text" name="code" className="form-control" required placeholder="e.g. MB01" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="text" name="phone" className="form-control" placeholder="Optional" />
            </div>
          </div>
          
          <div className="form-actions" style={{marginTop:'20px'}}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Branch'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
