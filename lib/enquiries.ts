import prisma from '@/lib/db';
import nodemailer from 'nodemailer';

export interface EnquiryInput {
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  vertical?: string | null;
  loanCapacity?: string | null;
  agentCount?: string | null;
  city?: string | null;
  source?: string;
  message?: string | null;
}

export interface EnquiryRecord {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  vertical: string | null;
  loan_capacity: string | null;
  agent_count: string | null;
  city: string | null;
  source: string;
  message: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

const REMOTE_API_URL = 'https://zolofunds.com/api/demo_request.php';
const REMOTE_API_KEY = 'ZoloAdminLeadsKey_2026';

export function parseSafeDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) return parsed;
  if (typeof val === 'string') {
    const iso = new Date(val.replace(' ', 'T'));
    if (!isNaN(iso.getTime())) return iso;
  }
  return new Date();
}

/**
 * Ensures the enquiries table exists in MySQL without needing manual migrations.
 */
export async function ensureEnquiriesTable(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id VARCHAR(191) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255) NULL,
        company VARCHAR(255) NULL,
        vertical VARCHAR(100) NULL DEFAULT 'microlending',
        loan_capacity VARCHAR(100) NULL,
        agent_count VARCHAR(100) NULL,
        city VARCHAR(100) NULL,
        source VARCHAR(50) NOT NULL DEFAULT 'chat_assistant',
        message TEXT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status_created (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err: any) {
    console.warn('[ensureEnquiriesTable warning]', err?.message || err);
  }
}

/**
 * Save new demo / chat enquiry into the database.
 */
export async function createEnquiry(input: EnquiryInput): Promise<string> {
  await ensureEnquiriesTable();

  const id = `enq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const name = input.name.trim().slice(0, 255);
  const phone = input.phone.trim().slice(0, 50);
  const email = input.email ? input.email.trim().slice(0, 255) : null;
  const company = input.company ? input.company.trim().slice(0, 255) : null;
  const vertical = input.vertical ? input.vertical.trim().slice(0, 100) : 'microlending';
  const loanCapacity = input.loanCapacity ? input.loanCapacity.trim().slice(0, 100) : null;
  const agentCount = input.agentCount ? input.agentCount.trim().slice(0, 100) : null;
  const city = input.city ? input.city.trim().slice(0, 100) : null;
  const source = input.source ? input.source.trim().slice(0, 50) : 'chat_assistant';
  const message = input.message ? input.message.trim() : null;

  await prisma.$queryRawUnsafe(
    `INSERT INTO enquiries (id, name, phone, email, company, vertical, loan_capacity, agent_count, city, source, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
    id,
    name,
    phone,
    email,
    company,
    vertical,
    loanCapacity,
    agentCount,
    city,
    source,
    message
  );

  return id;
}

/**
 * Fetch remote leads captured from zolofunds.com public marketing site.
 */
async function fetchRemoteLeads(): Promise<EnquiryRecord[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${REMOTE_API_URL}?key=${REMOTE_API_KEY}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const data = await res.json();
    if (!data.success || !Array.isArray(data.leads)) return [];

    return data.leads.map((l: any): EnquiryRecord => ({
      id: `remote_${l.id}`,
      name: l.name || 'Anonymous',
      phone: l.phone || '',
      email: null,
      company: l.company || null,
      vertical: l.vertical || 'General Lending',
      loan_capacity: l.loan_capacity || null,
      agent_count: l.agent_count || null,
      city: l.city || null,
      source: 'zolofunds.com (Live Chat)',
      message: `Lead captured from zolofunds.com live chat walkthrough`,
      status: l.status || 'new',
      created_at: parseSafeDate(l.created_at),
      updated_at: parseSafeDate(l.created_at),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch all enquiries (both local SaaS enquiries and live marketing site enquiries)
 * with optional status filter.
 */
export async function getEnquiries(statusFilter?: string): Promise<EnquiryRecord[]> {
  await ensureEnquiriesTable();

  let localRows: EnquiryRecord[] = [];
  try {
    if (statusFilter && statusFilter !== 'all') {
      localRows = await prisma.$queryRawUnsafe<EnquiryRecord[]>(
        `SELECT * FROM enquiries WHERE status = ? ORDER BY created_at DESC`,
        statusFilter
      );
    } else {
      localRows = await prisma.$queryRawUnsafe<EnquiryRecord[]>(
        `SELECT * FROM enquiries ORDER BY created_at DESC`
      );
    }
  } catch (err) {
    console.error('[getEnquiries local error]', err);
    localRows = [];
  }

  // Fetch remote leads from live marketing site
  const remoteRows = await fetchRemoteLeads();

  // Combine and deduplicate
  const all = [...localRows];
  for (const r of remoteRows) {
    if (statusFilter && statusFilter !== 'all' && r.status !== statusFilter) {
      continue;
    }
    // Prevent duplicate phone if present in local
    const exists = all.some((x) => {
      if (!x.phone || !r.phone || x.phone !== r.phone) return false;
      const t1 = parseSafeDate(x.created_at).getTime();
      const t2 = parseSafeDate(r.created_at).getTime();
      return Math.abs(t1 - t2) < 60000;
    });
    if (!exists) {
      all.push(r);
    }
  }

  // Sort descending by created_at
  all.sort((a, b) => parseSafeDate(b.created_at).getTime() - parseSafeDate(a.created_at).getTime());

  return all;
}

/**
 * Get summary stats for the developer dashboard.
 */
export async function getEnquiryStats(): Promise<{
  total: number;
  newCount: number;
  contacted: number;
  converted: number;
}> {
  await ensureEnquiriesTable();

  let localStats: { status: string; count: bigint }[] = [];
  try {
    localStats = await prisma.$queryRawUnsafe<{ status: string; count: bigint }[]>(
      `SELECT status, COUNT(*) as count FROM enquiries GROUP BY status`
    );
  } catch (err) {
    console.error('[getEnquiryStats local error]', err);
  }

  let total = 0;
  let newCount = 0;
  let contacted = 0;
  let converted = 0;

  for (const row of localStats) {
    const c = Number(row.count);
    total += c;
    if (row.status === 'new') newCount += c;
    else if (row.status === 'contacted') contacted += c;
    else if (row.status === 'converted') converted += c;
  }

  // Add remote leads to counts
  const remoteRows = await fetchRemoteLeads();
  for (const r of remoteRows) {
    total += 1;
    if (r.status === 'new') newCount += 1;
    else if (r.status === 'contacted') contacted += 1;
    else if (r.status === 'converted') converted += 1;
  }

  return { total, newCount, contacted, converted };
}

/**
 * Update enquiry status (e.g. 'contacted', 'converted', 'closed').
 */
export async function updateEnquiryStatus(id: string, status: string): Promise<boolean> {
  if (id.startsWith('remote_')) {
    const remoteId = parseInt(id.replace('remote_', ''), 10);
    try {
      await fetch(`${REMOTE_API_URL}?key=${REMOTE_API_KEY}&action=update_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({ id: remoteId, status })
      });
      return true;
    } catch {
      return false;
    }
  }

  await ensureEnquiriesTable();
  await prisma.$queryRawUnsafe(
    `UPDATE enquiries SET status = ?, updated_at = NOW() WHERE id = ?`,
    status,
    id
  );

  return true;
}

/**
 * Delete an enquiry.
 */
export async function deleteEnquiry(id: string): Promise<boolean> {
  if (id.startsWith('remote_')) {
    const remoteId = parseInt(id.replace('remote_', ''), 10);
    try {
      await fetch(`${REMOTE_API_URL}?key=${REMOTE_API_KEY}&action=delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({ id: remoteId })
      });
      return true;
    } catch {
      return false;
    }
  }

  await ensureEnquiriesTable();
  await prisma.$queryRawUnsafe(`DELETE FROM enquiries WHERE id = ?`, id);
  return true;
}

/**
 * Send email to support@zolofunds.com alerting about the new lead.
 */
export async function sendEnquiryEmailToSupport(data: EnquiryInput): Promise<boolean> {
  const to = 'support@zolofunds.com';
  const name = data.name || 'Unknown';
  const phone = data.phone || 'N/A';
  const company = data.company || 'Not Specified';
  const vertical = data.vertical || 'General Microfinance';
  const city = data.city || 'Not Specified';
  const source = data.source === 'chat_assistant' ? 'Zolo Assistant (Live Chat)' : 'Website Demo Request';
  const message = data.message ? `<p><strong>Note/Query:</strong> ${data.message}</p>` : '';
  const cleanPhone = phone.replace(/[^0-9]/g, '');

  const subject = `New Live Demo Lead: ${name} (${company}) - ${phone}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #7D287E 0%, #4A124B 100%); padding: 24px; color: #ffffff;">
          <h2 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">New Platform Demo Lead</h2>
          <p style="margin: 0; font-size: 13px; color: #FCF6AB;">Captured via ${source}</p>
        </div>
        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; width: 40%;"><strong>Founder / Manager:</strong></td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 600; font-size: 15px;">${name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;"><strong>WhatsApp / Phone:</strong></td>
              <td style="padding: 10px 0; color: #7D287E; font-weight: 700; font-size: 15px;">
                <a href="tel:${phone}" style="color: #7D287E; text-decoration: none;">${phone}</a>
                &nbsp;&bull;&nbsp;
                <a href="https://wa.me/91${cleanPhone}" target="_blank" style="display: inline-block; background: #25D366; color: #ffffff; padding: 3px 9px; border-radius: 4px; font-size: 11px; text-decoration: none; font-weight: 600;">Chat on WhatsApp</a>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;"><strong>Firm / Company:</strong></td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${company}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;"><strong>Lending Category:</strong></td>
              <td style="padding: 10px 0; color: #0f172a;">${vertical}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;"><strong>City / Location:</strong></td>
              <td style="padding: 10px 0; color: #0f172a;">${city}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b;"><strong>Captured Channel:</strong></td>
              <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${source}</td>
            </tr>
          </table>
          ${message}
        </div>
        <div style="background: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
          Lead submitted on zolofunds.com &bull; Support Helpline: +91 80894 05950
        </div>
      </div>
    </body>
    </html>
  `;

  // Try platform SMTP first, then fallback to direct zolofunds.com SMTP
  try {
    const smtpHost = process.env.SMTP_HOST || 'mail.zolofunds.com';
    const smtpPort = Number(process.env.SMTP_PORT || '465');
    const smtpUser = process.env.SMTP_USER || 'noreply@zolofunds.com';
    const smtpPass = process.env.SMTP_PASS || 'Animazon@Erode11';
    const isSecure = smtpPort === 465;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: isSecure,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
    });

    await transporter.sendMail({
      from: `"Zolo Assistant Lead" <${smtpUser}>`,
      to,
      subject,
      html,
    });

    console.log(`[Enquiry Email] Alert sent to ${to} for lead ${name}`);
    return true;
  } catch (err: any) {
    console.error('[Enquiry Email Failed]', err?.message || err);
    return false;
  }
}
