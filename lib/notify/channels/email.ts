import nodemailer from 'nodemailer';
import prisma from '../../db';
import { getSetting } from '../../tenant';

export interface EmailResult {
  success: boolean;
  error?: string;
  /** True when sent via the dev console fallback (no real SMTP in development). */
  dev?: boolean;
  /** True when SMTP simply isn't configured (distinct from a send failure). */
  notConfigured?: boolean;
}

export interface ResolvedEmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromAddr: string;
  secure: boolean;
  requireTLS: boolean;
  rejectUnauthorized: boolean;
  configured: boolean;
}

function bool(v: string | undefined | null, fallback: boolean): boolean {
  if (v == null || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

/**
 * Resolve the SMTP config for a tenant. Per-tenant settings win; otherwise the
 * platform SMTP from env. For `system` (auth) mail the tenant's
 * `notify_channel_email` toggle is ignored — verification / reset mail must go
 * out even if the tenant never touched their notification settings.
 */
export async function resolveEmailConfig(tenantId: string): Promise<ResolvedEmailConfig> {
  const [tHost, tPort, tUser, tPass, tFromName] = await Promise.all([
    getSetting(tenantId, 'smtp_host', ''),
    getSetting(tenantId, 'smtp_port', ''),
    getSetting(tenantId, 'smtp_user', ''),
    getSetting(tenantId, 'smtp_pass', ''),
    getSetting(tenantId, 'smtp_from_name', ''),
  ]);

  const host = (tHost || process.env.SMTP_HOST || '').trim();
  const port = Number((tPort || process.env.SMTP_PORT || '587').toString().trim()) || 587;
  const user = (tUser || process.env.SMTP_USER || '').trim();
  const pass = tPass || process.env.SMTP_PASS || '';
  const fromName = (tFromName || process.env.SMTP_FROM_NAME || 'LoanTrack').trim();
  // Many providers (Brevo/SES/Mailgun) require a verified From that differs from
  // the SMTP username, so allow an explicit override; otherwise reuse the user.
  const fromAddr = (process.env.SMTP_FROM || user).trim();

  // 465 = implicit TLS. 587/25 = STARTTLS. Allow an explicit override.
  const secure = bool(process.env.SMTP_SECURE, port === 465);
  const requireTLS = bool(process.env.SMTP_REQUIRE_TLS, !secure);
  // Some self-hosted mail servers (e.g. Hostinger mailboxes) present certs that
  // don't validate cleanly — allow opting out, but default to strict.
  const rejectUnauthorized = bool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true);

  const configured = Boolean(host && user && pass);
  return { host, port, user, pass, fromName, fromAddr, secure, requireTLS, rejectUnauthorized, configured };
}

/** Cheap check used by callers (e.g. registration) to decide messaging. */
export async function isSystemEmailConfigured(tenantId: string): Promise<boolean> {
  return (await resolveEmailConfig(tenantId)).configured;
}

function buildTransport(cfg: ResolvedEmailConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: cfg.requireTLS,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: cfg.rejectUnauthorized },
    // Never let a stuck SMTP socket hang a request (registration, reset, …).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/**
 * Live SMTP handshake — for an admin "send test email" / settings diagnostic.
 * Returns the same shape as sendEmail. Does NOT send a message.
 */
export async function verifyEmailTransport(tenantId: string): Promise<EmailResult> {
  const cfg = await resolveEmailConfig(tenantId);
  if (!cfg.configured) {
    return { success: false, notConfigured: true, error: 'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing).' };
  }
  try {
    await buildTransport(cfg).verify();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'SMTP verification failed' };
  }
}

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
  const isProd = process.env.NODE_ENV === 'production';
  const cfg = await resolveEmailConfig(tenantId);

  // Tenant notification mail still respects the opt-in toggle; system/auth mail
  // does not. (Checked only when SMTP is actually configured.)
  if (!opts?.system) {
    const enabled = await getSetting(tenantId, 'notify_channel_email', 'false');
    if (enabled !== 'true') {
      return { success: false, notConfigured: true, error: 'Email channel disabled for this tenant' };
    }
  }

  // ── Not configured ────────────────────────────────────────────────────────
  if (!cfg.configured) {
    if (!isProd) {
      // Dev fallback: print the message (and any links) so local flows — signup
      // verification, password reset — work without a real SMTP server.
      const links = Array.from(html.matchAll(/href="([^"]+)"/g)).map((m) => m[1]);
      console.warn(
        `\n[EMAIL:DEV] SMTP not configured — printing instead of sending.\n` +
          `  to:      ${to}\n  subject: ${subject}\n` +
          (links.length ? `  links:\n${links.map((l) => `    ${l}`).join('\n')}\n` : ''),
      );
      await logNotification(tenantId, to, subject, html, { success: true, dev: true }, 'dev-console', meta);
      return { success: true, dev: true };
    }
    const error = 'Email not sent: SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS).';
    console.error(`[EMAIL] ${error} (to=${to}, subject="${subject}")`);
    await logNotification(tenantId, to, subject, html, { success: false, notConfigured: true, error }, 'smtp', meta);
    return { success: false, notConfigured: true, error };
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  let result: EmailResult;
  try {
    await buildTransport(cfg).sendMail({
      from: `"${cfg.fromName}" <${cfg.fromAddr}>`,
      to,
      subject,
      html,
    });
    result = { success: true };
  } catch (err: any) {
    result = { success: false, error: err?.message || 'SMTP send failed' };
    console.error(`[EMAIL] send failed (to=${to}, subject="${subject}"): ${result.error}`);
  }

  await logNotification(tenantId, to, subject, html, result, 'smtp', meta);
  return result;
}

async function logNotification(
  tenantId: string,
  to: string,
  subject: string,
  html: string,
  result: EmailResult,
  provider: string,
  meta?: { entityType?: string; entityId?: string; event?: string },
): Promise<void> {
  await prisma.notificationLog
    .create({
      data: {
        tenantId,
        channel: 'email',
        recipient: to,
        status: result.success ? 'sent' : 'failed',
        errorMessage: result.error ?? null,
        provider,
        entityType: meta?.entityType ?? null,
        entityId: meta?.entityId ?? null,
        event: meta?.event ?? null,
        messageBody: `Subject: ${subject}\n\n${html}`,
      },
    })
    .catch((e) => {
      console.error('Failed to log Email notification:', e);
    });
}
