import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { MODULE_LABELS, normalizeModuleList } from '@/types/modules';
import { reviewBranchRequest } from './actions';

export default async function AdminBranchRequestsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') redirect('/admin');

  const requests = await prisma.branchRequest.findMany({
    where: { status: 'pending' },
    include: {
      requestedBy: { select: { name: true, username: true } },
      branch: { select: { name: true } },
      tenant: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  async function review(formData: FormData) {
    'use server';
    await reviewBranchRequest(formData);
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>Branch Request Review</h1>
          <p className="text-muted">Approve new branches and branch module changes.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Requested By</th>
                <th>Branch</th>
                <th>Modules</th>
                <th>Reason</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const modules = normalizeModuleList(request.requestedModules);
                return (
                  <tr key={request.id}>
                    <td>{request.tenant.name}<div className="text-muted">{request.tenant.slug}</div></td>
                    <td>{request.requestedBy.name}<div className="text-muted">{request.requestedBy.username}</div></td>
                    <td>{request.branch?.name || request.branchName || 'New Branch'}</td>
                    <td>{modules.map((module) => MODULE_LABELS[module]).join(', ')}</td>
                    <td>{request.reason || '-'}</td>
                    <td>
                      <form action={review} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <input name="reviewNote" className="form-control" placeholder="Note" style={{ minWidth: '140px' }} />
                        <button name="decision" value="approved" className="btn btn-primary btn-sm">Approve</button>
                        <button name="decision" value="rejected" className="btn btn-ghost btn-sm">Reject</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {requests.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>No pending requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
