import nodemailer from 'nodemailer';
import prisma from '../../db';
import { getSetting } from '../../tenant';

interface EmailResult { success: boolean; error?: string; }

export async function sendEmail(
  tenantId: string,
  to: string,
  subject: string,
  html: string,
  meta?: { entityType?: string; entityId?: string; event?: string },
  // `system: true` for auth mail (password reset, verification) — uses the
  // platform SMTP and ignores the tenant's notify_channel_email toggle, so
  // critical mail always goes out even if the tenant never set up SMTP.
  opts?: { system?: boolean }
): Promise<EmailResult> {
  const [tHost, tPort, tUser, tPass, tFromName, enabled] = await Promise.all([
    getSetting(tenantId, 'smtp_host',      ''),
    getSetting(tenantId, 'smtp_port',      ''),
    getSetting(tenantId, 'smtp_user',      ''),
    getSetting(tenantId, 'smtp_pass',      ''),
    getSetting(tenantId, 'smtp_from_name', ''),
    getSetting(tenantId, 'notify_channel_email', 'false'),
  ]);

  // Per-tenant SMTP first; fall back to platform SMTP from env.
  const host     = tHost     || process.env.SMTP_HOST     || '';
  const port     = tPort     || process.env.SMTP_PORT     || '587';
  const user     = tUser     || process.env.SMTP_USER     || '';
  const pass     = tPass     || process.env.SMTP_PASS     || '';
  const fromName = tFromName || process.env.SMTP_FROM_NAME || 'LoanTrack';
  // Brevo/SES require a verified sender; allow overriding the From address.
  const fromAddr = process.env.SMTP_FROM || user;

  // Auth mail (system) always sends if SMTP is configured. Tenant
  // notification mail still respects the notify_channel_email toggle.
  const channelOn = opts?.system ? true : enabled === 'true';
  if (!channelOn || !host || !user || !pass) {
    return { success: false, error: 'Email channel not configured' };
  }

  let result: EmailResult = { success: false };

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to,
      subject,
      html,
    });

    result = { success: true };
  } catch (err: any) {
    result = { success: false, error: err.message };
  }

  await prisma.notificationLog.create({
    data: {
      tenantId, channel: 'email', recipient: to,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error ?? null,
      provider: 'smtp',
      entityType: meta?.entityType ?? null,
      entityId:   meta?.entityId   ?? null,
      event:      meta?.event      ?? null,
      messageBody: `Subject: ${subject}\n\n${html}`,
    },
  }).catch((e) => {
    console.error('Failed to log Email notification:', e);
  });

  return result;
}
