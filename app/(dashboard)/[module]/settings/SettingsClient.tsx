'use client';

import { useState } from 'react';
import { saveSystemSettings, savePenaltySettings, createRoute, deleteRoute, createLoanPackage, deleteLoanPackage, assignAgentToRoute, removeAgentFromRoute, setPrimaryAgent, generate2faSecret, verifyAndEnable2fa, disable2fa, importCustomers, importCollections, saveUpiQrCode, saveNotificationSettings, saveBureauSettings } from './actions';
import Modal from '@/components/Modal';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsClient({ 
  routes, packages, users, settings, currencySymbol, dict, currentUser, subscription, bureauCredential
}: { 
  routes: any[], packages: any[], users: any[], settings: Record<string, string>, currencySymbol: string, dict: any, currentUser: any, subscription: any, bureauCredential: any
}) {
  const d = dict.settings;
  const [activeTab, setActiveTab] = useState('routes');
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const modulePrefix = pathname.split('/')[1] || 'microlending';

  // Modals state
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [routeAgentModal, setRouteAgentModal] = useState<{ routeId: string; routeName: string; agents: any[] } | null>(null);
  const [raAgentId, setRaAgentId] = useState('');
  const [editingPrimaryRouteId, setEditingPrimaryRouteId] = useState<string | null>(null);
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
        {subscription?.whatsappSmsEnabled && (
          <div className={`tab ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>Notifications</div>
        )}
        <div className={`tab ${activeTab === 'bulk' ? 'active' : ''}`} onClick={() => setActiveTab('bulk')}>Bulk Tools</div>
        {subscription?.bureauEnabled && (
          <div className={`tab ${activeTab === 'bureau' ? 'active' : ''}`} onClick={() => setActiveTab('bureau')}>Bureau Connect</div>
        )}
        {subscription?.npaEnabled && (
          <div className={`tab ${activeTab === 'npa' ? 'active' : ''}`} onClick={() => setActiveTab('npa')}>NPA Classification</div>
        )}
        {currentUser?.role === 'developer' && (
          <div className={`tab ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>{d.tabSystem}</div>
        )}
        {currentUser?.role === 'superadmin' && (
          <div className={`tab ${activeTab === 'data' ? 'active' : ''}`} style={{color: 'var(--danger)'}} onClick={() => setActiveTab('data')}>Data Management</div>
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
                  <td>
                    {editingPrimaryRouteId === r.id ? (
                      <select
                        className="form-control"
                        style={{ width: '150px', padding: '4px 8px', fontSize: '.82rem' }}
                        defaultValue={r.assignedAgentId || ''}
                        autoFocus
                        onBlur={() => setEditingPrimaryRouteId(null)}
                        onChange={async (e) => {
                          const val = e.target.value;
                          await setPrimaryAgent(r.id, val || null);
                          setEditingPrimaryRouteId(null);
                          window.location.reload();
                        }}
                      >
                        <option value="">{d.unassigned}</option>
                        {users.filter(u => u.role === 'agent').map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Click to change primary agent"
                        onClick={() => setEditingPrimaryRouteId(r.id)}
                      >
                        {r.assignedAgent?.name ? (
                          <><span style={{ fontWeight: 600 }}>{r.assignedAgent.name}</span><span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--text-light)' }}>edit</span></>
                        ) : (
                          <><span style={{ color: 'var(--text-light)' }}>{d.unassigned}</span><span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--primary)' }}>person_add</span></>
                        )}
                      </span>
                    )}
                  </td>
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
          {subscription?.receiptPdfAllowed && (
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px', marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '8px' }}>📄 Payment Receipt PDF</h4>
              <p style={{ fontSize: '.8rem', color: 'var(--text-light)', marginBottom: '12px' }}>
                Allow downloading of A5 branded collection receipt PDFs and customer account statement PDFs.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  name="receipt_pdf_active" 
                  value="true" 
                  defaultChecked={settings.receipt_pdf_active === 'true'} 
                />
                <strong>Enable Receipt & Statement PDFs</strong>
              </label>
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <span className="material-icons-outlined" style={{fontSize:'16px'}}>save</span> {loading ? d.saving : d.save}
          </button>
        </form>
      </div>

      {/* Notifications Tab */}
      {subscription?.whatsappSmsEnabled && (
        <div className={`tab-content ${activeTab === 'notifications' ? 'active' : ''}`}>
          <div className="card-header">
            <h3>🔔 Automated SMS & WhatsApp Notifications</h3>
          </div>
          <form action={async (fd) => { 
            setLoading(true); 
            await saveNotificationSettings(fd); 
            setLoading(false); 
            showToast('Notification settings saved'); 
          }} style={{ maxWidth: '500px' }}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                Toggle automatic SMS and WhatsApp alerts to borrowers. SMS messages are sent immediately. WhatsApp templates are triggered if configured and approved on MSG91.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  name="whatsapp_sms_active" 
                  value="true" 
                  defaultChecked={settings.whatsapp_sms_active !== 'false'} 
                />
                <strong>Enable Automated Notifications</strong>
              </label>
              <span style={{ fontSize: '.75rem', color: 'var(--text-light)', marginTop: '6px', display: 'block' }}>
                If unchecked, no SMS or WhatsApp notifications will be sent to borrowers.
              </span>
            </div>

            <div style={{ marginBottom: '25px', padding: '16px', background: 'var(--primary-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-dark)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>list_alt</span>
                Notification Audit Trails
              </h4>
              <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '12px' }}>
                View the detailed logs of all notifications sent, failed, or pending.
              </p>
              <Link 
                href={`/${modulePrefix}/notifications/log`} 
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>history</span>
                View Notification Logs
              </Link>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>save</span> {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}

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

      {/* Data Management Tab */}
      <div className={`tab-content ${activeTab === 'data' ? 'active' : ''}`}>
        <div className="card-header">
          <h3 style={{ color: 'var(--danger)' }}>⚠️ Danger Zone: Database Management</h3>
        </div>
        <div style={{ maxWidth: '800px' }}>
          <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
            Warning: The actions below will permanently delete data from the database. This cannot be undone. System settings, users, and branches are preserved.
          </p>

          <div className="settings-item" style={{ border: '1px solid var(--border)', padding: '20px', borderRadius: 'var(--radius)', marginBottom: '20px', background: 'var(--bg)' }}>
            <div className="si-info" style={{ marginBottom: '16px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>download_for_offline</span>
                Database Backup (Excel / CSV)
              </h4>
              <p>Download a complete backup of all database tables (Customers, Loans, Accounting, Routes) to an Excel-compatible CSV spreadsheet before performing a wipe or for regular archiving.</p>
            </div>
            <div>
              <a href="/api/backup/export" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }} download>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>download</span>
                Download Excel Backup
              </a>
            </div>
          </div>

          <div className="settings-item" style={{ border: '1px solid var(--danger)', padding: '20px', borderRadius: 'var(--radius)', background: 'rgba(231, 76, 60, 0.05)' }}>
            <div className="si-info" style={{ marginBottom: '16px' }}>
              <h4 style={{ color: 'var(--danger)' }}>Wipe Transactional Data</h4>
              <p>Select the data modules you wish to permanently delete.</p>
            </div>
            <form action={async (fd) => {
              const tables = fd.getAll('tables') as string[];
              if (tables.length === 0) {
                alert('Please select at least one data module to wipe.');
                return;
              }
              if (confirm(`Are you absolutely sure you want to permanently delete the selected data modules? This action is irreversible.`)) {
                setLoading(true);
                const { wipeDatabaseRecords } = await import('./actions');
                const res = await wipeDatabaseRecords(tables);
                setLoading(false);
                if (res.success) {
                  alert('Data successfully wiped.');
                  window.location.reload();
                } else {
                  alert('Failed to wipe data: ' + res.error);
                }
              }
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="loans" />
                  <strong>Loans & Payments</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>(Loans, Instalments, Penalties, Collections)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="customers" />
                  <strong>Customers & Guarantors</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>(Profiles, KYC, Vehicles, Cheques)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="accounting" />
                  <strong>Accounting</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>(Capital Entries, Expenses, Adjustments)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="agents" />
                  <strong style={{ color: 'var(--warning)' }}>Agents Only</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>(Delete all agents and their collections)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="admins" />
                  <strong style={{ color: 'var(--danger)' }}>Admins Only</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>(Delete all admin users)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="agents_routes" />
                  <strong>Agents & Routes</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>(All agents, Routes, Route Assignments, Collections)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="approvals" />
                  <strong>Approvals & Audit Logs</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>(Pending requests, Action history)</span>
                </label>
              </div>
              <button type="submit" className="btn btn-danger" disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>delete_forever</span> 
                {loading ? 'Wiping Data...' : 'Permanently Delete Selected'}
              </button>
            </form>
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

      {/* Bureau Connect Tab */}
      {subscription?.bureauEnabled && (
        <div className={`tab-content ${activeTab === 'bureau' ? 'active' : ''}`}>
          <div className="card-header">
            <h3>🏦 Credit Bureau Connect Settings</h3>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
            {/* Settings Form */}
            <form action={async (fd) => {
              setLoading(true);
              const res = await saveBureauSettings(fd);
              setLoading(false);
              if (res.success) {
                showToast("Bureau credentials saved successfully!");
                window.location.reload();
              } else {
                alert(res.error || "Failed to save settings.");
              }
            }} style={{ maxWidth: '600px' }}>
              
              <div className="form-group">
                <label className="form-label">Bureau Provider</label>
                <select name="provider" className="form-control" defaultValue={bureauCredential?.provider || 'CRIF'}>
                  <option value="CRIF">CRIF High Mark (MFI focus)</option>
                  <option value="CIBIL">TransUnion CIBIL (Consumer focus)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Environment</label>
                <select name="environment" className="form-control" defaultValue={bureauCredential?.environment || 'sandbox'}>
                  <option value="sandbox">Sandbox (Testing / Mock Data)</option>
                  <option value="production">Production (Live Bureau API)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Member ID / Reference Number</label>
                <input 
                  type="text" 
                  name="memberId" 
                  className="form-control" 
                  defaultValue={bureauCredential?.memberId || ''} 
                  required 
                  placeholder="e.g. MFI000001"
                />
              </div>

              <div className="form-group">
                <label className="form-label">API Key / User ID</label>
                <input 
                  type="password" 
                  name="apiKey" 
                  className="form-control" 
                  defaultValue={bureauCredential?.apiKey || ''} 
                  required
                  placeholder="e.g. api_user_xxx"
                />
              </div>

              <div className="form-group">
                <label className="form-label">API Secret / Password (Optional)</label>
                <input 
                  type="password" 
                  name="apiSecret" 
                  className="form-control" 
                  defaultValue={bureauCredential?.apiSecret || ''}
                  placeholder="e.g. secret_pass_xxx"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">SSL Client Certificate (.pem)</label>
                  <input type="file" name="bureauCert" accept=".pem" className="form-control" />
                  <span style={{ fontSize: '.75rem', color: bureauCredential?.hasCert ? 'var(--success)' : 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                    {bureauCredential?.hasCert ? '✅ Client SSL Certificate has been uploaded.' : '❌ No SSL Certificate uploaded yet.'}
                  </span>
                </div>
                
                <div className="form-group">
                  <label className="form-label">SSL Private Key (.pem)</label>
                  <input type="file" name="bureauKey" accept=".pem" className="form-control" />
                  <span style={{ fontSize: '.75rem', color: bureauCredential?.hasKey ? 'var(--success)' : 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                    {bureauCredential?.hasKey ? '✅ Client Private Key has been uploaded.' : '❌ No Private Key uploaded yet.'}
                  </span>
                </div>
              </div>

              <div className="form-group" style={{ margin: '16px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    name="isActive" 
                    value="true" 
                    defaultChecked={bureauCredential?.isActive !== false} 
                  />
                  <strong>Enable Bureau Pulls</strong>
                </label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>save</span> {loading ? 'Saving...' : 'Save Bureau Credentials'}
              </button>
            </form>

            {/* Checklist Guide */}
            <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }}>
              <h4 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>help_outline</span>
                Go-Live Checklist
              </h4>
              <ol style={{ paddingLeft: '16px', fontSize: '.85rem', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-secondary)' }}>
                <li>
                  <strong>Obtain CIC License:</strong> Secure a Credit Information Company license from RBI.
                </li>
                <li>
                  <strong>Apply to CRIF/CIBIL:</strong> Apply independently for a Member ID and request "Ecosystem Sandbox Integration".
                </li>
                <li>
                  <strong>Whitelist VPS Static IP:</strong> Request CRIF support to whitelist your VPS egress IP:
                  <div style={{ margin: '6px 0', padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600, display: 'inline-block' }}>
                    195.12.34.56 {/* Replace with VPS Egress IP details */}
                  </div>
                </li>
                <li>
                  <strong>Upload SSL Certificates:</strong> Input Member ID, API key/secret, and upload PEM Client Certificate & Private Key issued by the bureau.
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* NPA Classification Tab */}
      {subscription?.npaEnabled && (
        <div className={`tab-content ${activeTab === 'npa' ? 'active' : ''}`}>
          <div className="card-header">
            <h3>📊 NPA Classification Engine (RBI IRACP)</h3>
          </div>
          <div style={{ maxWidth: '700px' }}>
            <div style={{ padding: '16px', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-outlined" style={{ color: 'var(--success)', fontSize: '20px' }}>check_circle</span>
                Module Active
              </h4>
              <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                NPA Classification Engine is running on a daily automated schedule. All active and overdue loans are automatically classified
                into RBI-compliant asset categories: Standard → SMA-0 → SMA-1 → SMA-2 → Sub-Standard → Doubtful (D1/D2/D3) → Loss.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '.85rem' }}>
                <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <strong>Classification Schedule</strong>
                  <p style={{ color: 'var(--text-light)', margin: '4px 0 0' }}>Daily at 2:00 AM IST (after penalty accrual)</p>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <strong>Provisioning Basis</strong>
                  <p style={{ color: 'var(--text-light)', margin: '4px 0 0' }}>RBI Master Circular IRACP 2023</p>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '12px' }}>RBI Provisioning Rates</h4>
              <table style={{ width: '100%', fontSize: '.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Overdue Days</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Provisioning %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td style={{ padding: '6px 8px' }}>Standard</td><td style={{ padding: '6px 8px' }}>0</td><td style={{ padding: '6px 8px', textAlign: 'right' }}>0.40%</td></tr>
                  <tr style={{ background: 'var(--bg-alt)' }}><td style={{ padding: '6px 8px' }}>SMA-0 / SMA-1 / SMA-2</td><td style={{ padding: '6px 8px' }}>1–90</td><td style={{ padding: '6px 8px', textAlign: 'right' }}>0.40%</td></tr>
                  <tr><td style={{ padding: '6px 8px', color: 'var(--warning)' }}>Sub-Standard</td><td style={{ padding: '6px 8px' }}>91–365</td><td style={{ padding: '6px 8px', textAlign: 'right' }}>15%</td></tr>
                  <tr style={{ background: 'var(--bg-alt)' }}><td style={{ padding: '6px 8px', color: 'var(--danger)' }}>Doubtful D1</td><td style={{ padding: '6px 8px' }}>NPA 12–24 mo</td><td style={{ padding: '6px 8px', textAlign: 'right' }}>100% (unsecured)</td></tr>
                  <tr><td style={{ padding: '6px 8px', color: 'var(--danger)' }}>Doubtful D2</td><td style={{ padding: '6px 8px' }}>NPA 24–36 mo</td><td style={{ padding: '6px 8px', textAlign: 'right' }}>100% (unsecured)</td></tr>
                  <tr style={{ background: 'var(--bg-alt)' }}><td style={{ padding: '6px 8px', color: 'var(--danger)' }}>Doubtful D3 / Loss</td><td style={{ padding: '6px 8px' }}>NPA 36+ mo</td><td style={{ padding: '6px 8px', textAlign: 'right' }}>100%</td></tr>
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>
              NPA history and provisioning snapshots are immutable records maintained for RBI inspection readiness.
              Classification changes are visible on each loan&apos;s detail page.
            </p>
          </div>
        </div>
      )}

      {/* --- Modals --- */}
      
      {/* Route Modal */}
      <Modal isOpen={isRouteModalOpen} onClose={() => setIsRouteModalOpen(false)} title={d.addNewRoute}>
        <form action={async (fd) => { await createRoute(fd); setIsRouteModalOpen(false); showToast(d.routeCreated); }}>
          <div className="form-group">
            <label className="form-label">{d.routeName}</label>
            <input type="text" name="name" className="form-control" required placeholder="e.g. Town Center" />
          </div>
          <div className="form-group">
            <label className="form-label">{d.primaryAgent}</label>
            <select name="primaryAgentId" className="form-control">
              <option value="">{d.unassigned}</option>
              {users.filter(u => u.role === 'agent').map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <span style={{ fontSize: '.75rem', color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>The main agent responsible for this route.</span>
          </div>
          <div className="form-group">
            <label className="form-label">{d.sharedAgents}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius-sm)', maxHeight: '150px', overflowY: 'auto', background: 'var(--bg)' }}>
              {users.filter(u => u.role === 'agent').length === 0 ? (
                <span style={{ fontSize: '.85rem', color: 'var(--text-light)' }}>No agents available</span>
              ) : (
                users.filter(u => u.role === 'agent').map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '.9rem' }}>
                    <input type="checkbox" name="agentIds" value={u.id} />
                    {u.name}
                  </label>
                ))
              )}
            </div>
            <span style={{ fontSize: '.75rem', color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>Additional agents who can also collect on this route.</span>
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
