import nodemailer from 'nodemailer';
import prisma from '../../db';
import { getSetting } from '../../tenant';

interface EmailResult { success: boolean; error?: string; }

export async function sendEmail(
  tenantId: string,
  to: string,
  subject: string,
  html: string,
  meta?: { entityType?: string; entityId?: string; event?: string }
): Promise<EmailResult> {
  const [host, port, user, pass, fromName, enabled] = await Promise.all([
    getSetting(tenantId, 'smtp_host',      ''),
    getSetting(tenantId, 'smtp_port',      '587'),
    getSetting(tenantId, 'smtp_user',      ''),
    getSetting(tenantId, 'smtp_pass',      ''),
    getSetting(tenantId, 'smtp_from_name', 'LoanTrack'),
    getSetting(tenantId, 'notify_channel_email', 'false'),
  ]);

  if (enabled !== 'true' || !host || !user || !pass) {
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
      from: `"${fromName}" <${user}>`,
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
