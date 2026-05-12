'use client';

import { useState } from 'react';
import { saveCustomer } from '../actions';
import Modal from '@/components/Modal';
import { createRoute, createUser } from '../../settings/actions';

export default function CustomerForm({
  routes,
  agents,
  customer,
  onSuccess,
}: {
  routes: any[];
  agents: any[];
  customer?: any;
  onSuccess?: (customer: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  
  // Security cheques state
  const [cheques, setCheques] = useState<{ id: number; bank: string; num: string; fileName?: string }[]>(
    customer?.securityCheques?.map((c: any, i: number) => ({ id: i, bank: c.bankName, num: c.chequeNumber, fileName: c.imagePath })) 
    || [{ id: Date.now(), bank: '', num: '' }]
  );

  // Documents state (multiple)
  const [documents, setDocuments] = useState<{ id: number; name: string }[]>([]);

  // Guarantors state
  const [guarantors, setGuarantors] = useState<{ id: number; name: string; phone: string; address: string; relation: string; photoName?: string }[]>(
    customer?.guarantors?.map((g: any, i: number) => ({ id: i, name: g.name, phone: g.phone, address: g.address || '', relation: g.relation || '', photoName: g.photo }))
    || []
  );

  // Route modal
  const [localRoutes, setLocalRoutes] = useState<any[]>(routes);
  const [selectedRouteId, setSelectedRouteId] = useState(customer?.routeId || '');
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [creatingRoute, setCreatingRoute] = useState(false);

  // Agent modal
  const [localAgents, setLocalAgents] = useState<any[]>(agents);
  const [selectedAgentId, setSelectedAgentId] = useState(customer?.agentId || '');
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);

  // Customer photo — track new file name; existing URL comes from customer prop
  const [photoName, setPhotoName] = useState<string | null>(null);

  // --- Cheque handlers ---
  const addChequeRow = () => {
    if (cheques.length >= 5) { alert('Maximum 5 cheques allowed'); return; }
    setCheques([...cheques, { id: Date.now(), bank: '', num: '' }]);
  };
  const removeChequeRow = (id: number) => setCheques(cheques.filter(c => c.id !== id));
  const updateCheque = (id: number, field: string, value: string) => {
    setCheques(cheques.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // --- Guarantor handlers ---
  const addGuarantor = () => {
    setGuarantors([...guarantors, { id: Date.now(), name: '', phone: '', address: '', relation: '' }]);
  };
  const removeGuarantor = (id: number) => setGuarantors(guarantors.filter(g => g.id !== id));
  const updateGuarantor = (id: number, field: string, value: string) => {
    setGuarantors(guarantors.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  // --- Route create handler ---
  const handleCreateRoute = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreatingRoute(true);
    const formData = new FormData(e.currentTarget);
    const res = await createRoute(formData);
    if (res.success && res.route) {
      setLocalRoutes([...localRoutes, res.route]);
      setSelectedRouteId(res.route.id);
      setIsRouteModalOpen(false);
    }
    setCreatingRoute(false);
  };

  // --- Agent create handler ---
  const handleCreateAgent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreatingAgent(true);
    const formData = new FormData(e.currentTarget);
    formData.set('role', 'agent');
    const res = await createUser(formData);
    if (res.success && res.user) {
      setLocalAgents([...localAgents, res.user]);
      setSelectedAgentId(res.user.id);
      setIsAgentModalOpen(false);
    }
    setCreatingAgent(false);
  };

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (onSuccess) {
      e.preventDefault();
      setLoading(true);
      const formData = new FormData(e.currentTarget);
      formData.append('isPopup', 'true');
      const res = await saveCustomer(formData);
      if (res.success && res.customer) {
        onSuccess(res.customer);
      }
      setLoading(false);
    } else {
      setLoading(true);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '900px' }}>
      <div className="card-header">
        <h3>{customer ? `✏️ Edit Customer — ${customer.name}` : '➕ Register New Customer'}</h3>
      </div>
      <form action={onSuccess ? undefined : (saveCustomer as unknown as (formData: FormData) => Promise<void>)} onSubmit={handleSubmit}>
        {customer && <input type="hidden" name="id" value={customer.id} />}
        
        {/* --- Customer Photo --- */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <label style={{ cursor: 'pointer', display: 'block' }}>
              <div style={{
                width: '100px', height: '100px', borderRadius: '50%',
                background: 'var(--bg)', border: '2px dashed var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {photoName ? (
                  <span className="material-icons-outlined" style={{ fontSize: '40px', color: 'var(--success)' }}>check_circle</span>
                ) : customer?.profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={customer.profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span className="material-icons-outlined" style={{ fontSize: '32px', color: 'var(--text-light)' }}>add_a_photo</span>
                )}
              </div>
              {/* Preserve existing photo URL on edit when no new file selected */}
              {customer?.profilePhoto && !photoName && (
                <input type="hidden" name="existingProfilePhoto" value={customer.profilePhoto} />
              )}
              <input type="file" name="profilePhoto" accept="image/*" style={{ display: 'none' }}
                onChange={e => setPhotoName(e.target.files?.[0]?.name || null)} />
              <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                {photoName || (customer?.profilePhoto ? 'Change Photo' : 'Add Photo')}
              </span>
            </label>
          </div>

          <div style={{ flex: 1 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input type="text" name="name" className="form-control" placeholder="Enter full name" defaultValue={customer?.name} required style={{ fontSize: '1rem', padding: '12px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input type="tel" name="phone" className="form-control" placeholder="Enter 10-digit phone" defaultValue={customer?.phone} required style={{ fontSize: '1rem', padding: '12px' }} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">Address *</label>
          <textarea name="address" className="form-control" placeholder="Full address..." defaultValue={customer?.address} required style={{ fontSize: '1rem', padding: '12px' }}></textarea>
        </div>
        
        {/* --- Route & Agent with inline create --- */}
        <div className="form-row">
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ margin: 0 }}>Route / Line *</label>
              <button type="button" onClick={() => setIsRouteModalOpen(true)} className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', color: 'var(--primary)', fontSize: '.8rem' }}>
                + New Route
              </button>
            </div>
            <select name="routeId" className="form-control" value={selectedRouteId} onChange={e => setSelectedRouteId(e.target.value)} required style={{ fontSize: '1rem', padding: '12px' }}>
              <option value="">Select Route</option>
              {localRoutes.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ margin: 0 }}>Assigned Agent *</label>
              <button type="button" onClick={() => setIsAgentModalOpen(true)} className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', color: 'var(--primary)', fontSize: '.8rem' }}>
                + New Agent
              </button>
            </div>
            <select name="agentId" className="form-control" value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)} required style={{ fontSize: '1rem', padding: '12px' }}>
              <option value="">Select Agent</option>
              {localAgents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* --- Multiple Document Upload --- */}
        <h4 style={{ margin: '24px 0 12px', fontSize: '.9rem', fontWeight: 600 }}>📄 Documents (Aadhar, PAN, etc.)</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {documents.map((doc, i) => (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
              padding: '6px 10px', fontSize: '.82rem'
            }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--success)' }}>description</span>
              <span>{doc.name}</span>
              <button type="button" onClick={() => setDocuments(documents.filter(d => d.id !== doc.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--danger)' }}>close</span>
              </button>
            </div>
          ))}
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          cursor: 'pointer', padding: '14px', border: '2px dashed var(--border)',
          borderRadius: 'var(--radius-sm)', justifyContent: 'center'
        }}>
          <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>cloud_upload</span>
          <span style={{ fontSize: '.85rem' }}>Tap to upload documents (JPG, PNG, PDF)</span>
          <input type="file" name="documents" accept="image/*,.pdf" multiple style={{ display: 'none' }}
            onChange={e => {
              const files = Array.from(e.target.files || []);
              setDocuments([...documents, ...files.map(f => ({ id: Date.now() + Math.random(), name: f.name }))]);
            }} />
        </label>

        {/* --- Security Cheques --- */}
        <h4 style={{ margin: '24px 0 12px', fontSize: '.9rem', fontWeight: 600 }}>🏦 Security Cheques (up to 5)</h4>
        <div>
          {cheques.map((cheque, index) => (
            <div key={cheque.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
              <div style={{ width: '24px', textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>{index + 1}</div>
              <input type="text" name={`bankName_${index}`} className="form-control" placeholder="Bank Name" value={cheque.bank}
                onChange={e => updateCheque(cheque.id, 'bank', e.target.value)} style={{ flex: 1, fontSize: '1rem', padding: '10px' }} />
              <input type="text" name={`chequeNumber_${index}`} className="form-control" placeholder="Cheque Number" value={cheque.num}
                onChange={e => updateCheque(cheque.id, 'num', e.target.value)} style={{ flex: 1, fontSize: '1rem', padding: '10px' }} />
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '.8rem' }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>image</span>
                {cheque.fileName || 'Upload'}
                <input type="file" name={`chequeImage_${index}`} accept="image/*" style={{ display: 'none' }}
                  onChange={e => updateCheque(cheque.id, 'fileName', e.target.files?.[0]?.name || '')} />
              </label>
              <button type="button" onClick={() => removeChequeRow(cheque.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>delete</span>
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addChequeRow} style={{ marginTop: '8px', padding: '8px 14px' }}>
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span> Add Cheque
        </button>

        {/* --- Guarantors / Surety --- */}
        <h4 style={{ margin: '24px 0 12px', fontSize: '.9rem', fontWeight: 600 }}>🤝 Guarantors / Surety</h4>
        {guarantors.map((g, index) => (
          <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '12px', background: 'var(--bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontSize: '.85rem' }}>Guarantor #{index + 1}</strong>
              <button type="button" onClick={() => removeGuarantor(g.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>delete</span>
              </button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input type="text" name={`guarantorName_${index}`} className="form-control" placeholder="Guarantor name" value={g.name}
                  onChange={e => updateGuarantor(g.id, 'name', e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input type="tel" name={`guarantorPhone_${index}`} className="form-control" placeholder="Phone number" value={g.phone}
                  onChange={e => updateGuarantor(g.id, 'phone', e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Relation</label>
                <select name={`guarantorRelation_${index}`} className="form-control" value={g.relation}
                  onChange={e => updateGuarantor(g.id, 'relation', e.target.value)} style={{ fontSize: '1rem', padding: '10px' }}>
                  <option value="">Select Relation</option>
                  <option value="friend">Friend</option>
                  <option value="relative">Relative</option>
                  <option value="business_partner">Business Partner</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Photo</label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '.85rem' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{g.photoName ? 'check_circle' : 'add_a_photo'}</span>
                  {g.photoName || 'Upload Photo'}
                  <input type="file" name={`guarantorPhoto_${index}`} accept="image/*" style={{ display: 'none' }}
                    onChange={e => updateGuarantor(g.id, 'photoName', e.target.files?.[0]?.name || '')} />
                </label>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input type="text" name={`guarantorAddress_${index}`} className="form-control" placeholder="Address" value={g.address}
                onChange={e => updateGuarantor(g.id, 'address', e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={addGuarantor} style={{ padding: '8px 14px' }}>
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>person_add</span> Add Guarantor
        </button>

        {/* --- Submit --- */}
        <div className="form-actions" style={{ marginTop: '24px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '12px 24px', fontSize: '1rem' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>save</span> {loading ? 'Saving...' : 'Submit'}
          </button>
          <a href="/customers" className="btn btn-ghost" style={{ padding: '12px 24px', fontSize: '1rem' }}>Cancel</a>
        </div>
      </form>

      {/* --- Route Creation Modal --- */}
      <Modal isOpen={isRouteModalOpen} onClose={() => setIsRouteModalOpen(false)} title="Create New Route">
        <form onSubmit={handleCreateRoute}>
          <div className="form-group">
            <label className="form-label">Route Name *</label>
            <input type="text" name="name" className="form-control" required style={{ fontSize: '1rem', padding: '12px' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Assigned Agent</label>
            <select name="assignedAgentId" className="form-control" style={{ fontSize: '1rem', padding: '12px' }}>
              <option value="">No Agent Assigned</option>
              {localAgents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="form-actions" style={{ marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={creatingRoute} style={{ padding: '10px 20px' }}>
              {creatingRoute ? 'Creating...' : 'Create Route'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsRouteModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* --- Agent Creation Modal --- */}
      <Modal isOpen={isAgentModalOpen} onClose={() => setIsAgentModalOpen(false)} title="Create New Agent">
        <form onSubmit={handleCreateAgent}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Agent Name *</label>
              <input type="text" name="name" className="form-control" required style={{ fontSize: '1rem', padding: '12px' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input type="tel" name="phone" className="form-control" required style={{ fontSize: '1rem', padding: '12px' }} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input type="text" name="username" className="form-control" required style={{ fontSize: '1rem', padding: '12px' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input type="password" name="password" className="form-control" required style={{ fontSize: '1rem', padding: '12px' }} />
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={creatingAgent} style={{ padding: '10px 20px' }}>
              {creatingAgent ? 'Creating...' : 'Create Agent'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsAgentModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
