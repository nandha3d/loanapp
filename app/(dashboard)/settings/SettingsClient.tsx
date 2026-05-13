'use client';

import { useState } from 'react';
import { saveSystemSettings, savePenaltySettings, createRoute, deleteRoute, createLoanPackage, deleteLoanPackage, createUser, assignAgentToRoute, removeAgentFromRoute } from './actions';
import Modal from '@/components/Modal';

export default function SettingsClient({ 
  routes, packages, users, settings, currencySymbol 
}: { 
  routes: any[], packages: any[], users: any[], settings: Record<string, string>, currencySymbol: string 
}) {
  const [activeTab, setActiveTab] = useState('routes');
  const [loading, setLoading] = useState(false);

  // Modals state
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [routeAgentModal, setRouteAgentModal] = useState<{ routeId: string; routeName: string; agents: any[] } | null>(null);
  const [raAgentId, setRaAgentId] = useState('');
  const [packageDeductionType, setPackageDeductionType] = useState<'fixed' | 'percentage'>('fixed');

  const showToast = (msg: string) => {
    alert(msg); 
  };

  const handleSystemSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    await saveSystemSettings(new FormData(e.currentTarget));
    setLoading(false);
    showToast('System config saved!');
  };

  const handlePenaltySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    await savePenaltySettings(new FormData(e.currentTarget));
    setLoading(false);
    showToast('Penalty config saved!');
  };

  return (
    <div className="card">
      <div className="tabs">
        <div className={`tab ${activeTab === 'routes' ? 'active' : ''}`} onClick={() => setActiveTab('routes')}>Routes / Lines</div>
        <div className={`tab ${activeTab === 'penalty' ? 'active' : ''}`} onClick={() => setActiveTab('penalty')}>Penalty Config</div>
        <div className={`tab ${activeTab === 'packages' ? 'active' : ''}`} onClick={() => setActiveTab('packages')}>Loan Packages</div>
        <div className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>User Management</div>
        <div className={`tab ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>System Config</div>
      </div>

      {/* Routes Tab */}
      <div className={`tab-content ${activeTab === 'routes' ? 'active' : ''}`}>
        <div className="card-header">
          <h3>🗺️ Routes / Lines</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setIsRouteModalOpen(true)}>
            <span className="material-icons-outlined" style={{fontSize:'14px'}}>add</span> Add Route
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Route Name</th><th>Primary Agent</th><th>Shared Agents</th><th>Customers</th><th>Actions</th></tr></thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.assignedAgent?.name || <span style={{color:'var(--text-light)'}}>Unassigned</span>}</td>
                  <td>
                    <div style={{display:'flex', flexWrap:'wrap', gap:'4px'}}>
                      {(r.routeAgents || []).map((ra: any) => (
                        <span key={ra.agentId} style={{display:'inline-flex', alignItems:'center', gap:'3px', background:'var(--bg-muted)', borderRadius:'var(--radius-sm)', padding:'2px 6px', fontSize:'.72rem'}}>
                          {ra.agent?.name}
                          <button style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-light)', fontSize:'12px', lineHeight:1, padding:'0 1px'}} title="Remove" onClick={async () => { if(confirm('Remove agent from route?')) { await removeAgentFromRoute(r.id, ra.agentId); window.location.reload(); } }}>✕</button>
                        </span>
                      ))}
                      <button className="btn btn-ghost btn-sm" style={{fontSize:'.7rem', padding:'2px 6px'}} onClick={() => { setRouteAgentModal({ routeId: r.id, routeName: r.name, agents: r.routeAgents || [] }); setRaAgentId(''); }}>
                        <span className="material-icons-outlined" style={{fontSize:'12px'}}>person_add</span>
                      </button>
                    </div>
                  </td>
                  <td>{r._count.customers}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={() => { if(confirm('Delete route?')) deleteRoute(r.id); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Penalty Tab */}
      <div className={`tab-content ${activeTab === 'penalty' ? 'active' : ''}`}>
        <div className="card-header"><h3>⚡ Penalty Configuration</h3></div>
        <form onSubmit={handlePenaltySubmit} style={{maxWidth:'500px'}}>
          <div className="form-group">
            <label className="form-label">Default Penalty Per Day ({currencySymbol})</label>
            <input type="number" name="default_penalty_per_day" className="form-control" defaultValue={settings.default_penalty_per_day || '50'} required />
          </div>
          <div className="form-group">
            <label className="form-label">Grace Period (days before penalty starts)</label>
            <input type="number" name="penalty_grace_period" className="form-control" defaultValue={settings.penalty_grace_period || '0'} required />
          </div>
          <div className="form-group">
            <label className="form-label">Maximum Penalty Cap ({currencySymbol}) — 0 for unlimited</label>
            <input type="number" name="penalty_max_cap" className="form-control" defaultValue={settings.penalty_max_cap || '0'} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <span className="material-icons-outlined" style={{fontSize:'16px'}}>save</span> {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Packages Tab */}
      <div className={`tab-content ${activeTab === 'packages' ? 'active' : ''}`}>
        <div className="card-header">
          <h3>📦 Loan Packages</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setIsPackageModalOpen(true)}>
            <span className="material-icons-outlined" style={{fontSize:'14px'}}>add</span> Create Package
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Package Name</th><th>Principal</th><th>Deduction</th><th>Frequency</th><th>Tenure</th><th>Per Instalment</th><th>Actions</th></tr></thead>
            <tbody>
              {packages.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{currencySymbol}{Number(p.principal).toLocaleString()}</td>
                  <td>{currencySymbol}{Number(p.deduction).toLocaleString()}</td>
                  <td style={{textTransform:'capitalize'}}>{p.frequency}</td>
                  <td>{p.tenure} {p.frequency === 'daily' ? 'days' : p.frequency === 'weekly' ? 'weeks' : 'months'}</td>
                  <td>{currencySymbol}{Number(p.perInstalment).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm">Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={() => { if(confirm('Delete package?')) deleteLoanPackage(p.id); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users Tab */}
      <div className={`tab-content ${activeTab === 'users' ? 'active' : ''}`}>
        <div className="card-header">
          <h3>👥 User Management</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setIsUserModalOpen(true)}>
            <span className="material-icons-outlined" style={{fontSize:'14px'}}>person_add</span> Add User
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>User</th><th>Phone</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong><br/><span style={{fontSize:'.72rem',color:'var(--text-light)'}}>{u.username}</span></td>
                  <td>{u.phone}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-active' : 'badge-pending'}`} style={{textTransform:'capitalize'}}>{u.role}</span>
                  </td>
                  <td><span className={`badge ${u.status === 'active' ? 'badge-active' : 'badge-closed'}`} style={{textTransform:'capitalize'}}>{u.status}</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm">Edit</button>
                    {u.role !== 'admin' && <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}}>Deactivate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Tab */}
      <div className={`tab-content ${activeTab === 'system' ? 'active' : ''}`}>
        <div className="card-header"><h3>⚙️ System Configuration</h3></div>
        <form onSubmit={handleSystemSubmit}>
          <div className="settings-list" style={{maxWidth:'600px'}}>
            <div className="settings-item">
              <div className="si-info"><h4>App Name</h4><p>Display name shown in the header</p></div>
              <input type="text" name="app_name" className="form-control" style={{width:'200px'}} defaultValue={settings.app_name || 'LoanTrack'} required />
            </div>
            <div className="settings-item">
              <div className="si-info"><h4>Currency</h4><p>Currency code (e.g. INR)</p></div>
              <input type="text" name="currency" className="form-control" style={{width:'200px'}} defaultValue={settings.currency || 'INR'} required />
            </div>
            <div className="settings-item">
              <div className="si-info"><h4>Currency Symbol</h4><p>Symbol (e.g. ₹)</p></div>
              <input type="text" name="currency_symbol" className="form-control" style={{width:'200px'}} defaultValue={settings.currency_symbol || '₹'} required />
            </div>
            <div className="settings-item">
              <div className="si-info"><h4>Timezone</h4><p>All dates and times use this timezone</p></div>
              <select name="timezone" className="form-control" style={{width:'200px'}} defaultValue={settings.timezone || 'Asia/Kolkata'}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div className="settings-item">
              <div className="si-info"><h4>Midnight Cutoff</h4><p>Auto-mark unpaid instalments at midnight</p></div>
              <select name="midnight_cutoff" className="form-control" style={{width:'200px'}} defaultValue={settings.midnight_cutoff || 'true'}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div className="settings-item">
              <div className="si-info"><h4>Allow Weekend Collection</h4><p>Enable collection entries on Saturdays and Sundays</p></div>
              <select name="allow_weekend_collection" className="form-control" style={{width:'200px'}} defaultValue={settings.allow_weekend_collection || 'false'}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <div style={{marginTop:'20px'}}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <span className="material-icons-outlined" style={{fontSize:'16px'}}>save</span> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* --- Modals --- */}
      
      {/* Route Modal */}
      <Modal isOpen={isRouteModalOpen} onClose={() => setIsRouteModalOpen(false)} title="Add New Route">
        <form action={async (fd) => { await createRoute(fd); setIsRouteModalOpen(false); showToast('Route created!'); }}>
          <div className="form-group">
            <label className="form-label">Route Name</label>
            <input type="text" name="name" className="form-control" required placeholder="e.g. Town Center" />
          </div>
          <div className="form-group">
            <label className="form-label">Assign Agent</label>
            <select name="assignedAgentId" className="form-control">
              <option value="">No Agent</option>
              {users.filter(u => u.role === 'agent').map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="form-actions" style={{marginTop:'20px'}}>
            <button type="submit" className="btn btn-primary">Create Route</button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsRouteModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Package Modal */}
      <Modal isOpen={isPackageModalOpen} onClose={() => setIsPackageModalOpen(false)} title="Create Loan Package">
        <form action={async (fd) => { await createLoanPackage(fd); setIsPackageModalOpen(false); showToast('Package created!'); }}>
          <div className="form-group">
            <label className="form-label">Package Name</label>
            <input type="text" name="name" className="form-control" required placeholder="e.g. Gold Loan 50K" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Principal Amount</label>
              <input type="number" name="principal" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">Deduction Amount</label>
              <input type="number" name="deduction" className="form-control" required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Deduction Type</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['fixed', 'percentage'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPackageDeductionType(type)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    border: packageDeductionType === type ? '2px solid var(--primary)' : '2px solid var(--border)',
                    background: packageDeductionType === type ? 'var(--primary-light)' : 'var(--bg)',
                    color: packageDeductionType === type ? 'var(--primary-dark)' : 'var(--text)',
                    fontWeight: packageDeductionType === type ? 700 : 400,
                  }}
                >
                  {type === 'fixed' ? `${currencySymbol} Fixed Amount` : '% Percentage'}
                </button>
              ))}
            </div>
            <input type="hidden" name="deductionType" value={packageDeductionType} />
            {packageDeductionType === 'percentage' && (
              <p style={{ marginTop: '6px', fontSize: '.75rem', color: 'var(--text-light)' }}>
                Enter deduction as a percent. The saved package stores the computed fixed amount.
              </p>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Frequency</label>
              <select name="frequency" className="form-control">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tenure (Count)</label>
              <input type="number" name="tenure" className="form-control" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Per Instalment</label>
              <input type="number" name="perInstalment" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">Penalty Rate</label>
              <input type="number" name="penaltyRate" className="form-control" required />
            </div>
          </div>
          <div className="form-actions" style={{marginTop:'20px'}}>
            <button type="submit" className="btn btn-primary">Create Package</button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsPackageModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* User Modal */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Add New User">
        <form action={async (fd) => { await createUser(fd); setIsUserModalOpen(false); showToast('User created!'); }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" name="name" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="tel" name="phone" className="form-control" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" name="username" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select name="role" className="form-control">
                <option value="agent">Field Agent</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" name="password" className="form-control" required />
          </div>
          <div className="form-actions" style={{marginTop:'20px'}}>
            <button type="submit" className="btn btn-primary">Create User</button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsUserModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* RouteAgent Modal */}
      {routeAgentModal && (
        <Modal isOpen={true} onClose={() => setRouteAgentModal(null)} title={`Assign Agent to ${routeAgentModal.routeName}`}>
          <div className="form-group">
            <label className="form-label">Select Agent</label>
            <select className="form-control" value={raAgentId} onChange={e => setRaAgentId(e.target.value)}>
              <option value="">Choose agent...</option>
              {users.filter(u => u.role === 'agent' && !routeAgentModal.agents.some((ra: any) => ra.agentId === u.id)).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="form-actions" style={{marginTop:'20px'}}>
            <button className="btn btn-primary" disabled={!raAgentId} onClick={async () => { if (!raAgentId) return; await assignAgentToRoute(routeAgentModal.routeId, raAgentId); setRouteAgentModal(null); window.location.reload(); }}>Assign</button>
            <button className="btn btn-ghost" onClick={() => setRouteAgentModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

    </div>
  );
}
