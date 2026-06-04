import prisma from '@/lib/db';
import { getSetting, setSetting } from '@/lib/tenant';
import { encryptField, decryptField } from '@/lib/pii';

/**
 * Per-tenant Razorpay (collections) gateway config.
 *
 * mCollect self-pay settles into each LENDER tenant's own Razorpay account, so
 * credentials are stored per-tenant in `app_settings` (group `payments`) — the
 * secret + webhook secret encrypted at rest with the field cipher (PII key).
 * This is entirely separate from the platform's env-level subscription keys.
 */

const KEYS = {
  enabled: 'rzp_collections_enabled',
  keyId: 'rzp_collections_key_id',
  keySecret: 'rzp_collections_key_secret', // encrypted
  webhookSecret: 'rzp_collections_webhook_secret', // encrypted
} as const;

export type TenantRazorpayConfig = {
  enabled: boolean;
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
};

/** Resolves a tenant's collections gateway, decrypting secrets. */
export async function getTenantRazorpayConfig(tenantId: string): Promise<TenantRazorpayConfig> {
  const [enabled, keyId, keySecretEnc, webhookEnc] = await Promise.all([
    getSetting(tenantId, KEYS.enabled, 'false'),
    getSetting(tenantId, KEYS.keyId, ''),
    getSetting(tenantId, KEYS.keySecret, ''),
    getSetting(tenantId, KEYS.webhookSecret, ''),
  ]);
  return {
    enabled: enabled === 'true',
    keyId: keyId || null,
    keySecret: keySecretEnc ? decryptField(keySecretEnc) : null,
    webhookSecret: webhookEnc ? decryptField(webhookEnc) : null,
  };
}

/** True when the tenant can create live PSP payment links. */
export async function isTenantGatewayLive(tenantId: string): Promise<boolean> {
  const c = await getTenantRazorpayConfig(tenantId);
  return c.enabled && Boolean(c.keyId && c.keySecret);
}

/**
 * Saves a tenant's gateway config. Secrets are encrypted before write; a blank
 * secret leaves the stored value unchanged (so admins can update key id without
 * re-entering secrets).
 */
export async function saveTenantRazorpayConfig(
  tenantId: string,
  input: { enabled: boolean; keyId: string; keySecret?: string; webhookSecret?: string },
): Promise<void> {
  await setSetting(tenantId, KEYS.enabled, input.enabled ? 'true' : 'false', 'payments');
  await setSetting(tenantId, KEYS.keyId, input.keyId.trim(), 'payments');
  if (input.keySecret && input.keySecret.trim()) {
    await setSetting(tenantId, KEYS.keySecret, encryptField(input.keySecret.trim()) ?? '', 'payments');
  }
  if (input.webhookSecret && input.webhookSecret.trim()) {
    await setSetting(tenantId, KEYS.webhookSecret, encryptField(input.webhookSecret.trim()) ?? '', 'payments');
  }
}

/** Masked view for settings UI — never returns raw secrets. */
export async function getTenantRazorpayConfigMasked(tenantId: string) {
  const c = await getTenantRazorpayConfig(tenantId);
  return {
    enabled: c.enabled,
    keyId: c.keyId ?? '',
    keySecretSet: Boolean(c.keySecret),
    webhookSecretSet: Boolean(c.webhookSecret),
  };
}

/** Resolves the tenant that owns a self-pay token (for webhook secret lookup). */
export async function resolveTenantForToken(token?: string, providerRef?: string): Promise<string | null> {
  if (!token && !providerRef) return null;
  const tok = token
    ? await prisma.clientPaymentToken.findUnique({ where: { token }, select: { tenantId: true } })
    : await prisma.clientPaymentToken.findFirst({ where: { providerRef }, select: { tenantId: true } });
  return tok?.tenantId ?? null;
}
