import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { MODULE_LABELS } from '@/types/modules';
import { reviewModuleRequest } from './actions';

export default async function AdminModuleRequestsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') redirect('/admin');

  const requests = await prisma.moduleRequest.findMany({
    where: { status: 'pending' },
    include: {
      requestedBy: { select: { name: true, username: true } },
      tenant: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  async function review(formData: FormData) {
    'use server';
    await reviewModuleRequest(formData);
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-content">
          <h1>Module Request Review</h1>
          <p className="text-muted">Approve or reject superadmin requests to enable new modules.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Requested By</th>
                <th>Module</th>
                <th>Reason</th>
                <th>Date</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center' }} className="text-muted">No pending module requests.</td></tr>
              )}
              {requests.map((req) => (
                <tr key={req.id}>
                  <td>
                    {req.tenant.name}
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>{req.tenant.slug}</div>
                  </td>
                  <td>
                    {req.requestedBy.name}
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>{req.requestedBy.username}</div>
                  </td>
                  <td>
                    <span className="badge badge-pending">
                      {MODULE_LABELS[req.appType as keyof typeof MODULE_LABELS] || req.appType}
                    </span>
                  </td>
                  <td>{req.reason || '—'}</td>
                  <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {new Date(req.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <form action={review} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="hidden" name="requestId" value={req.id} />
                      <textarea name="reviewNote" className="form-control" rows={1} placeholder="Note (optional)" style={{ minWidth: '140px', resize: 'vertical', fontSize: '0.85rem' }} />
                      <button type="submit" name="decision" value="approved" className="btn btn-primary btn-sm">Approve</button>
                      <button type="submit" name="decision" value="rejected" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>Reject</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
