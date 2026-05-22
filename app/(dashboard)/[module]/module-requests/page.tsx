import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { ALL_MODULES, MODULE_LABELS, modulePath, normalizeModuleList } from '@/types/modules';
import { submitModuleRequest } from './actions';

export default async function ModuleRequestsPage() {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'superadmin') redirect(modulePath(await getUserAppType(), '/dashboard'));

  const tenantId = await getDefaultTenantId();
  const [subscription, requests] = await Promise.all([
    prisma.tenantSubscription.findUnique({ where: { tenantId }, select: { enabledModules: true } }),
    prisma.moduleRequest.findMany({
      where: { tenantId, requestedById: user.id },
      include: { reviewedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const enabledModules = normalizeModuleList(subscription?.enabledModules);
  const missingModules = ALL_MODULES.filter((m) => !enabledModules.includes(m));

  async function submit(formData: FormData) {
    'use server';
    await submitModuleRequest(formData);
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>Module Requests</h1>
          <p className="text-muted">Request the developer to enable additional modules for your subscription.</p>
        </div>
      </div>

      {missingModules.length > 0 ? (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3>Request a New Module</h3>
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            <form action={submit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Module</label>
                  <select name="appType" className="form-control" required>
                    <option value="">Select module…</option>
                    {missingModules.map((m) => (
                      <option key={m} value={m}>{MODULE_LABELS[m]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason (optional)</label>
                <textarea name="reason" className="form-control" rows={3} placeholder="Why do you need this module?" />
              </div>
              <button type="submit" className="btn btn-primary">Submit Request</button>
            </form>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
          <p className="text-muted">All available modules are already enabled in your subscription.</p>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Past Requests</h3>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Review Note</th>
                <th>Reviewed By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center' }} className="text-muted">No requests yet.</td></tr>
              )}
              {requests.map((req) => (
                <tr key={req.id}>
                  <td><span className="badge badge-pending">{MODULE_LABELS[req.appType as keyof typeof MODULE_LABELS] || req.appType}</span></td>
                  <td>{req.reason || '—'}</td>
                  <td>
                    <span className={`badge ${req.status === 'approved' ? 'badge-active' : req.status === 'rejected' ? 'badge-closed' : 'badge-pending'}`}>
                      {req.status}
                    </span>
                  </td>
                  <td>{req.reviewNote || '—'}</td>
                  <td>{req.reviewedBy?.name || '—'}</td>
                  <td className="text-muted" style={{ fontSize: '0.8rem' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
