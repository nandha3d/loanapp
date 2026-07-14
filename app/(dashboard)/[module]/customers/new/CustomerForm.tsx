'use client';

import { useEffect, useState } from 'react';
import { saveCustomer } from '../actions';
import Modal from '@/components/Modal';
import { createRoute } from '../../settings/actions';
import { usePathname, useRouter } from 'next/navigation';

interface CustomerFormProps {
  appType: string;
  routes: any[];
  agents?: any[];
  customer?: any;
  onSuccess?: (customer: any) => void;
  dict: any;
  viewerRole?: string;
}

export default function CustomerForm({ appType, routes: initialRoutes, customer, onSuccess, dict, viewerRole }: CustomerFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const isChit = appType === 'chitfunds';
  const isAgentViewer = viewerRole === 'agent';
  const [localRoutes, setLocalRoutes] = useState(initialRoutes);
  const [selectedRouteId, setSelectedRouteId] = useState(customer?.routeId || '');

  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [creatingRoute, setCreatingRoute] = useState(false);

  // Customer photo — track new file for preview; existing URL comes from customer prop
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    } else {
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  };

  // Company logo / photo — same pattern as customer photo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    } else {
      setLogoFile(null);
      setLogoPreview(null);
    }
  };
  // Show the company section expanded when editing a customer that already has company data
  const [showCompany, setShowCompany] = useState<boolean>(
    !!(customer?.companyName || customer?.gstNumber || customer?.companyLogo || customer?.businessType),
  );


  // --- Guarantor handlers ---
  const [guarantors, setGuarantors] = useState<any[]>(customer?.guarantors?.map((g: any) => ({ id: g.id, name: g.name, phone: g.phone, address: g.address, relation: g.relation, photoName: g.photo })) || []);
  const [guarantorPreviews, setGuarantorPreviews] = useState<Record<number, string>>({});
  const addGuarantor = () => {
    setGuarantors([...guarantors, { id: Date.now(), name: '', phone: '', address: '', relation: '' }]);
  };
  const removeGuarantor = (id: number) => setGuarantors(guarantors.filter(g => g.id !== id));
  const updateGuarantor = (id: number, field: string, value: string) => {
    setGuarantors(guarantors.map(g => g.id === id ? { ...g, [field]: value } : g));
  };
  const handleGuarantorPhotoChange = (id: number, file: File | null) => {
    if (file) {
      const url = URL.createObjectURL(file);
      setGuarantorPreviews(prev => ({ ...prev, [id]: url }));
      updateGuarantor(id, 'photoName', file.name);
    }
  };

  // --- Collection Points handlers ---
  const [collectionPoints, setCollectionPoints] = useState<any[]>(customer?.collectionPoints?.map((cp: any) => ({
    id: cp.id || Date.now() + Math.random(),
    name: cp.name,
    address: cp.address,
    latitude: cp.latitude,
    longitude: cp.longitude,
    isPrimary: cp.isPrimary
  })) || []);
  const addCollectionPoint = () => {
    setCollectionPoints([...collectionPoints, { id: Date.now(), name: '', address: '', latitude: null, longitude: null, isPrimary: collectionPoints.length === 0 }]);
  };
  const removeCollectionPoint = (id: number | string) => setCollectionPoints(collectionPoints.filter(cp => cp.id !== id));
  const updateCollectionPoint = (id: number | string, field: string, value: any) => {
    setCollectionPoints(collectionPoints.map(cp => cp.id === id ? { ...cp, [field]: value } : cp));
  };
  const captureGpsForPoint = (id: number | string) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          updateCollectionPoint(id, 'latitude', pos.coords.latitude);
          updateCollectionPoint(id, 'longitude', pos.coords.longitude);
          alert('GPS coordinates captured successfully!');
        },
        err => alert('Failed to get GPS location. Please ensure location permissions are granted.')
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const [mainAddress, setMainAddress] = useState(customer?.address || '');

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

  const [documents, setDocuments] = useState<any[]>([]);

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append('collectionPoints', JSON.stringify(collectionPoints));
    if (onSuccess) {
      formData.append('isPopup', 'true');
    }
    const res = await saveCustomer(formData);
    if (res?.success) {
      if (onSuccess && res.customer) {
        onSuccess(res.customer);
      }
    } else if (res?.error === 'CUSTOMER_ALREADY_EXISTS') {
      const select = confirm(`Customer "${res.customer.name}" (${res.customer.customerCode}) is already created with this phone number. Do you want to select that customer?`);
      if (select) {
        if (onSuccess) {
          onSuccess(res.customer);
        } else {
          const appType = pathname.split('/')[1] || 'microlending';
          router.push(`/${appType}/customers/${res.customer.customerCode}`);
        }
      }
    } else {
      alert(res?.error || 'Failed to save customer');
    }
    setLoading(false);
  };

  return (
    <div className="card" style={{ maxWidth: '900px' }}>
      <div className="card-header">
        <h3>{customer ? `✏️ ${dict.customers.editTitle} — ${customer.name}` : `➕ ${dict.customers.registerTitle}`}</h3>
      </div>
      <form onSubmit={handleSubmit}>
        {customer && <input type="hidden" name="id" value={customer.id} />}
        <input type="hidden" name="collectionPoints" value={JSON.stringify(collectionPoints)} />
        
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
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : customer?.profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={customer.profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span className="material-icons-outlined" style={{ fontSize: '32px', color: 'var(--text-light)' }}>add_a_photo</span>
                )}
              </div>
              {/* Preserve existing photo URL on edit when no new file selected */}
              {customer?.profilePhoto && !photoFile && (
                <input type="hidden" name="existingProfilePhoto" value={customer.profilePhoto} />
              )}
              <input type="file" name="profilePhoto" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={handlePhotoChange} />
              <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                {photoFile?.name || (customer?.profilePhoto ? dict.customers.changePhoto : dict.customers.addPhoto)}
              </span>
            </label>
          </div>

          <div style={{ flex: 1 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{dict.customers.fullName} *</label>
                <input type="text" name="name" className="form-control" placeholder="Enter full name" defaultValue={customer?.name} required style={{ fontSize: '1rem', padding: '12px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">{dict.customers.phone} *</label>
                <input type="tel" name="phone" className="form-control" placeholder="Enter 10-digit phone" defaultValue={customer?.phone} required style={{ fontSize: '1rem', padding: '12px' }} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Aadhar Number</label>
                <input type="text" name="aadharNumber" className="form-control" placeholder="12-digit Aadhar number" defaultValue={customer?.aadharNumber} style={{ fontSize: '1rem', padding: '12px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">PAN Number</label>
                <input type="text" name="pan" className="form-control" placeholder="ABCDE1234F" defaultValue={customer?.pan} maxLength={10}
                  style={{ fontSize: '1rem', padding: '12px', textTransform: 'uppercase' }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" name="email" className="form-control" placeholder="name@example.com" defaultValue={customer?.email} style={{ fontSize: '1rem', padding: '12px' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{dict.customers.address}</label>
              <textarea name="address" className="form-control" rows={2} placeholder="Complete postal address" value={mainAddress} onChange={e => setMainAddress(e.target.value)} style={{ fontSize: '1rem', padding: '12px' }} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Preferred Collection Time</label>
              <select name="preferredCollectionTime" className="form-control" defaultValue={customer?.preferredCollectionTime || ''} style={{ fontSize: '1rem', padding: '12px' }}>
                <option value="">Anytime</option>
                <option value="morning">Morning (6am – 12pm)</option>
                <option value="afternoon">Afternoon (12pm – 4pm)</option>
                <option value="evening">Evening (4pm – 8pm)</option>
                <option value="night">Night (after 8pm)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Route / Line. The route drives the collecting agent — the agent is
            assigned to routes in Settings → Routes (primary + shared), so there
            is no per-customer agent picker. Agents only see their own routes
            here; a customer they create is auto-linked to that route's agent. */}
        <div className="form-row">
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>{dict.customers.route} *</label>
              {!isAgentViewer && (
                <button type="button" onClick={() => setIsRouteModalOpen(true)} className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: '.75rem' }}>
                  + New Route
                </button>
              )}
            </div>
            <select name="routeId" className="form-control" value={selectedRouteId} onChange={e => setSelectedRouteId(e.target.value)} required style={{ fontSize: '1rem', padding: '12px' }}>
              <option value="">{isAgentViewer ? 'Select your route / line' : 'Select Route'}</option>
              {localRoutes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {isAgentViewer && localRoutes.length === 0 && (
              <small style={{ color: 'var(--danger)' }}>No route assigned to you yet. Ask an admin to assign you a route in Settings.</small>
            )}
          </div>
        </div>

        {!isChit && (
          <>
        {/* --- Company / Business Details --- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px' }}>
          <h4 style={{ margin: 0, fontSize: '.9rem', fontWeight: 600 }}>🏢 Company / Business Details</h4>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCompany(v => !v)} style={{ padding: '4px 10px', fontSize: '.78rem' }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{showCompany ? 'expand_less' : 'expand_more'}</span>
            {showCompany ? 'Hide' : 'Add company details'}
          </button>
        </div>

        {showCompany && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '12px', background: 'var(--bg)' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              {/* Company logo */}
              <div style={{ textAlign: 'center' }}>
                <label style={{ cursor: 'pointer', display: 'block' }}>
                  <div style={{
                    width: '100px', height: '100px', borderRadius: 'var(--radius-sm)',
                    background: '#fff', border: '2px dashed var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : customer?.companyLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={customer.companyLogo} alt="Company logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span className="material-icons-outlined" style={{ fontSize: '32px', color: 'var(--text-light)' }}>add_business</span>
                    )}
                  </div>
                  {customer?.companyLogo && !logoFile && (
                    <input type="hidden" name="existingCompanyLogo" value={customer.companyLogo} />
                  )}
                  <input type="file" name="companyLogo" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
                  <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                    {logoFile?.name || (customer?.companyLogo ? 'Change logo' : 'Logo / Photo')}
                  </span>
                </label>
              </div>

              <div style={{ flex: 1 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Company / Business Name</label>
                    <input type="text" name="companyName" className="form-control" placeholder="Registered business name" defaultValue={customer?.companyName} style={{ fontSize: '1rem', padding: '10px' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Business Type</label>
                    <select name="businessType" className="form-control" defaultValue={customer?.businessType || ''} style={{ fontSize: '1rem', padding: '10px' }}>
                      <option value="">Select type</option>
                      <option value="proprietorship">Proprietorship</option>
                      <option value="partnership">Partnership</option>
                      <option value="pvt_ltd">Private Limited</option>
                      <option value="public_ltd">Public Limited</option>
                      <option value="llp">LLP</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Designation / Role</label>
                    <input type="text" name="designation" className="form-control" placeholder="Owner, Director, Partner..." defaultValue={customer?.designation} style={{ fontSize: '1rem', padding: '10px' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employment Type</label>
                    <select name="companyType" className="form-control" defaultValue={customer?.companyType || ''} style={{ fontSize: '1rem', padding: '10px' }}>
                      <option value="">Select</option>
                      <option value="business">Business</option>
                      <option value="self_employed">Self Employed</option>
                      <option value="salaried">Salaried</option>
                      <option value="unemployed">Unemployed</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-row" style={{ marginTop: '4px' }}>
              <div className="form-group">
                <label className="form-label">GST Number</label>
                <input type="text" name="gstNumber" className="form-control" placeholder="22ABCDE1234F1Z5" defaultValue={customer?.gstNumber} maxLength={15}
                  style={{ fontSize: '1rem', padding: '10px', textTransform: 'uppercase' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Company PAN</label>
                <input type="text" name="companyPan" className="form-control" placeholder="ABCDE1234F" defaultValue={customer?.companyPan} maxLength={10}
                  style={{ fontSize: '1rem', padding: '10px', textTransform: 'uppercase' }} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Registration / CIN Number</label>
                <input type="text" name="companyRegNo" className="form-control" placeholder="Company registration / CIN" defaultValue={customer?.companyRegNo} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Occupation / Nature of Business</label>
                <input type="text" name="occupation" className="form-control" placeholder="e.g. Textile trading" defaultValue={customer?.occupation} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Company Phone</label>
                <input type="tel" name="companyPhone" className="form-control" placeholder="Office contact number" defaultValue={customer?.companyPhone} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Company Email</label>
                <input type="email" name="companyEmail" className="form-control" placeholder="office@company.com" defaultValue={customer?.companyEmail} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Monthly Income / Turnover</label>
                <input type="number" name="monthlyIncome" className="form-control" placeholder="0" defaultValue={customer?.monthlyIncome ?? ''} min={0} step="0.01" style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Company Address</label>
                <input type="text" name="companyAddress" className="form-control" placeholder="Business address" defaultValue={customer?.companyAddress} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
            </div>
          </div>
        )}
          </>
        )}

        {/* --- Collection Points --- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px' }}>
          <h4 style={{ margin: 0, fontSize: '.9rem', fontWeight: 600 }}>📍 Collection Points</h4>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addCollectionPoint} style={{ padding: '4px 10px', fontSize: '.78rem' }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add_location</span>
            Add Point
          </button>
        </div>
        {collectionPoints.map((cp, index) => (
          <div key={cp.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '12px', background: 'var(--bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontSize: '.85rem' }}>Collection Point #{index + 1} {cp.isPrimary && <span className="badge badge-primary" style={{ marginLeft: 8 }}>Primary</span>}</strong>
              <button type="button" onClick={() => removeCollectionPoint(cp.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>delete</span>
              </button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Point Name / Label *</label>
                <input type="text" className="form-control" placeholder="e.g. Home, Shop, Office" value={cp.name} onChange={e => updateCollectionPoint(cp.id, 'name', e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} required />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.85rem', cursor: 'pointer', marginTop: '24px' }}>
                  <input type="checkbox" checked={cp.isPrimary} onChange={e => {
                    if (e.target.checked) {
                      setCollectionPoints(collectionPoints.map(p => ({ ...p, isPrimary: p.id === cp.id })));
                    }
                  }} />
                  Set as Primary
                </label>
              </div>
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>Address *</label>
                <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: '.75rem' }} onClick={() => updateCollectionPoint(cp.id, 'address', mainAddress)}>
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>content_copy</span> Same as primary address
                </button>
              </div>
              <textarea className="form-control" rows={2} placeholder="Collection address" value={cp.address} onChange={e => updateCollectionPoint(cp.id, 'address', e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input type="number" step="any" className="form-control" placeholder="Optional" value={cp.latitude || ''} onChange={e => updateCollectionPoint(cp.id, 'latitude', e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input type="number" step="any" className="form-control" placeholder="Optional" value={cp.longitude || ''} onChange={e => updateCollectionPoint(cp.id, 'longitude', e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} />
              </div>
              <div className="form-group" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => captureGpsForPoint(cp.id)} style={{ height: '42px', padding: '0 16px' }} title="Capture Current GPS">
                  <span className="material-icons-outlined">my_location</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* --- KYC Documents --- */}
        <h4 style={{ margin: '24px 0 12px', fontSize: '.9rem', fontWeight: 600 }}>📄 {dict.customers.documents}</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
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
          <input type="file" name="documents" accept="image/*,.pdf" capture="environment" multiple style={{ display: 'none' }}
            onChange={e => {
              const files = Array.from(e.target.files || []);
              setDocuments([...documents, ...files.map(f => ({ id: Date.now() + Math.random(), name: f.name }))]);
            }} />
        </label>


        {!isChit && (
          <>
        {/* --- Guarantors / Surety --- */}
        <h4 style={{ margin: '24px 0 12px', fontSize: '.9rem', fontWeight: 600 }}>🤝 {dict.customers.guarantors}</h4>
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
                <label className="form-label">{dict.customers.fullName} *</label>
                <input type="text" name={`guarantorName_${index}`} className="form-control" placeholder="Guarantor name" value={g.name}
                  onChange={e => updateGuarantor(g.id, 'name', e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} required />
              </div>
              <div className="form-group">
                <label className="form-label">{dict.customers.phone} *</label>
                <input type="tel" name={`guarantorPhone_${index}`} className="form-control" placeholder="Phone number" value={g.phone}
                  onChange={e => updateGuarantor(g.id, 'phone', e.target.value)} style={{ fontSize: '1rem', padding: '10px' }} required />
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
                  {guarantorPreviews[g.id] ? (
                    <img src={guarantorPreviews[g.id]} alt="Guarantor" style={{ width: '20px', height: '20px', objectFit: 'cover', borderRadius: '2px' }} />
                  ) : (
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{g.photoName ? 'check_circle' : 'add_a_photo'}</span>
                  )}
                  {g.photoName || 'Upload Photo'}
                  <input type="file" name={`guarantorPhoto_${index}`} accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={e => handleGuarantorPhotoChange(g.id, e.target.files?.[0] || null)} />
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
          </>
        )}

        {/* --- Submit --- */}
        <div className="form-actions" style={{ marginTop: '24px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
            {loading ? dict.customers.saving : dict.customers.submit}
          </button>
        </div>
      </form>

      {/* --- Modals --- */}
      {isRouteModalOpen && (
        <Modal isOpen={isRouteModalOpen} onClose={() => setIsRouteModalOpen(false)} title="Add New Route">
          <form onSubmit={handleCreateRoute}>
            <div className="form-group">
              <label className="form-label">Route Name</label>
              <input type="text" name="name" className="form-control" required />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setIsRouteModalOpen(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={creatingRoute}>
                {creatingRoute ? 'Creating...' : 'Create Route'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
