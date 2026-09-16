import prisma from '@/lib/db';
import { encryptField, decryptField } from '@/lib/pii';
import { setSetting, getSetting } from '@/lib/tenant';

const PLATFORM_KEYS = {
  keyId: 'platform_rzp_key_id',
  keySecret: 'platform_rzp_key_secret', // encrypted
  webhookSecret: 'platform_rzp_webhook_secret', // encrypted
  mockCheckout: 'platform_rzp_mock_checkout',
  mode: 'platform_rzp_mode', // 'live' | 'test'
  subTotalCount: 'platform_rzp_sub_total_count',
} as const;

export type PlatformPaymentSettings = {
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
  mockCheckout: boolean;
  mode: 'live' | 'test';
  subTotalCount: number;
  isConfigured: boolean;
  source: 'database' | 'environment' | 'none';
};

export type PlatformPaymentSettingsMasked = {
  keyId: string;
  keySecretSet: boolean;
  webhookSecretSet: boolean;
  mockCheckout: boolean;
  mode: 'live' | 'test';
  subTotalCount: number;
  source: 'database' | 'environment' | 'none';
};

/**
 * Resolves the platform root tenant (slug: 'default').
 */
async function getDefaultTenantId(): Promise<string | null> {
  const defaultTenant = await prisma.tenant.findFirst({
    where: { slug: 'default' },
    select: { id: true },
  });
  return defaultTenant?.id ?? null;
}

function getPlatformEncryptionKey(): string {
  return (
    process.env.PII_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'platform_payment_aes_encryption_key_default'
  );
}

/**
 * Resolves the platform's Razorpay configuration.
 *
 * Checks database AppSetting under the default tenant first.
 * If not set in the database, falls back to environment variables.
 */
export async function getPlatformPaymentSettings(): Promise<PlatformPaymentSettings> {
  const tenantId = await getDefaultTenantId();

  let dbKeyId = '';
  let dbKeySecretEnc = '';
  let dbWebhookEnc = '';
  let dbMockCheckout = '';
  let dbMode = '';
  let dbSubTotalCount = '';

  if (tenantId) {
    const [keyId, keySecretEnc, webhookEnc, mockCheckout, mode, subTotalCount] = await Promise.all([
      getSetting(tenantId, PLATFORM_KEYS.keyId, ''),
      getSetting(tenantId, PLATFORM_KEYS.keySecret, ''),
      getSetting(tenantId, PLATFORM_KEYS.webhookSecret, ''),
      getSetting(tenantId, PLATFORM_KEYS.mockCheckout, ''),
      getSetting(tenantId, PLATFORM_KEYS.mode, ''),
      getSetting(tenantId, PLATFORM_KEYS.subTotalCount, ''),
    ]);
    dbKeyId = keyId;
    dbKeySecretEnc = keySecretEnc;
    dbWebhookEnc = webhookEnc;
    dbMockCheckout = mockCheckout;
    dbMode = mode;
    dbSubTotalCount = subTotalCount;
  }

  const hasDbConfig = Boolean(dbKeyId.trim() && dbKeySecretEnc.trim());

  let keyId: string | null = null;
  let keySecret: string | null = null;
  let webhookSecret: string | null = null;
  let mockCheckout = false;
  let mode: 'live' | 'test' = 'live';
  let subTotalCount = 120;
  let source: 'database' | 'environment' | 'none' = 'none';

  if (hasDbConfig) {
    keyId = dbKeyId.trim();
    const encKey = getPlatformEncryptionKey();
    try {
      keySecret = dbKeySecretEnc ? decryptField(dbKeySecretEnc, encKey) : null;
    } catch {
      keySecret = null;
    }
    try {
      webhookSecret = dbWebhookEnc ? decryptField(dbWebhookEnc, encKey) : null;
    } catch {
      webhookSecret = null;
    }
    mockCheckout = dbMockCheckout === 'true';
    mode = dbMode === 'test' ? 'test' : 'live';
    subTotalCount = parseInt(dbSubTotalCount, 10) || 120;
    source = 'database';
  } else if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    keyId = process.env.RAZORPAY_KEY_ID.trim();
    keySecret = process.env.RAZORPAY_KEY_SECRET.trim();
    webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ? process.env.RAZORPAY_WEBHOOK_SECRET.trim() : null;
    mockCheckout = process.env.RAZORPAY_MOCK_CHECKOUT === 'true';
    mode = keyId.startsWith('rzp_test_') ? 'test' : 'live';
    subTotalCount = parseInt(process.env.RAZORPAY_SUB_TOTAL_COUNT ?? '120', 10) || 120;
    source = 'environment';
  }

  // Auto-detect mode if not explicitly chosen
  if (keyId && !hasDbConfig) {
    mode = keyId.startsWith('rzp_test_') ? 'test' : 'live';
  }

  return {
    keyId,
    keySecret,
    webhookSecret,
    mockCheckout,
    mode,
    subTotalCount,
    isConfigured: Boolean(keyId && keySecret),
    source,
  };
}

/**
 * Returns a masked configuration safe for displaying in the Developer UI.
 * Raw secrets are NEVER returned to the client.
 */
export async function getPlatformPaymentSettingsMasked(): Promise<PlatformPaymentSettingsMasked> {
  const config = await getPlatformPaymentSettings();
  return {
    keyId: config.keyId ?? '',
    keySecretSet: Boolean(config.keySecret),
    webhookSecretSet: Boolean(config.webhookSecret),
    mockCheckout: config.mockCheckout,
    mode: config.mode,
    subTotalCount: config.subTotalCount,
    source: config.source,
  };
}

/**
 * Saves platform Razorpay configuration into database settings.
 * Secrets are encrypted with AES-256-GCM before writing.
 * A blank or omitted secret leaves the existing stored secret unchanged.
 */
export async function savePlatformPaymentSettings(input: {
  keyId: string;
  keySecret?: string;
  webhookSecret?: string;
  mockCheckout?: boolean;
  mode?: 'live' | 'test';
  subTotalCount?: number;
}): Promise<void> {
  const tenantId = await getDefaultTenantId();
  if (!tenantId) {
    throw new Error('Default system tenant could not be resolved');
  }

  const keyId = input.keyId.trim();
  const encKey = getPlatformEncryptionKey();
  await setSetting(tenantId, PLATFORM_KEYS.keyId, keyId, 'platform_payment');

  if (input.keySecret !== undefined && input.keySecret.trim().length > 0) {
    const encrypted = encryptField(input.keySecret.trim(), encKey);
    await setSetting(tenantId, PLATFORM_KEYS.keySecret, encrypted ?? '', 'platform_payment');
  }

  if (input.webhookSecret !== undefined && input.webhookSecret.trim().length > 0) {
    const encrypted = encryptField(input.webhookSecret.trim(), encKey);
    await setSetting(tenantId, PLATFORM_KEYS.webhookSecret, encrypted ?? '', 'platform_payment');
  }

  if (input.mockCheckout !== undefined) {
    await setSetting(tenantId, PLATFORM_KEYS.mockCheckout, input.mockCheckout ? 'true' : 'false', 'platform_payment');
  }

  if (input.mode !== undefined) {
    await setSetting(tenantId, PLATFORM_KEYS.mode, input.mode, 'platform_payment');
  }

  if (input.subTotalCount !== undefined) {
    await setSetting(tenantId, PLATFORM_KEYS.subTotalCount, String(input.subTotalCount), 'platform_payment');
  }
}

/**
 * Tests live connection to Razorpay API with the supplied or currently saved credentials.
 * Pings Razorpay's /v1/plans endpoint (harmless read request) with Basic auth.
 */
export async function testPlatformRazorpayConnection(customKeyId?: string, customKeySecret?: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  let keyId = customKeyId?.trim();
  let keySecret = customKeySecret?.trim();

  // If not provided in test call, read from current platform settings
  if (!keyId || !keySecret) {
    const current = await getPlatformPaymentSettings();
    if (!keyId) keyId = current.keyId ?? '';
    if (!keySecret) keySecret = current.keySecret ?? '';
  }

  if (!keyId || !keySecret) {
    return {
      success: false,
      message: 'Razorpay Key ID and Key Secret must both be provided to test the connection.',
    };
  }

  try {
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/plans?count=1', {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      return {
        success: true,
        message: `Connection successful! Credentials verified with Razorpay (${keyId.startsWith('rzp_test_') ? 'Test Mode' : 'Live Mode'}).`,
      };
    }

    const errorText = await res.text().catch(() => '');
    let description = '';
    try {
      const parsed = JSON.parse(errorText);
      description = parsed?.error?.description || '';
    } catch {}

    if (res.status === 401) {
      return {
        success: false,
        message: 'Authentication failed (401). Razorpay rejected the Key ID and Key Secret. Verify they belong to the same account and are active.',
        details: description,
      };
    }

    return {
      success: false,
      message: `Razorpay API returned status ${res.status}: ${description || res.statusText}`,
      details: description,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to connect to Razorpay API: ${error?.message || 'Network error'}`,
    };
  }
}
