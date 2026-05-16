import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { ALL_MODULES, MODULE_LABELS, normalizeModuleList } from '@/types/modules';
import { submitBranchRequest } from './actions';

export default async function BranchRequestsPage() {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== 'superadmin') redirect('/dashboard');

  const tenantId = await getDefaultTenantId();
  const [branches, requests] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId, superadminId: user.id, status: 'active' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, enabledModules: true },
    }),
    prisma.branchRequest.findMany({
      where: { tenantId, requestedById: user.id },
      include: { branch: { select: { name: true } }, reviewedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  async function submit(formData: FormData) {
    'use server';
    await submitBranchRequest(formData);
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>Branch Requests</h1>
          <p className="text-muted">Request new branches or module changes for your branches.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Submit Request</h2>
        <form action={submit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Existing Branch</label>
              <select name="branchId" className="form-control" defaultValue="">
                <option value="">New branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">New Branch Name</label>
              <input name="branchName" className="form-control" placeholder="Required for a new branch" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Requested Modules</label>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {ALL_MODULES.map((module) => (
                <label key={module} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="checkbox" name="requestedModules" value={module} />
                  {MODULE_LABELS[module]}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason</label>
            <textarea name="reason" className="form-control" rows={3} />
          </div>

          <button type="submit" className="btn btn-primary">Submit Request</button>
        </form>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Modules</th>
                <th>Status</th>
                <th>Reviewed By</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const modules = normalizeModuleList(request.requestedModules);
                return (
                  <tr key={request.id}>
                    <td>{request.branch?.name || request.branchName || 'New Branch'}</td>
                    <td>{modules.map((module) => MODULE_LABELS[module]).join(', ')}</td>
                    <td><span className="badge badge-pending">{request.status}</span></td>
                    <td>{request.reviewedBy?.name || '-'}</td>
                  </tr>
                );
              })}
              {requests.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>No requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
