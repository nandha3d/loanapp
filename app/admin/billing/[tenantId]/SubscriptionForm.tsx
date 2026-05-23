'use client';

import { useState } from 'react';
import { updateSubscription } from '../billingActions';
import { MODULE_LABELS, PLAN_LABELS, PLAN_FEATURES } from '@/lib/plans';

export default function SubscriptionForm({
  tenantId,
  tenantName,
  subscription,
  enabledModules: initialEnabledModules,
}: {
  tenantId: string;
  tenantName: string;
  subscription: any;
  enabledModules: string[];
}) {
  const [plan, setPlan] = useState(subscription?.plan || 'trial');
  const [maxLoans, setMaxLoans] = useState(subscription?.maxActiveLoans ?? 50);
  const [maxAgents, setMaxAgents] = useState(subscription?.maxAgents ?? 3);
  const [maxBranches, setMaxBranches] = useState(subscription?.maxBranches ?? 1);
  const [enabledModules, setEnabledModules] = useState<string[]>(initialEnabledModules);

  const PLANS = Object.keys(PLAN_LABELS);
  const MODULES = Object.keys(MODULE_LABELS);

  const handlePlanChange = (newPlan: string) => {
    setPlan(newPlan);
    const features = PLAN_FEATURES[newPlan];
    if (features) {
      setMaxLoans(features.loans);
      setMaxAgents(features.agents);
      setMaxBranches(features.branches);
      setEnabledModules(features.modules);
    }
  };

  const handleModuleToggle = (mod: string) => {
    setEnabledModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const formatDateForInput = (date: any) => {
    if (!date) return '';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  return (
    <form action={async (fd) => { await updateSubscription(fd); }}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label className="form-label">Plan</label>
        <select
          name="plan"
          className="form-control"
          value={plan}
          onChange={(e) => handlePlanChange(e.target.value)}
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {PLAN_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label className="form-label">Status</label>
        <select name="status" className="form-control" defaultValue={subscription?.status || 'active'}>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="form-group">
          <label className="form-label">Max Active Loans</label>
          <input
            name="maxActiveLoans"
            type="number"
            className="form-control"
            value={maxLoans}
            onChange={(e) => setMaxLoans(parseInt(e.target.value) || 0)}
            min="1"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Max Agents</label>
          <input
            name="maxAgents"
            type="number"
            className="form-control"
            value={maxAgents}
            onChange={(e) => setMaxAgents(parseInt(e.target.value) || 0)}
            min="1"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Max Branches</label>
          <input
            name="maxBranches"
            type="number"
            className="form-control"
            value={maxBranches}
            onChange={(e) => setMaxBranches(parseInt(e.target.value) || 0)}
            min="1"
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label className="form-label">Enabled Modules</label>
        <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
          {MODULES.map((m) => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="enabledModules"
                value={m}
                checked={enabledModules.includes(m)}
                onChange={() => handleModuleToggle(m)}
              />
              {MODULE_LABELS[m]}
            </label>
          ))}
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label className="form-label">Add-ons</label>
        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="whatsappSmsEnabled"
              value="true"
              defaultChecked={subscription?.whatsappSmsEnabled || false}
            />
            Allow WhatsApp & SMS Notifications
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="receiptPdfAllowed"
              value="true"
              defaultChecked={subscription?.receiptPdfAllowed || false}
            />
            Allow Receipt PDF Downloads
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="bureauEnabled"
              value="true"
              defaultChecked={subscription?.bureauEnabled || false}
            />
            Allow Credit Bureau Checks (CRIF/CIBIL)
          </label>
           <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="npaEnabled"
              value="true"
              defaultChecked={subscription?.npaEnabled || false}
            />
            Allow NPA Classification Engine (RBI Compliance)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="kycEnabled"
              value="true"
              defaultChecked={subscription?.kycEnabled || false}
            />
            Allow Aadhaar OTP & Video KYC Verification (Digio)
          </label>
        </div>
      </div>


      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label className="form-label">Included Monthly Bureau Pulls</label>
        <input
          name="bureauPullsIncluded"
          type="number"
          className="form-control"
          defaultValue={subscription?.bureauPullsIncluded ?? 50}
          min="0"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="form-group">
          <label className="form-label">Trial Ends At</label>
          <input
            name="trialEndsAt"
            type="date"
            className="form-control"
            defaultValue={formatDateForInput(subscription?.trialEndsAt)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Current Period End</label>
          <input
            name="currentPeriodEnd"
            type="date"
            className="form-control"
            defaultValue={formatDateForInput(subscription?.currentPeriodEnd)}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label className="form-label">Razorpay Sub ID</label>
        <input
          name="razorpaySubId"
          type="text"
          className="form-control"
          defaultValue={subscription?.razorpaySubId || ''}
          placeholder="sub_xxx..."
        />
      </div>

      <button type="submit" className="btn btn-primary">
        Save Changes
      </button>
    </form>
  );
}
