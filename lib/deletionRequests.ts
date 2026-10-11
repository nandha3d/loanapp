import { randomBytes } from 'crypto';
import prisma from '@/lib/db';
import { sendPlatformEmail } from '@/lib/notify/channels/email';
import { escapeHtml } from '@/lib/escapeHtml';

/**
 * Account & data deletion requests from the public /delete-account page
 * (Google Play User Data policy + DPDP Act right to erasure).
 *
 * Requests are queued here and processed by the ZoloFund team from the
 * developer console (/admin/deletion-requests). Nothing is deleted
 * automatically — the page copy says exactly that.
 */

export const DELETION_ROLES = ['field_agent', 'branch_manager', 'superadmin', 'borrower'] as const;
export type DeletionRole = (typeof DELETION_ROLES)[number];

export const DELETION_STATUSES = ['new', 'in_progress', 'completed', 'rejected'] as const;
export type DeletionStatus = (typeof DELETION_STATUSES)[number];

const ROLE_LABEL: Record<DeletionRole, string> = {
  field_agent: 'Field collection agent',
  branch_manager: 'Branch manager / staff',
  superadmin: 'Business owner / superadmin',
  borrower: 'Borrower / customer',
};

export interface DeletionRequestInput {
  name: string;
  email: string;
  phone: string;
  role: DeletionRole;
  organization?: string | null;
  reason?: string | null;
  ip?: string | null;
}

export interface DeletionRequestRecord {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  organization: string | null;
  reason: string | null;
  status: string;
  admin_note: string | null;
  ip: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function ensureDeletionRequestsTable(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe(`
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id VARCHAR(191) PRIMARY KEY,
        reference VARCHAR(32) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        role VARCHAR(50) NOT NULL,
        organization VARCHAR(255) NULL,
        reason TEXT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'new',
        admin_note TEXT NULL,
        ip VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_reference (reference),
        INDEX idx_status_created (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err: any) {
    console.warn('[ensureDeletionRequestsTable warning]', err?.message || err);
  }
}

export async function createDeletionRequest(input: DeletionRequestInput): Promise<{ id: string; reference: string }> {
  await ensureDeletionRequestsTable();

  const id = `del_${Date.now()}_${randomBytes(3).toString('hex')}`;
  const reference = `DEL-${randomBytes(4).toString('hex').toUpperCase()}`;

  await prisma.$queryRawUnsafe(
    `INSERT INTO account_deletion_requests (id, reference, name, email, phone, role, organization, reason, status, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
    id,
    reference,
    input.name.trim().slice(0, 255),
    input.email.trim().toLowerCase().slice(0, 255),
    input.phone.trim().slice(0, 50),
    input.role,
    input.organization ? input.organization.trim().slice(0, 255) : null,
    input.reason ? input.reason.trim().slice(0, 2000) : null,
    input.ip ? input.ip.slice(0, 64) : null,
  );

  return { id, reference };
}

export async function getDeletionRequests(statusFilter?: string): Promise<DeletionRequestRecord[]> {
  await ensureDeletionRequestsTable();
  if (statusFilter && statusFilter !== 'all') {
    return prisma.$queryRawUnsafe<DeletionRequestRecord[]>(
      `SELECT * FROM account_deletion_requests WHERE status = ? ORDER BY created_at DESC`,
      statusFilter,
    );
  }
  return prisma.$queryRawUnsafe<DeletionRequestRecord[]>(
    `SELECT * FROM account_deletion_requests ORDER BY created_at DESC`,
  );
}

export async function countOpenDeletionRequests(): Promise<number> {
  try {
    const res: any = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as c FROM account_deletion_requests WHERE status IN ('new', 'in_progress')`,
    );
    return Number(res[0]?.c || 0);
  } catch {
    return 0; // table not created yet
  }
}

export async function updateDeletionRequestStatus(id: string, status: DeletionStatus, adminNote?: string | null) {
  await ensureDeletionRequestsTable();
  await prisma.$queryRawUnsafe(
    `UPDATE account_deletion_requests SET status = ?, admin_note = ?, updated_at = NOW() WHERE id = ?`,
    status,
    adminNote ? adminNote.trim().slice(0, 2000) : null,
    id,
  );
}

const SUPPORT_INBOX = process.env.SUPPORT_EMAIL || 'support@zolofunds.com';

function row(label: string, value: string) {
  return `<tr><td style="padding:8px 0;color:#64748b;width:38%"><strong>${label}</strong></td><td style="padding:8px 0;color:#0f172a">${value}</td></tr>`;
}

/** Alert the ZoloFund team. Reply-To = requester so support can answer directly. */
export async function sendDeletionRequestToSupport(input: DeletionRequestInput, reference: string): Promise<boolean> {
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:#4A124B;color:#fff;padding:20px 24px">
        <h2 style="margin:0;font-size:20px">Account deletion request ${escapeHtml(reference)}</h2>
        <p style="margin:6px 0 0;font-size:13px;color:#FCF6AB">Process within 7 business days — verify the requester first.</p>
      </div>
      <div style="padding:20px 24px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${row('Name', escapeHtml(input.name))}
          ${row('Email', escapeHtml(input.email))}
          ${row('Phone', escapeHtml(input.phone))}
          ${row('Role', escapeHtml(ROLE_LABEL[input.role]))}
          ${row('Organisation', escapeHtml(input.organization || '—'))}
          ${row('Reason', escapeHtml(input.reason || '—'))}
        </table>
        <p style="font-size:13px;color:#475569;margin-top:16px">
          ${input.role === 'borrower'
            ? 'Borrower request: the lender is the data fiduciary — forward to the lender named above and confirm with the requester.'
            : 'Staff request: confirm identity via the registered email/phone, inform the organisation owner, revoke access and remove personal identifiers.'}
          Track it in the developer console → Deletion Requests.
        </p>
      </div>
    </div>`;
  const res = await sendPlatformEmail(SUPPORT_INBOX, `Account deletion request ${reference} — ${input.name}`, html, {
    replyTo: input.email,
  });
  return res.success;
}

/** Acknowledgement to the requester. States only what will actually happen. */
export async function sendDeletionAcknowledgement(input: DeletionRequestInput, reference: string): Promise<boolean> {
  const borrower = input.role === 'borrower';
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;font-size:14px;line-height:1.6">
      <p>Hello ${escapeHtml(input.name)},</p>
      <p>We have received your request to delete your Zolo Funds account and personal data. Your reference number is <strong>${escapeHtml(reference)}</strong>.</p>
      <p>What happens next:</p>
      <ol>
        <li>Our team will contact you on this email or your registered mobile number to confirm the request came from you.</li>
        ${borrower
          ? '<li>Your loan records are held by your lender. We will forward your request to them and help them complete it.</li>'
          : '<li>After confirmation we revoke your login access and remove your personal details (name, phone, email, photo, device tokens).</li>'}
        <li>We will complete the request within 7 business days of confirmation and email you when it is done.</li>
      </ol>
      <p>Financial transaction records (loans, collections, receipts) are kept for up to 8 years where Indian law requires it, without your contact details.</p>
      <p>If you did not make this request, reply to this email and we will cancel it.</p>
      <p>— Zolo Funds Data Protection Desk<br/>support@zolofunds.com · grievance@zolofunds.com</p>
    </div>`;
  const res = await sendPlatformEmail(input.email, `We received your deletion request (${reference})`, html, {
    replyTo: SUPPORT_INBOX,
  });
  return res.success;
}
