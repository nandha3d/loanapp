'use client';

import { useState } from 'react';
import { saveSystemSettings, savePenaltySettings, createRoute, deleteRoute, createLoanPackage, deleteLoanPackage, assignAgentToRoute, removeAgentFromRoute, setPrimaryAgent, generate2faSecret, verifyAndEnable2fa, disable2fa, importCustomers, importCollections, saveUpiQrCode, saveNotificationSettings, saveBureauSettings, saveThemeSettings, saveNotificationTemplate } from './actions';
import { THEME_PRESETS, THEME_SETTING_KEY } from '@/lib/themes';
import Modal from '@/components/Modal';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { manageBranchAgent, setBranchAgentStatus } from '../../../admin/actions';
import GoldMasterClient from './gold-master/GoldMasterClient';
import { isLendingAppType, normalizeSettingsTab } from '@/lib/moduleCapabilities';

export default function SettingsClient({
  routes, packages, users, settings, currencySymbol, dict, currentUser, subscription, bureauCredential,
  viewerRole, appType, branchAgents = [], manageBranchId = null, manageBranchName = null, goldMaster = null, goldConfig = null,
  notificationTemplates = []
}: {
  routes: any[], packages: any[], users: any[], settings: Record<string, string>, currencySymbol: string, dict: any, currentUser: any, subscription: any, bureauCredential: any,
  viewerRole?: string, appType?: string, branchAgents?: any[], manageBranchId?: string | null, manageBranchName?: string | null, goldMaster?: any, goldConfig?: any,
  notificationTemplates?: any[]
}) {
  const d = dict.settings;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const modulePrefix = pathname.split('/')[1] || 'microlending';
  const effAppType = appType || modulePrefix;
  const isLendingModule = isLendingAppType(effAppType);
  // Tab survives reloads via ?tab= (history.replaceState avoids a server round-trip).
  const [activeTab, setActiveTabState] = useState(() => normalizeSettingsTab(
    effAppType,
    searchParams.get('tab'),
    subscription || {},
  ));
  const [selectedEvent, setSelectedEvent] = useState('payment_received');
  const [selectedLang, setSelectedLang] = useState('en');
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  };
  const [loading, setLoading] = useState(false);

  // Scoped agent management (Users tab)
  const canManageAgents = viewerRole === 'admin' || viewerRole === 'superadmin' || viewerRole === 'developer';
  const [agentModal, setAgentModal] = useState<{
    id?: string;
    name: string;
    username: string;
    phone: string;
    email?: string | null;
    status: string;
    aadharNumber?: string | null;
    dob?: string | null;
    experience?: string | null;
    age?: number | null;
    bypassLoanApproval?: boolean;
    bypassCustomerApproval?: boolean;
    autoReleaseFloat?: boolean;
    feeConfirmationMandatory?: boolean;
  } | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);

  const submitAgent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAgentBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set('appType', effAppType);
    if (manageBranchId) fd.set('branchId', manageBranchId);
    if (agentModal?.id) fd.set('id', agentModal.id);
    const res = await manageBranchAgent(fd);
    setAgentBusy(false);
    if (res?.success) { setAgentModal(null); router.refresh(); }
    else alert(res?.error || 'Failed to save agent');
  };

  const toggleAgent = async (id: string, current: string) => {
    const next = current === 'active' ? 'inactive' : 'active';
    const res = await setBranchAgentStatus(id, next, effAppType);
    if (res?.success) router.refresh();
    else alert(res?.error || 'Failed to update status');
  };

  // Modals state
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [routeAgentModal, setRouteAgentModal] = useState<{ routeId: string; routeName: string; agents: any[] } | null>(null);
  const [raAgentId, setRaAgentId] = useState('');
  const [editingPrimaryRouteId, setEditingPrimaryRouteId] = useState<string | null>(null);
  const [packageDeductionType, setPackageDeductionType] = useState<'fixed' | 'percentage'>('fixed');

  // Theme state
  const [activeTheme, setActiveTheme] = useState(settings[THEME_SETTING_KEY] || 'default');
  const [themeBusy, setThemeBusy] = useState(false);
  const applyTheme = async (key: string) => {
    if (themeBusy || key === activeTheme) return;
    setThemeBusy(true);
    const res = await saveThemeSettings(key);
    setThemeBusy(false);
    if (res?.success) {
      setActiveTheme(key);
      // Recolour immediately — don't wait for the layout RSC round-trip.
      const preset = THEME_PRESETS.find((t) => t.key === key);
      const wrapper = document.querySelector('.app-layout') as HTMLElement | null;
      if (wrapper) {
        if (preset) {
          wrapper.style.setProperty('--primary', preset.primary);
          wrapper.style.setProperty('--primary-dark', preset.primaryDark);
          wrapper.style.setProperty('--primary-light', preset.primaryLight);
          wrapper.style.setProperty('--accent', preset.accent);
        } else {
          // Default → let the server-rendered per-module colours win again.
          wrapper.style.removeProperty('--primary');
          wrapper.style.removeProperty('--primary-dark');
          wrapper.style.removeProperty('--primary-light');
          wrapper.style.removeProperty('--accent');
        }
      }
      router.refresh();
    } else {
      alert(res?.error || 'Failed to save theme');
    }
  };

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
        {isLendingModule && (
          <>
            <div className={`tab ${activeTab === 'penalty' ? 'active' : ''}`} onClick={() => setActiveTab('penalty')}>{d.tabPenalty}</div>
            <div className={`tab ${activeTab === 'packages' ? 'active' : ''}`} onClick={() => setActiveTab('packages')}>{d.tabPackages}</div>
          </>
        )}
        {effAppType === 'goldloan' && (
          <div className={`tab ${activeTab === 'goldmaster' ? 'active' : ''}`} onClick={() => setActiveTab('goldmaster')}>Gold Master</div>
        )}
        <div className={`tab ${activeTab === 'payment' ? 'active' : ''}`} onClick={() => setActiveTab('payment')}>{d.tabPayment}</div>
        <div className={`tab ${activeTab === 'integrations' ? 'active' : ''}`} onClick={() => setActiveTab('integrations')}>Integrations</div>
        {subscription?.whatsappSmsEnabled && (
          <div className={`tab ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>Notifications</div>
        )}
        <div className={`tab ${activeTab === 'bulk' ? 'active' : ''}`} onClick={() => setActiveTab('bulk')}>{d.tabBulk}</div>
        {isLendingModule && subscription?.bureauEnabled && (
          <div className={`tab ${activeTab === 'bureau' ? 'active' : ''}`} onClick={() => setActiveTab('bureau')}>Bureau Connect</div>
        )}
        {isLendingModule && subscription?.npaEnabled && (
          <div className={`tab ${activeTab === 'npa' ? 'active' : ''}`} onClick={() => setActiveTab('npa')}>NPA Classification</div>
        )}
        {currentUser?.role === 'developer' && (
          <div className={`tab ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>{d.tabSystem}</div>
        )}
        {(viewerRole === 'superadmin' || viewerRole === 'developer') && (
          <div className={`tab ${activeTab === 'theme' ? 'active' : ''}`} onClick={() => setActiveTab('theme')}>Theme</div>
        )}
        {currentUser?.role === 'superadmin' && (
          <div className={`tab ${activeTab === 'data' ? 'active' : ''}`} style={{color: 'var(--danger)'}} onClick={() => setActiveTab('data')}>{d.tabData}</div>
        )}
        {canManageAgents && (
          <div className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Agents</div>
        )}
        <div className={`tab ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>{d.tabSecurity}</div>
      </div>

      {/* Integrations Tab */}
      <div className={`tab-content ${activeTab === 'integrations' ? 'active' : ''}`}>
        <div className="card-header">
          <div>
            <h3>Third-party Add-on Integrations</h3>
            <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Configure e-NACH, Razorpay, MSG91, SMTP, Digio KYC, and bureau connection status from one secure screen.
            </p>
          </div>
          <Link href={`/${effAppType}/settings/integrations`} className="btn btn-primary btn-sm">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>hub</span>
            Open Integrations
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            ['account_balance', 'e-NACH Auto-Debit', 'Mandate timing, retries, and Razorpay readiness'],
            ['payments', 'Razorpay Gateway', 'Tenant-owned payment links and webhook setup'],
            ['sms', 'MSG91 Notifications', 'SMS and WhatsApp API credentials'],
            ['assignment_ind', 'KYC and Bureau', 'Digio KYC and credit bureau connection status'],
          ].map(([icon, title, body]) => (
            <div key={title} className="card" style={{ padding: 16, boxShadow: 'none', border: '1px solid var(--border)' }}>
              <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: 22 }}>{icon}</span>
              <h4 style={{ margin: '8px 0 4px' }}>{title}</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '.82rem' }}>{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Users (scoped agent management) Tab */}
      {canManageAgents && (
      <div className={`tab-content ${activeTab === 'users' ? 'active' : ''}`}>
        <div className="card-header">
          <div>
            <h3>👥 Agents</h3>
            <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {manageBranchName ? <>Branch <strong>{manageBranchName}</strong> · {effAppType} module</> : 'No branch available'}
            </p>
          </div>
          {manageBranchId && (
            <button className="btn btn-primary btn-sm" onClick={() => setAgentModal({ name: '', username: '', phone: '', email: '', status: 'active', aadharNumber: '', dob: '', experience: '', age: null, bypassLoanApproval: false, bypassCustomerApproval: false, autoReleaseFloat: false, feeConfirmationMandatory: false })}>
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span> Add Agent
            </button>
          )}
        </div>
        {!manageBranchId ? (
          <p style={{ padding: '16px', color: 'var(--text-secondary)' }}>No branch assigned. Ask a super admin to assign you to a branch.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Name</th><th>Username</th><th>Phone</th><th>Permissions</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {branchAgents.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.username}</td>
                    <td>{a.phone}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {a.bypassCustomerApproval && (
                          <span className="badge badge-info" style={{ fontSize: '10px', padding: '2px 8px' }} title="Bypass Customer Approval">Auto Customer</span>
                        )}
                        {a.bypassLoanApproval && (
                          <span className="badge badge-pending" style={{ fontSize: '10px', padding: '2px 8px' }} title="Bypass Loan Approval">Auto Loan</span>
                        )}
                        {a.autoReleaseFloat && (
                          <span className="badge" style={{ background: '#F3E8FF', color: '#7C3AED', fontSize: '10px', padding: '2px 8px' }} title="Auto-Release Float">Auto Disburse</span>
                        )}
                        {a.feeConfirmationMandatory && (
                          <span className="badge" style={{ background: '#FEF3C7', color: '#D97706', fontSize: '10px', padding: '2px 8px' }} title="Mandatory Customer Confirmation">Fee Confirm</span>
                        )}
                        {!a.bypassCustomerApproval && !a.bypassLoanApproval && !a.autoReleaseFloat && !a.feeConfirmationMandatory && (
                          <span style={{ color: 'var(--text-light)', fontSize: '.75rem' }}>Standard</span>
                        )}
                      </div>
                    </td>
                    <td><span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{a.status}</span></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setAgentModal({
                        id: a.id,
                        name: a.name,
                        username: a.username,
                        phone: a.phone,
                        email: a.email || '',
                        status: a.status,
                        aadharNumber: a.aadharNumber || '',
                        dob: a.dob ? new Date(a.dob).toISOString().split('T')[0] : '',
                        experience: a.experience || '',
                        age: a.age || null,
                        bypassLoanApproval: !!a.bypassLoanApproval,
                        bypassCustomerApproval: !!a.bypassCustomerApproval,
                        autoReleaseFloat: !!a.autoReleaseFloat,
                        feeConfirmationMandatory: !!a.feeConfirmationMandatory,
                      })}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleAgent(a.id, a.status)} style={{ color: a.status === 'active' ? 'var(--danger)' : 'var(--success)' }}>
                        {a.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {branchAgents.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)' }}>No agents yet. Add one.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      <Modal isOpen={!!agentModal} onClose={() => setAgentModal(null)} title={agentModal?.id ? 'Edit Agent' : 'Add Agent'}>
        <form onSubmit={submitAgent}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input name="name" className="form-control" defaultValue={agentModal?.name || ''} required />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input name="username" className="form-control" defaultValue={agentModal?.username || ''} required autoComplete="off" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input name="phone" className="form-control" defaultValue={agentModal?.phone || ''} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input name="email" type="email" className="form-control" defaultValue={agentModal?.email || ''} placeholder="Optional" />
          </div>
          <div className="form-group">
            <label className="form-label">{agentModal?.id ? 'New password (leave blank to keep)' : 'Password'}</label>
            <input name="password" type="password" className="form-control" autoComplete="new-password" {...(agentModal?.id ? {} : { required: true })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Aadhaar Number</label>
              <input name="aadharNumber" className="form-control" defaultValue={agentModal?.aadharNumber || ''} placeholder="Optional" />
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input name="dob" type="date" className="form-control" defaultValue={agentModal?.dob || ''} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Experience</label>
              <input name="experience" className="form-control" defaultValue={agentModal?.experience || ''} placeholder="e.g. 2 years, Optional" />
            </div>
            <div className="form-group">
              <label className="form-label">Age</label>
              <input name="age" type="number" className="form-control" defaultValue={agentModal?.age || ''} placeholder="Optional" />
            </div>
          </div>
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
                  defaultChecked={!!agentModal?.bypassCustomerApproval} 
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ fontSize: '.85rem', display: 'block' }}>Bypass Customer Approval</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>Allow agent to create active customers without admin review.</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  name="bypassLoanApproval" 
                  value="true" 
                  defaultChecked={!!agentModal?.bypassLoanApproval} 
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ fontSize: '.85rem', display: 'block' }}>Bypass Loan Approval</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>Allow agent to create active loans immediately.</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  name="autoReleaseFloat" 
                  value="true" 
                  defaultChecked={!!agentModal?.autoReleaseFloat} 
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ fontSize: '.85rem', display: 'block' }}>Auto-Release Float</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>Automatically disburse funds from agent float when loan is created/approved.</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  name="feeConfirmationMandatory" 
                  value="true" 
                  defaultChecked={!!agentModal?.feeConfirmationMandatory} 
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ fontSize: '.85rem', display: 'block' }}>Mandatory Customer Confirmation</strong>
                  <span style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>Require borrower to confirm cash collection before it reflects to admin dashboard.</span>
                </div>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select name="status" className="form-control" defaultValue={agentModal?.status || 'active'}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setAgentModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={agentBusy}>{agentBusy ? 'Saving…' : agentModal?.id ? 'Save' : 'Create Agent'}</button>
          </div>
        </form>
      </Modal>

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
                        title={d.clickToChangePrimary}
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
                          <button style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-light)', fontSize:'12px', lineHeight:1, padding:'0 1px'}} title={d.remove} onClick={async () => { if(confirm(d.removeAgent)) { await removeAgentFromRoute(r.id, ra.agentId); window.location.reload(); } }}>✕</button>
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
      {isLendingModule && (
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
      )}

      {/* Packages Tab */}
      {isLendingModule && (
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
      )}

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
              <div className="settings-item" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                <div className="si-info">
                  <h4>Identity Verification (KYC) Method</h4>
                  <p>Choose the KYC verification method for customers. Digio integration requires active credentials.</p>
                </div>
                <div style={{ width: '200px' }}>
                  <select 
                    name="kyc_method" 
                    className="form-control" 
                    defaultValue={settings.kyc_method || 'manual_upload'}
                    disabled={!subscription?.kycEnabled}
                  >
                    <option value="manual_upload">Manual Document Upload</option>
                    <option value="aadhaar_otp">Aadhaar OTP eKYC (Digio)</option>
                    <option value="video_kyc">Video KYC (VCIP)</option>
                    <option value="both">Both Aadhaar OTP + Video KYC</option>
                  </select>
                  {!subscription?.kycEnabled && (
                    <div style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '4px', fontWeight: 600 }}>
                      ⚠️ Premium add-on disabled. Unlock under Superadmin Subscription.
                    </div>
                  )}
                </div>
              </div>

              {isLendingModule && (
                <div style={{borderTop:'1px solid var(--border)', paddingTop:'20px', marginTop:'12px'}}>
                <h4 style={{fontSize:'.95rem', fontWeight:700, marginBottom:'12px'}}>📝 {d.loanCodePrefixes}</h4>
                <p style={{fontSize:'.8rem', color:'var(--text-light)', marginBottom:'16px'}}>{d.loanCodePrefixesDesc}</p>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                  <div className="settings-item" style={{flexDirection:'column', alignItems:'flex-start', gap:'4px'}}>
                    <label className="form-label" style={{fontSize:'.8rem', margin:0}}>{d.dailyPrefix}</label>
                    <input type="text" name="loan_prefix_daily" className="form-control" style={{width:'100px'}} defaultValue={settings.loan_prefix_daily || 'DL'} maxLength={4} />
                  </div>
                  <div className="settings-item" style={{flexDirection:'column', alignItems:'flex-start', gap:'4px'}}>
                    <label className="form-label" style={{fontSize:'.8rem', margin:0}}>{d.weeklyPrefix}</label>
                    <input type="text" name="loan_prefix_weekly" className="form-control" style={{width:'100px'}} defaultValue={settings.loan_prefix_weekly || 'WK'} maxLength={4} />
                  </div>
                  <div className="settings-item" style={{flexDirection:'column', alignItems:'flex-start', gap:'4px'}}>
                    <label className="form-label" style={{fontSize:'.8rem', margin:0}}>{d.biWeeklyPrefix}</label>
                    <input type="text" name="loan_prefix_biweekly" className="form-control" style={{width:'100px'}} defaultValue={settings.loan_prefix_biweekly || 'BW'} maxLength={4} />
                  </div>
                  <div className="settings-item" style={{flexDirection:'column', alignItems:'flex-start', gap:'4px'}}>
                    <label className="form-label" style={{fontSize:'.8rem', margin:0}}>{d.monthlyPrefix}</label>
                    <input type="text" name="loan_prefix_monthly" className="form-control" style={{width:'100px'}} defaultValue={settings.loan_prefix_monthly || 'ML'} maxLength={4} />
                  </div>
                </div>
                </div>
              )}
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

      {/* Gold Master Tab */}
      {effAppType === 'goldloan' && (
        <div className={`tab-content ${activeTab === 'goldmaster' ? 'active' : ''}`}>
          <GoldMasterClient master={goldMaster || { ornamentTypes: [], ornamentSpecs: [], bankNames: [] }} config={goldConfig} />
        </div>
      )}

      {/* Payment / UPI Tab */}
      <div className={`tab-content ${activeTab === 'payment' ? 'active' : ''}`}>
        <div className="card-header"><h3>💳 {d.paymentSettings}</h3></div>
        <form action={async (fd) => { await saveUpiQrCode(fd); showToast(d.paymentSaved); }} style={{maxWidth:'500px'}}>
          <div className="form-group">
            <label className="form-label">{d.upiId}</label>
            <input type="text" name="upiId" className="form-control" defaultValue={settings.upi_id || ''} placeholder={d.upiIdPlaceholder} />
            <span style={{fontSize:'.75rem', color:'var(--text-light)', marginTop:'4px', display:'block'}}>{d.upiIdHelper}</span>
          </div>
          <div className="form-group">
            <label className="form-label">{d.upiQrImage}</label>
            {settings.upi_qr_url && (
              <div style={{marginBottom:'12px', padding:'12px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', background:'#fff', display:'inline-block'}}>
                <img src={settings.upi_qr_url} alt={d.upiQrImage} style={{width:'180px', height:'180px', objectFit:'contain'}} />
              </div>
            )}
            <input type="file" name="upiQrCode" accept="image/*" className="form-control" />
            <span style={{fontSize:'.75rem', color:'var(--text-light)', marginTop:'4px', display:'block'}}>{d.upiQrHelper}</span>
          </div>
          <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px', marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '8px' }}>✅ UPI Verification</h4>
            <p style={{ fontSize: '.8rem', color: 'var(--text-light)', marginBottom: '12px' }}>
              By default UPI/online collections are verified automatically and credited to the
              account the moment they are recorded. Turn this on only if an admin must review
              each UPI payment by hand (shows the Pending UPI panel on the dashboard).
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="upi_manual_verification"
                value="true"
                defaultChecked={settings.upi_manual_verification === 'true'}
              />
              <strong>Require manual UPI verification</strong>
            </label>
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
      {/* Notifications Tab */}
      <div className={`tab-content ${activeTab === 'notifications' ? 'active' : ''}`}>
        <div className="card-header">
          <h3>🔔 Automated Notification Settings</h3>
        </div>
        <form action={async (fd) => { 
          setLoading(true); 
          await saveNotificationSettings(fd); 
          setLoading(false); 
          showToast('Notification settings saved'); 
        }} style={{ maxWidth: '800px' }}>
          
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              Configure automated outbound notifications to borrowers and admins. SMS/WhatsApp alerts require the MSG91 provider, while email alerts use SMTP.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                name="whatsapp_sms_active" 
                value="true" 
                defaultChecked={settings.whatsapp_sms_active !== 'false'} 
              />
              <strong>Enable Automated Notifications (Master Switch)</strong>
            </label>
            <span style={{ fontSize: '.75rem', color: 'var(--text-light)', marginTop: '6px', display: 'block' }}>
              If unchecked, all automatic outbound notifications will be disabled.
            </span>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '12px' }}>
            <h4 style={{ fontSize: '.95rem', fontWeight: 700, marginBottom: '12px' }}>📡 Active Channels</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: subscription?.whatsappSmsEnabled ? 'pointer' : 'not-allowed', opacity: subscription?.whatsappSmsEnabled ? 1 : 0.6 }}>
                <input 
                  type="checkbox" 
                  name="notify_channel_sms" 
                  value="true" 
                  defaultChecked={settings.notify_channel_sms === 'true'} 
                  disabled={!subscription?.whatsappSmsEnabled}
                />
                <span>SMS (via MSG91)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: subscription?.whatsappSmsEnabled ? 'pointer' : 'not-allowed', opacity: subscription?.whatsappSmsEnabled ? 1 : 0.6 }}>
                <input 
                  type="checkbox" 
                  name="notify_channel_whatsapp" 
                  value="true" 
                  defaultChecked={settings.notify_channel_whatsapp === 'true'} 
                  disabled={!subscription?.whatsappSmsEnabled}
                />
                <span>WhatsApp (via MSG91)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  name="notify_channel_email" 
                  value="true" 
                  defaultChecked={settings.notify_channel_email === 'true'} 
                />
                <span>Email (via SMTP)</span>
              </label>
            </div>
            {!subscription?.whatsappSmsEnabled && (
              <div style={{ padding: '10px 12px', background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)', fontSize: '.8rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>warning</span>
                SMS & WhatsApp channels are locked under your current subscription.
              </div>
            )}
          </div>

          {/* MSG91 settings (only if subscription enabled, else display alert) */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '12px' }}>
            <h4 style={{ fontSize: '.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--primary)' }}>💬 MSG91 Provider Credentials</h4>
            {subscription?.whatsappSmsEnabled ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '.8rem' }}>MSG91 Auth Key</label>
                  <input 
                    type="password" 
                    name="msg91_auth_key" 
                    className="form-control" 
                    placeholder="Enter MSG91 API Key" 
                    defaultValue={settings.msg91_auth_key || ''} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '.8rem' }}>SMS Sender ID</label>
                  <input 
                    type="text" 
                    name="msg91_sender_id" 
                    className="form-control" 
                    placeholder="e.g. LNTRCK" 
                    defaultValue={settings.msg91_sender_id || 'LNTRCK'} 
                    maxLength={6} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '.8rem' }}>WhatsApp Sender Number</label>
                  <input 
                    type="text" 
                    name="msg91_whatsapp_number" 
                    className="form-control" 
                    placeholder="e.g. 917xxxxxxxxxx" 
                    defaultValue={settings.msg91_whatsapp_number || ''} 
                  />
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '.8rem', color: 'var(--text-light)', marginBottom: '20px' }}>
                Unlock MSG91 configurations by enabling the SMS & WhatsApp notifications subscription addon.
              </p>
            )}
          </div>

          {/* SMTP settings (always available) */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '12px' }}>
            <h4 style={{ fontSize: '.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--primary)' }}>✉️ SMTP Email Server Settings</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '.8rem' }}>SMTP Host</label>
                <input 
                  type="text" 
                  name="smtp_host" 
                  className="form-control" 
                  placeholder="e.g. smtp.gmail.com" 
                  defaultValue={settings.smtp_host || ''} 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '.8rem' }}>SMTP Port</label>
                <input 
                  type="text" 
                  name="smtp_port" 
                  className="form-control" 
                  placeholder="e.g. 587" 
                  defaultValue={settings.smtp_port || '587'} 
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '.8rem' }}>SMTP Username</label>
                <input 
                  type="text" 
                  name="smtp_user" 
                  className="form-control" 
                  placeholder="Sender email address" 
                  defaultValue={settings.smtp_user || ''} 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '.8rem' }}>SMTP Password</label>
                <input 
                  type="password" 
                  name="smtp_pass" 
                  className="form-control" 
                  placeholder="SMTP / App Password" 
                  defaultValue={settings.smtp_pass || ''} 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '.8rem' }}>From Display Name</label>
                <input 
                  type="text" 
                  name="smtp_from_name" 
                  className="form-control" 
                  placeholder="e.g. Erode Finance" 
                  defaultValue={settings.smtp_from_name || ''} 
                />
              </div>
            </div>
          </div>

          {/* Event settings (always available) */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '12px' }}>
            <h4 style={{ fontSize: '.95rem', fontWeight: 700, marginBottom: '12px' }}>🔔 Notification Triggers</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '25px' }}>
              {[
                { key: 'notify_event_payment_received', label: 'Payment received' },
                { key: 'notify_event_due_reminder', label: 'Due date reminder' },
                { key: 'notify_event_loan_disbursed', label: 'Loan disbursed' },
                { key: 'notify_event_loan_overdue', label: 'Loan overdue' },
                { key: 'notify_event_loan_closed', label: 'Loan closed' },
                { key: 'notify_event_penalty_accrued', label: 'Penalty accrued' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    name={key} 
                    value="true" 
                    defaultChecked={settings[key] !== 'false'} 
                  />
                  <span style={{ fontSize: '.85rem' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '25px', padding: '16px', background: 'var(--primary-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-dark)', margin: 0 }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>list_alt</span>
                Notification Audit Trails
              </h4>
              <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                Review details of sent, failed, and pending borrower alerts.
              </p>
            </div>
            <Link 
              href={`/${modulePrefix}/notifications/log`} 
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', height: 'fit-content' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>history</span>
              View Logs
            </Link>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>save</span> {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>

        {/* Custom Notification Templates Editor */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '30px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-dark)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons-outlined">edit_note</span>
              Custom Messages & Templates Editor
            </h4>
            <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Select a trigger event and target language to edit message bodies for SMS, WhatsApp, and Push channels.
            </p>
          </div>

          {/* Selector Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '.8rem', fontWeight: 600 }}>Trigger Event</label>
              <select 
                className="form-control" 
                value={selectedEvent} 
                onChange={(e) => setSelectedEvent(e.target.value)}
              >
                <option value="payment_received">Payment Received</option>
                <option value="payment_due_reminder">Due Date Reminder</option>
                <option value="loan_disbursed">Loan Disbursed</option>
                <option value="loan_overdue">Loan Overdue</option>
                <option value="loan_closed">Loan Closed</option>
                <option value="penalty_accrued">Penalty Accrued</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '.8rem', fontWeight: 600 }}>Language</label>
              <select 
                className="form-control" 
                value={selectedLang} 
                onChange={(e) => setSelectedLang(e.target.value)}
              >
                <option value="en">English (EN)</option>
                <option value="ta">Tamil (TA)</option>
                <option value="hi">Hindi (HI)</option>
                <option value="te">Telugu (TE)</option>
                <option value="kn">Kannada (KN)</option>
                <option value="ml">Malayalam (ML)</option>
              </select>
            </div>
          </div>

          {/* Template Form */}
          {(() => {
            const smsTemp = notificationTemplates.find(t => t.name === selectedEvent && t.lang === selectedLang && t.channel === 'sms');
            const waTemp = notificationTemplates.find(t => t.name === selectedEvent && t.lang === selectedLang && t.channel === 'whatsapp');
            const pushTemp = notificationTemplates.find(t => t.name === selectedEvent && t.lang === selectedLang && t.channel === 'push');

            return (
              <form action={async (fd) => {
                setLoading(true);
                const smsActive = fd.get('sms_active') === 'true';
                const waActive = fd.get('whatsapp_active') === 'true';
                const pushActive = fd.get('push_active') === 'true';

                const [resSms, resWa, resPush] = await Promise.all([
                  saveNotificationTemplate({
                    name: selectedEvent,
                    lang: selectedLang,
                    channel: 'sms',
                    body: fd.get('sms_body') as string,
                    isActive: smsActive,
                  }),
                  saveNotificationTemplate({
                    name: selectedEvent,
                    lang: selectedLang,
                    channel: 'whatsapp',
                    body: fd.get('whatsapp_body') as string,
                    isActive: waActive,
                  }),
                  saveNotificationTemplate({
                    name: selectedEvent,
                    lang: selectedLang,
                    channel: 'push',
                    subject: fd.get('push_subject') as string,
                    body: fd.get('push_body') as string,
                    isActive: pushActive,
                  })
                ]);

                setLoading(false);
                if (resSms.success && resWa.success && resPush.success) {
                  showToast('Notification templates saved successfully!');
                  router.refresh();
                } else {
                  alert('Failed to save templates. Please check auth / input values.');
                }
              }} style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                
                {/* Channels Editor Inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* SMS */}
                  <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>sms</span>
                        SMS Message Template
                      </strong>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '.8rem' }}>
                        <input type="checkbox" name="sms_active" value="true" defaultChecked={smsTemp ? smsTemp.isActive : true} key={`${selectedEvent}-${selectedLang}-sms-active`} />
                        Active
                      </label>
                    </div>
                    <textarea 
                      name="sms_body" 
                      className="form-control" 
                      rows={3} 
                      defaultValue={smsTemp?.body || ''} 
                      placeholder={`e.g. Hi {customer}, we received {amount} for loan {loan_code}.`}
                      key={`${selectedEvent}-${selectedLang}-sms-body`}
                      required
                    />
                  </div>

                  {/* WhatsApp */}
                  <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#25D366' }}>whatsapp</span>
                        WhatsApp Message Template
                      </strong>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '.8rem' }}>
                        <input type="checkbox" name="whatsapp_active" value="true" defaultChecked={waTemp ? waTemp.isActive : true} key={`${selectedEvent}-${selectedLang}-wa-active`} />
                        Active
                      </label>
                    </div>
                    <textarea 
                      name="whatsapp_body" 
                      className="form-control" 
                      rows={3} 
                      defaultValue={waTemp?.body || ''} 
                      placeholder={`e.g. 👋 Hi {customer}, ₹{amount} has been received for loan {loan_code}.`}
                      key={`${selectedEvent}-${selectedLang}-wa-body`}
                      required
                    />
                  </div>

                  {/* Push Notification */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#FF9900' }}>notifications_active</span>
                        Push Notification Template
                      </strong>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '.8rem' }}>
                        <input type="checkbox" name="push_active" value="true" defaultChecked={pushTemp ? pushTemp.isActive : true} key={`${selectedEvent}-${selectedLang}-push-active`} />
                        Active
                      </label>
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '.75rem' }}>Push Title / Subject</label>
                      <input 
                        type="text" 
                        name="push_subject" 
                        className="form-control" 
                        defaultValue={pushTemp?.subject || ''} 
                        placeholder="e.g. Payment Confirmation"
                        key={`${selectedEvent}-${selectedLang}-push-subject`}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '.75rem' }}>Push Body</label>
                      <textarea 
                        name="push_body" 
                        className="form-control" 
                        rows={3} 
                        defaultValue={pushTemp?.body || ''} 
                        placeholder={`e.g. Hi {customer}, ₹{amount} has been received for loan {loan_code}.`}
                        key={`${selectedEvent}-${selectedLang}-push-body`}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '10px' }}>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>save</span>
                      {loading ? 'Saving Templates...' : 'Save Selected Templates'}
                    </button>
                  </div>

                </div>

                {/* Placeholder Cheatsheet */}
                <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '20px', fontSize: '.8rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h5 style={{ margin: 0, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>info</span>
                    Placeholders Key
                  </h5>
                  <p style={{ color: 'var(--text-light)', margin: 0 }}>
                    Copy and paste these placeholder tags in your template bodies. They resolve dynamically upon notification dispatch:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { token: '{customer}', desc: 'Customer name' },
                      { token: '{amount}', desc: 'Transaction/Due amount' },
                      { token: '{due_date}', desc: 'Instalment due date' },
                      { token: '{loan_code}', desc: 'Unique loan number' },
                      { token: '{days}', desc: 'Days overdue' },
                      { token: '{penalty}', desc: 'Accrued penalty charge' },
                      { token: '{balance}', desc: 'Remaining loan balance' },
                      { token: '{orgName}', desc: 'Tenant organization name' },
                      { token: '{firstDue}', desc: 'First instalment due date' }
                    ].map(({ token, desc }) => (
                      <div key={token} style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px 8px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-dark)', cursor: 'pointer' }} onClick={() => {
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(token);
                            showToast(`Copied ${token} to clipboard!`);
                          }
                        }} title="Click to copy">{token}</span>
                        <span style={{ color: 'var(--text-light)', fontSize: '.72rem', marginTop: '2px' }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </form>
            );
          })()}

        </div>
      </div>

      {/* Bulk Tools Tab */}
      <div className={`tab-content ${activeTab === 'bulk' ? 'active' : ''}`}>
        <div className="card-header"><h3>📦 {d.bulkDataTools}</h3></div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', maxWidth:'800px'}}>
          <div className="card" style={{padding:'20px', border:'1px solid var(--border)'}}>
            <h4>{d.importCustomers}</h4>
            <p style={{fontSize:'.85rem', color:'var(--text-light)', marginBottom:'15px'}}>{d.importCustomersDesc}</p>
            <input type="file" accept=".json" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              try {
                const data = JSON.parse(text);
                const res = await importCustomers(data);
                alert(`${d.importComplete}: ${res.success} ${d.succeeded}, ${res.failed} ${d.failedCount}.`);
              } catch {
                alert(d.invalidJson);
              }
            }} />
          </div>
          <div className="card" style={{padding:'20px', border:'1px solid var(--border)'}}>
            <h4>{d.importCollections}</h4>
            <p style={{fontSize:'.85rem', color:'var(--text-light)', marginBottom:'15px'}}>{d.importCollectionsDesc}</p>
            <input type="file" accept=".json" disabled />
          </div>
        </div>
      </div>

      {/* Data Management Tab */}
      <div className={`tab-content ${activeTab === 'data' ? 'active' : ''}`}>
        <div className="card-header">
          <h3 style={{ color: 'var(--danger)' }}>⚠️ {d.dangerZone}</h3>
        </div>
        <div style={{ maxWidth: '800px' }}>
          <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
            {d.dangerWarning}
          </p>

          <div className="settings-item" style={{ border: '1px solid var(--border)', padding: '20px', borderRadius: 'var(--radius)', marginBottom: '20px', background: 'var(--bg)' }}>
            <div className="si-info" style={{ marginBottom: '16px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>download_for_offline</span>
                {d.databaseBackup}
              </h4>
              <p>{d.databaseBackupDesc}</p>
            </div>
            <div>
              <a href="/api/backup/export" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }} download>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>download</span>
                {d.downloadBackup}
              </a>
            </div>
          </div>

          <div className="settings-item" style={{ border: '1px solid var(--danger)', padding: '20px', borderRadius: 'var(--radius)', background: 'rgba(231, 76, 60, 0.05)' }}>
            <div className="si-info" style={{ marginBottom: '16px' }}>
              <h4 style={{ color: 'var(--danger)' }}>{d.wipeData}</h4>
              <p>{d.wipeDataDesc}</p>
            </div>
            <form action={async (fd) => {
              const tables = fd.getAll('tables') as string[];
              if (tables.length === 0) {
                alert(d.selectAtLeastOne);
                return;
              }
              if (confirm(d.wipeConfirm)) {
                setLoading(true);
                const { wipeDatabaseRecords } = await import('./actions');
                const res = await wipeDatabaseRecords(tables);
                setLoading(false);
                if (res.success) {
                  alert(d.wipeSuccess);
                  window.location.reload();
                } else {
                  alert(d.wipeFailed + ': ' + res.error);
                }
              }
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="loans" />
                  <strong>{d.loansAndPayments}</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>{d.loansAndPaymentsDesc}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="customers" />
                  <strong>{d.customersAndGuarantors}</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>{d.customersAndGuarantorsDesc}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="accounting" />
                  <strong>{d.accounting}</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>{d.accountingDesc}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="agents" />
                  <strong style={{ color: 'var(--warning)' }}>{d.agentsOnly}</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>{d.agentsOnlyDesc}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="admins" />
                  <strong style={{ color: 'var(--danger)' }}>{d.adminsOnly}</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>{d.adminsOnlyDesc}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="agents_routes" />
                  <strong>{d.agentsAndRoutes}</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>{d.agentsAndRoutesDesc}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="tables" value="approvals" />
                  <strong>{d.approvalsAndAudit}</strong> <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>{d.approvalsAndAuditDesc}</span>
                </label>
              </div>
              <button type="submit" className="btn btn-danger" disabled={loading}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>delete_forever</span>
                {loading ? d.wipingData : d.permanentlyDelete}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Security Tab */}
      <div className={`tab-content ${activeTab === 'security' ? 'active' : ''}`}>
        <div className="card-header"><h3>🔒 {d.securityAndTwoFa}</h3></div>
        <div style={{maxWidth:'600px'}}>
          <p style={{marginBottom:'20px', color:'var(--text-secondary)'}}>
            {d.twoFaIntro}
          </p>

          <div className="settings-item" style={{border:'1px solid var(--border)', padding:'20px', borderRadius:'var(--radius)'}}>
            <div className="si-info">
              <h4>{d.twoFa}</h4>
              <p>{currentUser?.totpSecret ? d.statusEnabled : d.statusDisabled}</p>
            </div>
            <div>
              {currentUser?.totpSecret ? (
                <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={async () => { if(confirm(d.disableTwoFaConfirm)) { await disable2fa(); window.location.reload(); } }}>
                  {d.disableTwoFa}
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={async () => {
                  const { secret, qrCodeUrl } = await generate2faSecret();
                  setTempSecret(secret);
                  setQrCode(qrCodeUrl);
                  setIs2faModalOpen(true);
                }}>
                  {d.enableTwoFa}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bureau Connect Tab */}
      {isLendingModule && subscription?.bureauEnabled && (
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
      {isLendingModule && subscription?.npaEnabled && (
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

      {/* Theme Tab (superadmin) */}
      {(viewerRole === 'superadmin' || viewerRole === 'developer') && (
      <div className={`tab-content ${activeTab === 'theme' ? 'active' : ''}`}>
        <div className="card-header">
          <div>
            <h3>🎨 Colour Theme</h3>
            <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Applies to the web dashboard and the mobile app for everyone in this business.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', opacity: themeBusy ? 0.6 : 1 }}>
          {/* Default = each module keeps its own colours */}
          <div
            onClick={() => applyTheme('default')}
            style={{
              padding: '12px', borderRadius: '10px', cursor: 'pointer',
              border: `2px solid ${activeTheme === 'default' ? 'var(--primary)' : 'var(--border)'}`,
              background: activeTheme === 'default' ? 'var(--primary-light)' : 'transparent',
            }}
          >
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #E67E22, #2980B9, #27AE60, #B8860B)' }} />
            </div>
            <div style={{ fontWeight: 600, fontSize: '.85rem' }}>Default</div>
            <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>Per-module colours</div>
          </div>

          {THEME_PRESETS.map((t) => (
            <div
              key={t.key}
              onClick={() => applyTheme(t.key)}
              style={{
                padding: '12px', borderRadius: '10px', cursor: 'pointer',
                border: `2px solid ${activeTheme === t.key ? t.primary : 'var(--border)'}`,
                background: activeTheme === t.key ? t.primaryLight : 'transparent',
              }}
            >
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: t.primary, border: '1px solid rgba(0,0,0,.08)' }} />
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: t.primaryDark, border: '1px solid rgba(0,0,0,.08)' }} />
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: t.primaryLight, border: '1px solid rgba(0,0,0,.08)' }} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{t.name}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>
                {activeTheme === t.key ? 'Active' : '3-colour set'}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '.78rem', color: 'var(--text-light)', marginTop: '16px' }}>
          The mobile app picks up the new theme the next time it starts or refreshes its session.
        </p>
      </div>
      )}

      {/* --- Modals --- */}

      {/* Route Modal */}
      <Modal isOpen={isRouteModalOpen} onClose={() => setIsRouteModalOpen(false)} title={d.addNewRoute}>
        <form action={async (fd) => { await createRoute(fd); setIsRouteModalOpen(false); showToast(d.routeCreated); }}>
          <div className="form-group">
            <label className="form-label">{d.routeName}</label>
            <input type="text" name="name" className="form-control" required placeholder={d.routeNamePlaceholder} />
          </div>
          <div className="form-group">
            <label className="form-label">{d.primaryAgent}</label>
            <select name="primaryAgentId" className="form-control">
              <option value="">{d.unassigned}</option>
              {users.filter(u => u.role === 'agent').map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <span style={{ fontSize: '.75rem', color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>{d.primaryAgentHelper}</span>
          </div>
          <div className="form-group">
            <label className="form-label">{d.sharedAgents}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius-sm)', maxHeight: '150px', overflowY: 'auto', background: 'var(--bg)' }}>
              {users.filter(u => u.role === 'agent').length === 0 ? (
                <span style={{ fontSize: '.85rem', color: 'var(--text-light)' }}>{d.noAgentsAvailable}</span>
              ) : (
                users.filter(u => u.role === 'agent').map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '.9rem' }}>
                    <input type="checkbox" name="agentIds" value={u.id} />
                    {u.name}
                  </label>
                ))
              )}
            </div>
            <span style={{ fontSize: '.75rem', color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>{d.sharedAgentsHelper}</span>
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
            <input type="text" name="name" className="form-control" required placeholder={d.packageNamePlaceholder} />
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
      <Modal isOpen={is2faModalOpen} onClose={() => setIs2faModalOpen(false)} title={d.enableTwoFaTitle}>
        <div style={{textAlign:'center'}}>
          <p style={{marginBottom:'15px', fontSize:'.9rem'}}>{d.scanQr}</p>
          {qrCode && <img src={qrCode} alt="QR Code" style={{width:'200px', height:'200px', margin:'0 auto 15px', border:'8px solid #fff', borderRadius:'var(--radius)'}} />}
          <p style={{fontSize:'.8rem', color:'var(--text-light)', marginBottom:'20px'}}>{d.secretKey}: <code>{tempSecret}</code></p>

          <div className="form-group" style={{textAlign:'left'}}>
            <label className="form-label">{d.enterSixDigit}</label>
            <input
              type="text"
              className="form-control"
              placeholder={d.sixDigitPlaceholder}
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
              {isEnabling ? d.verifying : d.verifyAndEnable}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
