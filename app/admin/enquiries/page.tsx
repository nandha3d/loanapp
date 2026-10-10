import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getEnquiries, getEnquiryStats } from '@/lib/enquiries';
import { changeEnquiryStatus, deleteEnquiryAction } from './actions';
import Link from 'next/link';

interface PageProps {
  searchParams?: Promise<{ status?: string }>;
}

export default async function AdminEnquiriesPage({ searchParams }: PageProps) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') redirect('/admin');

  const resolvedParams = searchParams ? await searchParams : {};
  const currentFilter = resolvedParams.status || 'all';

  const [enquiries, stats] = await Promise.all([
    getEnquiries(currentFilter),
    getEnquiryStats()
  ]);

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '32px', color: '#E94560' }}>contact_phone</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800 }}>Platform Enquiries & Leads</h1>
              <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.88rem' }}>
                Track and follow up with leads captured from the Zolo Assistant chatbot, live demo bookings, and website forms.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '18px 20px', borderRadius: '12px', borderLeft: '4px solid #7D287E' }}>
          <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Inquiries</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>{stats.total}</div>
        </div>
        <div className="card" style={{ padding: '18px 20px', borderRadius: '12px', borderLeft: '4px solid #E94560' }}>
          <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>New / Unread</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#E94560', marginTop: '6px' }}>{stats.newCount}</div>
        </div>
        <div className="card" style={{ padding: '18px 20px', borderRadius: '12px', borderLeft: '4px solid #3B82F6' }}>
          <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Contacted</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#3B82F6', marginTop: '6px' }}>{stats.contacted}</div>
        </div>
        <div className="card" style={{ padding: '18px 20px', borderRadius: '12px', borderLeft: '4px solid #22C55E' }}>
          <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Converted Clients</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#22C55E', marginTop: '6px' }}>{stats.converted}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        {[
          { label: 'All Inquiries', value: 'all' },
          { label: 'New', value: 'new' },
          { label: 'Contacted', value: 'contacted' },
          { label: 'Converted', value: 'converted' },
          { label: 'Closed', value: 'closed' }
        ].map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/enquiries?status=${tab.value}`}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              background: currentFilter === tab.value ? '#1A1A2E' : '#F1F5F9',
              color: currentFilter === tab.value ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Enquiries Table */}
      <div className="card" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px' }}>Contact & Firm</th>
                <th style={{ padding: '14px 16px' }}>Phone / WhatsApp</th>
                <th style={{ padding: '14px 16px' }}>Vertical</th>
                <th style={{ padding: '14px 16px' }}>Location</th>
                <th style={{ padding: '14px 16px' }}>Channel</th>
                <th style={{ padding: '14px 16px' }}>Date</th>
                <th style={{ padding: '14px 16px' }}>Status</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>No inquiries found in this view.</div>
                    <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>Demo requests submitted from the website or Zolo Assistant will show up here automatically.</p>
                  </td>
                </tr>
              ) : (
                enquiries.map((enq) => {
                  const cleanPhone = (enq.phone || '').replace(/[^0-9]/g, '');
                  const dateStr = enq.created_at
                    ? new Date(enq.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'N/A';

                  const badgeColors: Record<string, { bg: string; text: string }> = {
                    new: { bg: '#FEE2E2', text: '#DC2626' },
                    contacted: { bg: '#DBEAFE', text: '#1D4ED8' },
                    converted: { bg: '#DCFCE7', text: '#15803D' },
                    closed: { bg: '#F1F5F9', text: '#64748B' }
                  };
                  const badge = badgeColors[enq.status] || badgeColors.new;

                  return (
                    <tr key={enq.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{enq.name}</div>
                        {enq.company && (
                          <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                            {enq.company}
                          </div>
                        )}
                        {enq.message && (
                          <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px', fontStyle: 'italic', maxWidth: '240px' }}>
                            "{enq.message}"
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <a
                            href={`tel:${enq.phone}`}
                            style={{
                              color: '#7D287E',
                              fontWeight: 700,
                              textDecoration: 'none',
                              fontSize: '0.9rem'
                            }}
                          >
                            {enq.phone}
                          </a>
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/91${cleanPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Message on WhatsApp"
                              style={{
                                background: '#25D366',
                                color: '#FFFFFF',
                                padding: '3px 7px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', textTransform: 'capitalize', color: '#334155' }}>
                        {enq.vertical || 'Microfinance'}
                      </td>

                      <td style={{ padding: '14px 16px', color: '#475569' }}>
                        {enq.city || '—'}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: enq.source === 'chat_assistant' ? '#F3E8FF' : '#E0F2FE',
                            color: enq.source === 'chat_assistant' ? '#6B21A8' : '#0369A1',
                            fontWeight: 600
                          }}
                        >
                          {enq.source === 'chat_assistant' ? '🤖 Zolo Chat' : '🌐 Web Demo'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', color: '#64748B', fontSize: '0.82rem' }}>
                        {dateStr}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '99px',
                            background: badge.bg,
                            color: badge.text,
                            textTransform: 'uppercase'
                          }}
                        >
                          {enq.status}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <form action={changeEnquiryStatus} style={{ display: 'inline' }}>
                            <input type="hidden" name="id" value={enq.id} />
                            <select
                              name="status"
                              defaultValue={enq.status}
                              onChange={(e) => e.target.form?.requestSubmit()}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                fontSize: '0.78rem',
                                color: '#334155',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="new">New</option>
                              <option value="contacted">Contacted</option>
                              <option value="converted">Converted</option>
                              <option value="closed">Closed</option>
                            </select>
                          </form>

                          <form action={deleteEnquiryAction} style={{ display: 'inline' }}>
                            <input type="hidden" name="id" value={enq.id} />
                            <button
                              type="submit"
                              title="Delete"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#94A3B8',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                              onClick={(e) => {
                                if (!confirm('Are you sure you want to remove this enquiry?')) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>delete</span>
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
