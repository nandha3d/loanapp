'use client';

import { useState } from 'react';
import { saveSystemSettings, savePenaltySettings, createRoute, deleteRoute, createLoanPackage, deleteLoanPackage, createUser, assignAgentToRoute, removeAgentFromRoute, generate2faSecret, verifyAndEnable2fa, disable2fa, importCustomers, importCollections, saveUpiQrCode } from './actions';
import Modal from '@/components/Modal';

export default function SettingsClient({ 
  routes, packages, users, settings, currencySymbol, dict, currentUser
}: { 
  routes: any[], packages: any[], users: any[], settings: Record<string, string>, currencySymbol: string, dict: any, currentUser: any
}) {
  const d = dict.settings;
  const [activeTab, setActiveTab] = useState('routes');
  const [loading, setLoading] = useState(false);

  // Modals state
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [routeAgentModal, setRouteAgentModal] = useState<{ routeId: string; routeName: string; agents: any[] } | null>(null);
  const [raAgentId, setRaAgentId] = useState('');
  const [packageDeductionType, setPackageDeductionType] = useState<'fixed' | 'percentage'>('fixed');

  // 2FA state
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [tempSecret, setTempSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isEnabling, setIsEnabling] = useState(false);

  const showToast = (msg: string) => {
    alert(msg); 
  };

  const handleSystemSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    await saveSystemSettings(new FormData(e.currentTarget));
    setLoading(false);
    showToast(d.systemSaved);
  };

  const handlePenaltySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    await savePenaltySettings(new FormData(e.currentTarget));
    setLoading(false);
    showToast(d.penaltySaved);
  };

  return (
    <div className="card">
      <div className="tabs">
        <div className={`tab ${activeTab === 'routes' ? 'active' : ''}`} onClick={() => setActiveTab('routes')}>{d.tabRoutes}</div>
        <div className={`tab ${activeTab === 'penalty' ? 'active' : ''}`} onClick={() => setActiveTab('penalty')}>{d.tabPenalty}</div>
        <div className={`tab ${activeTab === 'packages' ? 'active' : ''}`} onClick={() => setActiveTab('packages')}>{d.tabPackages}</div>
        <div className={`tab ${activeTab === 'payment' ? 'active' : ''}`} onClick={() => setActiveTab('payment')}>Payment</div>
        <div className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>{d.tabUsers}</div>
        <div className={`tab ${activeTab === 'bulk' ? 'active' : ''}`} onClick={() => setActiveTab('bulk')}>Bulk Tools</div>
        {currentUser?.role === 'developer' && (
          <div className={`tab ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>{d.tabSystem}</div>
        )}
        <div className={`tab ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>Security</div>
      </div>

      {/* Routes Tab */}
      <div className={`tab-content ${activeTab === 'routes' ? 'active' : ''}`}>
        <div className="card-header">
          <h3>🗺️ {d.routesTitle}</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setIsRouteModalOpen(true)}>
            <span className="material-icons-outlined" style={{fontSize:'14px'}}>add</span> {d.addRoute}
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>{d.routeName}</th><th>{d.primaryAgent}</th><th>{d.sharedAgents}</th><th>{d.customers}</th><th>{d.actions}</th></tr></thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.assignedAgent?.name || <span style={{color:'var(--text-light)'}}>{d.unassigned}</span>}</td>
                  <td>
                    <div style={{display:'flex', flexWrap:'wrap', gap:'4px'}}>
                      {(r.routeAgents || []).map((ra: any) => (
                        <span key={ra.agentId} style={{display:'inline-flex', alignItems:'center', gap:'3px', background:'var(--bg-muted)', borderRadius:'var(--radius-sm)', padding:'2px 6px', fontSize:'.72rem'}}>
                          {ra.agent?.name}
                          <button style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-light)', fontSize:'12px', lineHeight:1, padding:'0 1px'}} title="Remove" onClick={async () => { if(confirm(d.removeAgent)) { await removeAgentFromRoute(r.id, ra.agentId); window.location.reload(); } }}>✕</button>
                        </span>
                      ))}
                      <button className="btn btn-ghost btn-sm" style={{fontSize:'.7rem', padding:'2px 6px'}} onClick={() => { setRouteAgentModal({ routeId: r.id, routeName: r.name, agents: r.routeAgents || [] }); setRaAgentId(''); }}>
                        <span className="material-icons-outlined" style={{fontSize:'12px'}}>person_add</span>
                      </button>
                    </div>
                  </td>
                  <td>{r._count.customers}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={() => { if(confirm(d.deleteRoute)) deleteRoute(r.id); }}>{d.delete}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Penalty Tab */}
      <div className={`tab-content ${activeTab === 'penalty' ? 'active' : ''}`}>
        <div className="card-header"><h3>⚡ {d.penaltyTitle}</h3></div>
        <form onSubmit={handlePenaltySubmit} style={{maxWidth:'500px'}}>
          <div className="form-group">
            <label className="form-label">{d.defaultPenaltyPerDay} ({currencySymbol})</label>
            <input type="number" name="default_penalty_per_day" className="form-control" defaultValue={settings.default_penalty_per_day || '50'} required />
          </div>
          <div className="form-group">
            <label className="form-label">{d.gracePeriod}</label>
            <input type="number" name="penalty_grace_period" className="form-control" defaultValue={settings.penalty_grace_period || '0'} required />
          </div>
          <div className="form-group">
            <label className="form-label">{d.maxPenaltyCap} ({currencySymbol})</label>
            <input type="number" name="penalty_max_cap" className="form-control" defaultValue={settings.penalty_max_cap || '0'} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <span className="material-icons-outlined" style={{fontSize:'16px'}}>save</span> {loading ? d.saving : d.save}
          </button>
        </form>
      </div>

      {/* Packages Tab */}
      <div className={`tab-content ${activeTab === 'packages' ? 'active' : ''}`}>
        <div className="card-header">
          <h3>📦 {d.packagesTitle}</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setIsPackageModalOpen(true)}>
            <span className="material-icons-outlined" style={{fontSize:'14px'}}>add</span> {d.createPackage}
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>{d.packageName}</th><th>{d.principal}</th><th>{d.deduction}</th><th>{d.frequency}</th><th>{d.tenure}</th><th>{d.perInstalment}</th><th>{d.actions}</th></tr></thead>
            <tbody>
              {packages.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{currencySymbol}{Number(p.principal).toLocaleString()}</td>
                  <td>{currencySymbol}{Number(p.deduction).toLocaleString()}</td>
                  <td style={{textTransform:'capitalize'}}>{p.frequency}</td>
                  <td>{p.tenure} {p.frequency === 'daily' ? d.daysSuffix : p.frequency === 'weekly' ? d.weeksSuffix : d.monthsSuffix}</td>
                  <td>{currencySymbol}{Number(p.perInstalment).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm">{d.edit}</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={() => { if(confirm(d.deletePackage)) deleteLoanPackage(p.id); }}>{d.delete}</button>
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
          <h3>👥 {d.usersTitle}</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setIsUserModalOpen(true)}>
            <span className="material-icons-outlined" style={{fontSize:'14px'}}>person_add</span> {d.addUser}
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>{d.user}</th><th>{d.phone}</th><th>{d.role}</th><th>{d.status}</th><th>{d.actions}</th></tr></thead>
            <tbody>
              {users.filter(u => u.role !== 'developer' || currentUser?.role === 'developer').map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong><br/><span style={{fontSize:'.72rem',color:'var(--text-light)'}}>{u.username}</span></td>
                  <td>{u.phone}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-active' : 'badge-pending'}`} style={{textTransform:'capitalize'}}>{u.role}</span>
                  </td>
                  <td><span className={`badge ${u.status === 'active' ? 'badge-active' : 'badge-closed'}`} style={{textTransform:'capitalize'}}>{u.status}</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm">{d.edit}</button>
                    {u.role !== 'admin' && <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}}>{d.deactivate}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Tab */}
      {currentUser?.role === 'developer' && (
        <div className={`tab-content ${activeTab === 'system' ? 'active' : ''}`}>
          <div className="card-header"><h3>⚙️ {d.systemTitle}</h3></div>
          <form onSubmit={handleSystemSubmit}>
            <div className="settings-list" style={{maxWidth:'600px'}}>
              <div className="settings-item">
                <div className="si-info"><h4>{d.appName}</h4><p>{d.appNameDesc}</p></div>
                <input type="text" name="app_name" className="form-control" style={{width:'200px'}} defaultValue={settings.app_name || 'LoanTrack'} required />
              </div>
              <div className="settings-item">
                <div className="si-info"><h4>{d.currency}</h4><p>{d.currencyDesc}</p></div>
                <input type="text" name="currency" className="form-control" style={{width:'200px'}} defaultValue={settings.currency || 'INR'} required />
              </div>
              <div className="settings-item">
                <div className="si-info"><h4>{d.currencySymbol}</h4><p>{d.currencySymbolDesc}</p></div>
                <input type="text" name="currency_symbol" className="form-control" style={{width:'200px'}} defaultValue={settings.currency_symbol || '₹'} required />
              </div>
              <div className="settings-item">
                <div className="si-info"><h4>{d.timezone}</h4><p>{d.timezoneDesc}</p></div>
                <select name="timezone" className="form-control" style={{width:'200px'}} defaultValue={settings.timezone || 'Asia/Kolkata'}>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div className="settings-item">
                <div className="si-info"><h4>{d.midnightCutoff}</h4><p>{d.midnightCutoffDesc}</p></div>
                <select name="midnight_cutoff" className="form-control" style={{width:'200px'}} defaultValue={settings.midnight_cutoff || 'true'}>
                  <option value="true">{d.enabled}</option>
                  <option value="false">{d.disabled}</option>
                </select>
              </div>
              <div className="settings-item">
                <div className="si-info"><h4>{d.allowWeekendCollection}</h4><p>{d.allowWeekendDesc}</p></div>
                <select name="allow_weekend_collection" className="form-control" style={{width:'200px'}} defaultValue={settings.allow_weekend_collection || 'false'}>
                  <option value="true">{d.yes}</option>
                  <option value="false">{d.no}</option>
                </select>
              </div>
              <div style={{borderTop:'1px solid var(--border)', paddingTop:'20px', marginTop:'12px'}}>
                <h4 style={{fontSize:'.95rem', fontWeight:700, marginBottom:'12px'}}>📝 Loan Code Prefixes</h4>
                <p style={{fontSize:'.8rem', color:'var(--text-light)', marginBottom:'16px'}}>Customize the prefix used for loan codes based on repayment frequency.</p>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                  <div className="settings-item" style={{flexDirection:'column', alignItems:'flex-start', gap:'4px'}}>
                    <label className="form-label" style={{fontSize:'.8rem', margin:0}}>Daily Prefix</label>
                    <input type="text" name="loan_prefix_daily" className="form-control" style={{width:'100px'}} defaultValue={settings.loan_prefix_daily || 'DL'} maxLength={4} />
                  </div>
                  <div className="settings-item" style={{flexDirection:'column', alignItems:'flex-start', gap:'4px'}}>
                    <label className="form-label" style={{fontSize:'.8rem', margin:0}}>Weekly Prefix</label>
                    <input type="text" name="loan_prefix_weekly" className="form-control" style={{width:'100px'}} defaultValue={settings.loan_prefix_weekly || 'WK'} maxLength={4} />
                  </div>
                  <div className="settings-item" style={{flexDirection:'column', alignItems:'flex-start', gap:'4px'}}>
                    <label className="form-label" style={{fontSize:'.8rem', margin:0}}>Bi-Weekly Prefix</label>
                    <input type="text" name="loan_prefix_biweekly" className="form-control" style={{width:'100px'}} defaultValue={settings.loan_prefix_biweekly || 'BW'} maxLength={4} />
                  </div>
                  <div className="settings-item" style={{flexDirection:'column', alignItems:'flex-start', gap:'4px'}}>
                    <label className="form-label" style={{fontSize:'.8rem', margin:0}}>Monthly Prefix</label>
                    <input type="text" name="loan_prefix_monthly" className="form-control" style={{width:'100px'}} defaultValue={settings.loan_prefix_monthly || 'ML'} maxLength={4} />
                  </div>
                </div>
              </div>
            </div>
            <div style={{marginTop:'20px'}}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <span className="material-icons-outlined" style={{fontSize:'16px'}}>save</span> {loading ? d.saving : d.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Tools Tab */}

      {/* Payment / UPI Tab */}
      <div className={`tab-content ${activeTab === 'payment' ? 'active' : ''}`}>
        <div className="card-header"><h3>💳 Payment Settings</h3></div>
        <form action={async (fd) => { await saveUpiQrCode(fd); showToast('Payment settings saved'); }} style={{maxWidth:'500px'}}>
          <div className="form-group">
            <label className="form-label">UPI ID</label>
            <input type="text" name="upiId" className="form-control" defaultValue={settings.upi_id || ''} placeholder="e.g. business@ybl" />
            <span style={{fontSize:'.75rem', color:'var(--text-light)', marginTop:'4px', display:'block'}}>This UPI ID will be shown to customers for payment.</span>
          </div>
          <div className="form-group">
            <label className="form-label">UPI QR Code Image</label>
            {settings.upi_qr_url && (
              <div style={{marginBottom:'12px', padding:'12px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', background:'#fff', display:'inline-block'}}>
                <img src={settings.upi_qr_url} alt="UPI QR Code" style={{width:'180px', height:'180px', objectFit:'contain'}} />
              </div>
            )}
            <input type="file" name="upiQrCode" accept="image/*" className="form-control" />
            <span style={{fontSize:'.75rem', color:'var(--text-light)', marginTop:'4px', display:'block'}}>Upload a screenshot or image of your UPI QR code (max 5MB).</span>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <span className="material-icons-outlined" style={{fontSize:'16px'}}>save</span> {loading ? d.saving : d.save}
          </button>
        </form>
      </div>

      {/* Bulk Tools Tab */}
      <div className={`tab-content ${activeTab === 'bulk' ? 'active' : ''}`}>
        <div className="card-header"><h3>📦 Bulk Data Tools</h3></div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', maxWidth:'800px'}}>
          <div className="card" style={{padding:'20px', border:'1px solid var(--border)'}}>
            <h4>Import Customers</h4>
            <p style={{fontSize:'.85rem', color:'var(--text-light)', marginBottom:'15px'}}>Upload a JSON file with customer records.</p>
            <input type="file" accept=".json" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              try {
                const data = JSON.parse(text);
                const res = await importCustomers(data);
                alert(`Import complete: ${res.success} succeeded, ${res.failed} failed.`);
              } catch {
                alert('Invalid JSON file');
              }
            }} />
          </div>
          <div className="card" style={{padding:'20px', border:'1px solid var(--border)'}}>
            <h4>Import Collections</h4>
            <p style={{fontSize:'.85rem', color:'var(--text-light)', marginBottom:'15px'}}>Upload a JSON file with payment history.</p>
            <input type="file" accept=".json" disabled />
          </div>
        </div>
      </div>

      {/* Security Tab */}
      <div className={`tab-content ${activeTab === 'security' ? 'active' : ''}`}>
        <div className="card-header"><h3>🔒 Security & 2FA</h3></div>
        <div style={{maxWidth:'600px'}}>
          <p style={{marginBottom:'20px', color:'var(--text-secondary)'}}>
            Two-Factor Authentication (2FA) adds an extra layer of security to your account. 
            Once enabled, you will need to enter a code from your authenticator app (like Google Authenticator or Authy) to log in.
          </p>
          
          <div className="settings-item" style={{border:'1px solid var(--border)', padding:'20px', borderRadius:'var(--radius)'}}>
            <div className="si-info">
              <h4>Two-Factor Authentication</h4>
              <p>{currentUser?.totpSecret ? 'Status: ENABLED' : 'Status: DISABLED'}</p>
            </div>
            <div>
              {currentUser?.totpSecret ? (
                <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={async () => { if(confirm('Are you sure you want to disable 2FA?')) { await disable2fa(); window.location.reload(); } }}>
                  Disable 2FA
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={async () => {
                  const { secret, qrCodeUrl } = await generate2faSecret();
                  setTempSecret(secret);
                  setQrCode(qrCodeUrl);
                  setIs2faModalOpen(true);
                }}>
                  Enable 2FA
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- Modals --- */}
      
      {/* Route Modal */}
      <Modal isOpen={isRouteModalOpen} onClose={() => setIsRouteModalOpen(false)} title={d.addNewRoute}>
        <form action={async (fd) => { await createRoute(fd); setIsRouteModalOpen(false); showToast(d.routeCreated); }}>
          <div className="form-group">
            <label className="form-label">{d.routeName}</label>
            <input type="text" name="name" className="form-control" required placeholder="e.g. Town Center" />
          </div>
          <div className="form-group">
            <label className="form-label">{d.assignAgent}</label>
            <select name="assignedAgentId" className="form-control">
              <option value="">{d.noAgent}</option>
              {users.filter(u => u.role === 'agent').map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="form-actions" style={{marginTop:'20px'}}>
            <button type="submit" className="btn btn-primary">{d.createRoute}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsRouteModalOpen(false)}>{d.cancel}</button>
          </div>
        </form>
      </Modal>

      {/* Package Modal */}
      <Modal isOpen={isPackageModalOpen} onClose={() => setIsPackageModalOpen(false)} title={d.createLoanPackage}>
        <form action={async (fd) => { await createLoanPackage(fd); setIsPackageModalOpen(false); showToast(d.packageCreated); }}>
          <div className="form-group">
            <label className="form-label">{d.packageName}</label>
            <input type="text" name="name" className="form-control" required placeholder="e.g. Gold Loan 50K" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{d.principalAmount}</label>
              <input type="number" name="principal" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">{d.deductionAmount}</label>
              <input type="number" name="deduction" className="form-control" required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{d.deductionType}</label>
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
                  {type === 'fixed' ? `${currencySymbol} ${d.fixedAmount}` : `% ${d.percentage}`}
                </button>
              ))}
            </div>
            <input type="hidden" name="deductionType" value={packageDeductionType} />
            {packageDeductionType === 'percentage' && (
              <p style={{ marginTop: '6px', fontSize: '.75rem', color: 'var(--text-light)' }}>
                {d.enterPercent}
              </p>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{d.frequency}</label>
              <select name="frequency" className="form-control">
                <option value="daily">{d.daily}</option>
                <option value="weekly">{d.weekly}</option>
                <option value="monthly">{d.monthly}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{d.tenureCount}</label>
              <input type="number" name="tenure" className="form-control" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{d.perInstalment}</label>
              <input type="number" name="perInstalment" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">{d.penaltyRate}</label>
              <input type="number" name="penaltyRate" className="form-control" required />
            </div>
          </div>
          <div className="form-actions" style={{marginTop:'20px'}}>
            <button type="submit" className="btn btn-primary">{d.createPackage}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsPackageModalOpen(false)}>{d.cancel}</button>
          </div>
        </form>
      </Modal>

      {/* User Modal */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={d.addNewUser}>
        <form action={async (fd) => { await createUser(fd); setIsUserModalOpen(false); showToast(d.userCreated); }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{d.fullName}</label>
              <input type="text" name="name" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">{d.phone}</label>
              <input type="tel" name="phone" className="form-control" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{d.username}</label>
              <input type="text" name="username" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">{d.role}</label>
              <select name="role" className="form-control">
                <option value="agent">{d.fieldAgent}</option>
                <option value="admin">{d.administrator}</option>
                {currentUser?.role === 'developer' && (
                  <option value="developer">Developer</option>
                )}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{d.password}</label>
            <input type="password" name="password" className="form-control" required />
          </div>
          <div className="form-actions" style={{marginTop:'20px'}}>
            <button type="submit" className="btn btn-primary">{d.createUser}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsUserModalOpen(false)}>{d.cancel}</button>
          </div>
        </form>
      </Modal>

      {/* RouteAgent Modal */}
      {routeAgentModal && (
        <Modal isOpen={true} onClose={() => setRouteAgentModal(null)} title={`${d.assignAgentTo} ${routeAgentModal.routeName}`}>
          <div className="form-group">
            <label className="form-label">{d.selectAgent}</label>
            <select className="form-control" value={raAgentId} onChange={e => setRaAgentId(e.target.value)}>
              <option value="">{d.chooseAgent}</option>
              {users.filter(u => u.role === 'agent' && !routeAgentModal.agents.some((ra: any) => ra.agentId === u.id)).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="form-actions" style={{marginTop:'20px'}}>
            <button className="btn btn-primary" disabled={!raAgentId} onClick={async () => { if (!raAgentId) return; await assignAgentToRoute(routeAgentModal.routeId, raAgentId); setRouteAgentModal(null); window.location.reload(); }}>{d.assign}</button>
            <button className="btn btn-ghost" onClick={() => setRouteAgentModal(null)}>{d.cancel}</button>
          </div>
        </Modal>
      )}

      {/* 2FA Modal */}
      <Modal isOpen={is2faModalOpen} onClose={() => setIs2faModalOpen(false)} title="Enable Two-Factor Authentication">
        <div style={{textAlign:'center'}}>
          <p style={{marginBottom:'15px', fontSize:'.9rem'}}>Scan this QR code with your authenticator app:</p>
          {qrCode && <img src={qrCode} alt="QR Code" style={{width:'200px', height:'200px', margin:'0 auto 15px', border:'8px solid #fff', borderRadius:'var(--radius)'}} />}
          <p style={{fontSize:'.8rem', color:'var(--text-light)', marginBottom:'20px'}}>Secret Key: <code>{tempSecret}</code></p>
          
          <div className="form-group" style={{textAlign:'left'}}>
            <label className="form-label">Enter 6-digit code from app</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="000000" 
              maxLength={6} 
              value={totpCode} 
              onChange={e => setTotpCode(e.target.value)}
            />
          </div>
          
          <div className="form-actions" style={{marginTop:'20px'}}>
            <button className="btn btn-primary" style={{width:'100%'}} disabled={totpCode.length !== 6 || isEnabling} onClick={async () => {
              setIsEnabling(true);
              const res = await verifyAndEnable2fa(tempSecret, totpCode);
              if (res.success) {
                window.location.reload();
              } else {
                alert(res.error);
                setIsEnabling(false);
              }
            }}>
              {isEnabling ? 'Verifying...' : 'Verify & Enable'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
