'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';

type PlanCatalogItem = {
  id: string;
  plan: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  maxBranches: number;
  maxAgents: number;
  maxActiveLoans: number;
  features: string[];
  razorpayPlanId: string | null;
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
};

type ModuleCatalogItem = {
  id: string;
  module: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  isActive: boolean;
  sortOrder: number;
};

type AddonCatalogItem = {
  id: string;
  addon: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  isActive: boolean;
  sortOrder: number;
};

type Props = {
  initialPlans: PlanCatalogItem[];
  initialModules: ModuleCatalogItem[];
  initialAddons: AddonCatalogItem[];
};

export default function PricingClient({
  initialPlans,
  initialModules,
  initialAddons,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'plans' | 'modules' | 'addons'>('plans');

  // Lists state
  const [plans, setPlans] = useState<PlanCatalogItem[]>(initialPlans);
  const [modules, setModules] = useState<ModuleCatalogItem[]>(initialModules);
  const [addons, setAddons] = useState<AddonCatalogItem[]>(initialAddons);

  // Modals state
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);

  // Editing items state (null means adding new)
  const [editingPlan, setEditingPlan] = useState<PlanCatalogItem | null>(null);
  const [editingModule, setEditingModule] = useState<ModuleCatalogItem | null>(null);
  const [editingAddon, setEditingAddon] = useState<AddonCatalogItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Save Plan
  const handleSavePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const id = editingPlan?.id;
    const plan = formData.get('plan') as string;
    const displayName = formData.get('displayName') as string;
    const description = formData.get('description') as string;
    const monthlyPrice = Number(formData.get('monthlyPrice'));
    const maxBranches = Number(formData.get('maxBranches'));
    const maxAgents = Number(formData.get('maxAgents'));
    const maxActiveLoans = Number(formData.get('maxActiveLoans'));
    const razorpayPlanId = formData.get('razorpayPlanId') as string;
    const trialDays = Number(formData.get('trialDays') ?? 0);
    const isActive = formData.get('isActive') === 'true';
    const sortOrder = Number(formData.get('sortOrder'));

    const featuresText = formData.get('features') as string;
    const features = featuresText
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    try {
      const res = await fetch('/api/developer/pricing/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          plan,
          displayName,
          description,
          monthlyPrice,
          maxBranches,
          maxAgents,
          maxActiveLoans,
          features,
          razorpayPlanId,
          trialDays,
          isActive,
          sortOrder,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save subscription plan');
      }

      // Refresh list
      const updatedPlan = data.plan;
      const formattedUpdated = {
        ...updatedPlan,
        features: JSON.parse(updatedPlan.features),
      };

      if (id) {
        setPlans(plans.map((p) => (p.id === id ? formattedUpdated : p)));
      } else {
        setPlans([...plans, formattedUpdated].sort((a, b) => a.sortOrder - b.sortOrder));
      }

      setIsPlanModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Save Module Pricing
  const handleSaveModule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const id = editingModule?.id;
    const moduleKey = formData.get('module') as string;
    const displayName = formData.get('displayName') as string;
    const description = formData.get('description') as string;
    const monthlyPrice = Number(formData.get('monthlyPrice'));
    const isActive = formData.get('isActive') === 'true';
    const sortOrder = Number(formData.get('sortOrder'));

    try {
      const res = await fetch('/api/developer/pricing/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          module: moduleKey,
          displayName,
          description,
          monthlyPrice,
          isActive,
          sortOrder,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save module pricing');
      }

      const updated = data.module;
      if (id) {
        setModules(modules.map((m) => (m.id === id ? updated : m)));
      } else {
        setModules([...modules, updated].sort((a, b) => a.sortOrder - b.sortOrder));
      }

      setIsModuleModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Save Addon Pricing
  const handleSaveAddon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const id = editingAddon?.id;
    const addonKey = formData.get('addon') as string;
    const displayName = formData.get('displayName') as string;
    const description = formData.get('description') as string;
    const monthlyPrice = Number(formData.get('monthlyPrice'));
    const isActive = formData.get('isActive') === 'true';
    const sortOrder = Number(formData.get('sortOrder'));

    try {
      const res = await fetch('/api/developer/pricing/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          addon: addonKey,
          displayName,
          description,
          monthlyPrice,
          isActive,
          sortOrder,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save addon pricing');
      }

      const updated = data.addon;
      if (id) {
        setAddons(addons.map((a) => (a.id === id ? updated : a)));
      } else {
        setAddons([...addons, updated].sort((a, b) => a.sortOrder - b.sortOrder));
      }

      setIsAddonModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>⚙️ System Pricing Settings</h1>
          <p className="text-muted">
            Configure system plans, module additions, and platform addon capabilities pricing.
          </p>
        </div>
        <div className="header-actions">
          {activeTab === 'plans' && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingPlan(null);
                setError('');
                setIsPlanModalOpen(true);
              }}
            >
              <span className="material-icons-outlined">add</span> Add Subscription Plan
            </button>
          )}
          {activeTab === 'modules' && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingModule(null);
                setError('');
                setIsModuleModalOpen(true);
              }}
            >
              <span className="material-icons-outlined">add</span> Add Module Pricing
            </button>
          )}
          {activeTab === 'addons' && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingAddon(null);
                setError('');
                setIsAddonModalOpen(true);
              }}
            >
              <span className="material-icons-outlined">add</span> Add Add-on Pricing
            </button>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="tab-menu" style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button
          className={`btn ${activeTab === 'plans' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('plans')}
        >
          Subscription Plans
        </button>
        <button
          className={`btn ${activeTab === 'modules' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('modules')}
        >
          Modules pricing
        </button>
        <button
          className={`btn ${activeTab === 'addons' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('addons')}
        >
          Add-ons Pricing
        </button>
      </div>

      {/* Plans Tab Content */}
      {activeTab === 'plans' && (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Plan Key</th>
                  <th>Display Name</th>
                  <th>Monthly Price</th>
                  <th>Max Branches</th>
                  <th>Max Agents</th>
                  <th>Max Loans</th>
                  <th>Trial</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="badge badge-pending" style={{ textTransform: 'uppercase' }}>
                        {p.plan}
                      </span>
                    </td>
                    <td>
                      <strong>{p.displayName}</strong>
                      {p.description && (
                        <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td>₹{p.monthlyPrice}/mo</td>
                    <td>{p.maxBranches === 999 ? 'Unlimited' : p.maxBranches}</td>
                    <td>{p.maxAgents === 999 ? 'Unlimited' : p.maxAgents}</td>
                    <td>{p.maxActiveLoans === 999999 ? 'Unlimited' : p.maxActiveLoans}</td>
                    <td>
                      {p.trialDays > 0
                        ? <span className="badge badge-warning">{p.trialDays}d free</span>
                        : <span className="text-muted" style={{ fontSize: '.78rem' }}>—</span>}
                    </td>
                    <td>
                      <span className={`badge ${p.isActive ? 'badge-active' : 'badge-closed'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditingPlan(p);
                          setError('');
                          setIsPlanModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modules Tab Content */}
      {activeTab === 'modules' && (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Module Key</th>
                  <th>Display Name</th>
                  <th>Monthly Price</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className="badge badge-pending" style={{ fontFamily: 'monospace' }}>
                        {m.module}
                      </span>
                    </td>
                    <td><strong>{m.displayName}</strong></td>
                    <td>{m.monthlyPrice === 0 ? 'Included' : `₹${m.monthlyPrice}/mo`}</td>
                    <td className="text-muted" style={{ fontSize: '0.8rem' }}>{m.description}</td>
                    <td>
                      <span className={`badge ${m.isActive ? 'badge-active' : 'badge-closed'}`}>
                        {m.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditingModule(m);
                          setError('');
                          setIsModuleModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Addons Tab Content */}
      {activeTab === 'addons' && (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Add-on Key</th>
                  <th>Display Name</th>
                  <th>Monthly Price</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {addons.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="badge badge-pending" style={{ fontFamily: 'monospace' }}>
                        {a.addon}
                      </span>
                    </td>
                    <td><strong>{a.displayName}</strong></td>
                    <td>₹{a.monthlyPrice}/mo</td>
                    <td className="text-muted" style={{ fontSize: '0.8rem' }}>{a.description}</td>
                    <td>
                      <span className={`badge ${a.isActive ? 'badge-active' : 'badge-closed'}`}>
                        {a.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditingAddon(a);
                          setError('');
                          setIsAddonModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plan modal */}
      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        title={editingPlan ? `Edit Subscription Plan: ${editingPlan.displayName}` : 'Add Subscription Plan'}
      >
        {error && <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>}
        <form onSubmit={handleSavePlan}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Plan Key Identifier</label>
              <input
                type="text"
                name="plan"
                className="form-control"
                placeholder="e.g. trial, basic, pro, enterprise"
                defaultValue={editingPlan?.plan}
                required
                disabled={!!editingPlan}
              />
              {/* Disabled inputs don't submit — carry the value via a hidden field when editing */}
              {editingPlan && <input type="hidden" name="plan" value={editingPlan.plan} />}
            </div>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                name="displayName"
                className="form-control"
                placeholder="e.g. Starter Pack"
                defaultValue={editingPlan?.displayName}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Plan Description</label>
            <input
              type="text"
              name="description"
              className="form-control"
              placeholder="Brief tagline"
              defaultValue={editingPlan?.description || ''}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Monthly Price (INR)</label>
              <input
                type="number"
                name="monthlyPrice"
                className="form-control"
                defaultValue={editingPlan?.monthlyPrice ?? 0}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Branches Capacity</label>
              <input
                type="number"
                name="maxBranches"
                className="form-control"
                defaultValue={editingPlan?.maxBranches ?? 1}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Max Active Agents</label>
              <input
                type="number"
                name="maxAgents"
                className="form-control"
                defaultValue={editingPlan?.maxAgents ?? 3}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Active Loans</label>
              <input
                type="number"
                name="maxActiveLoans"
                className="form-control"
                defaultValue={editingPlan?.maxActiveLoans ?? 50}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Plan Highlight Features (one per line)</label>
            <textarea
              name="features"
              className="form-control"
              rows={4}
              placeholder="Line 1 feature&#10;Line 2 feature"
              defaultValue={editingPlan?.features.join('\n') || ''}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Razorpay Plan ID</label>
              <input
                type="text"
                name="razorpayPlanId"
                className="form-control"
                placeholder="plan_XYZ123"
                defaultValue={editingPlan?.razorpayPlanId || ''}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Free Trial (days)</label>
              <input
                type="number"
                name="trialDays"
                className="form-control"
                min={0}
                defaultValue={editingPlan?.trialDays ?? 0}
              />
              <small className="text-muted" style={{ fontSize: '.75rem' }}>
                0 = no trial. Enterprise = 15 (full access, no payment).
              </small>
            </div>
            <div className="form-group">
              <label className="form-label">Sort Order</label>
              <input
                type="number"
                name="sortOrder"
                className="form-control"
                defaultValue={editingPlan?.sortOrder ?? 0}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Is Active</label>
              <select name="isActive" className="form-control" defaultValue={editingPlan?.isActive ? 'true' : 'false'}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Plan'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsPlanModalOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Module modal */}
      <Modal
        isOpen={isModuleModalOpen}
        onClose={() => setIsModuleModalOpen(false)}
        title={editingModule ? `Edit Module Pricing: ${editingModule.displayName}` : 'Add Module Pricing'}
      >
        {error && <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>}
        <form onSubmit={handleSaveModule}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Module Key Identifier</label>
              <input
                type="text"
                name="module"
                className="form-control"
                placeholder="e.g. microlending, autofinance, chitfunds"
                defaultValue={editingModule?.module}
                required
                disabled={!!editingModule}
              />
              {editingModule && <input type="hidden" name="module" value={editingModule.module} />}
            </div>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                name="displayName"
                className="form-control"
                placeholder="e.g. Auto Finance Module"
                defaultValue={editingModule?.displayName}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Module Description</label>
            <input
              type="text"
              name="description"
              className="form-control"
              placeholder="Brief details about module"
              defaultValue={editingModule?.description || ''}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Monthly Add-on Price (INR)</label>
              <input
                type="number"
                name="monthlyPrice"
                className="form-control"
                defaultValue={editingModule?.monthlyPrice ?? 0}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sort Order</label>
              <input
                type="number"
                name="sortOrder"
                className="form-control"
                defaultValue={editingModule?.sortOrder ?? 0}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Is Active</label>
              <select name="isActive" className="form-control" defaultValue={editingModule?.isActive ? 'true' : 'false'}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Module'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsModuleModalOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Addon modal */}
      <Modal
        isOpen={isAddonModalOpen}
        onClose={() => setIsAddonModalOpen(false)}
        title={editingAddon ? `Edit Add-on Pricing: ${editingAddon.displayName}` : 'Add Add-on Pricing'}
      >
        {error && <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>}
        <form onSubmit={handleSaveAddon}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Add-on Key Identifier</label>
              <input
                type="text"
                name="addon"
                className="form-control"
                placeholder="e.g. kyc, gps_tracking, whatsapp_sms"
                defaultValue={editingAddon?.addon}
                required
                disabled={!!editingAddon}
              />
              {editingAddon && <input type="hidden" name="addon" value={editingAddon.addon} />}
            </div>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                name="displayName"
                className="form-control"
                placeholder="e.g. Premium Accounting"
                defaultValue={editingAddon?.displayName}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Add-on Description</label>
            <input
              type="text"
              name="description"
              className="form-control"
              placeholder="Brief details about add-on"
              defaultValue={editingAddon?.description || ''}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Monthly Add-on Price (INR)</label>
              <input
                type="number"
                name="monthlyPrice"
                className="form-control"
                defaultValue={editingAddon?.monthlyPrice ?? 0}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sort Order</label>
              <input
                type="number"
                name="sortOrder"
                className="form-control"
                defaultValue={editingAddon?.sortOrder ?? 0}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Is Active</label>
              <select name="isActive" className="form-control" defaultValue={editingAddon?.isActive ? 'true' : 'false'}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Add-on'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIsAddonModalOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
