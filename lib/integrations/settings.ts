import prisma from '@/lib/db';
import { decryptField, encryptField } from '@/lib/pii';
import { getNachConfig, type NachConfig } from '@/lib/nach';
import { getSetting, setSetting } from '@/lib/tenant';
import { getTenantRazorpayConfigMasked } from '@/lib/tenantRazorpay';

const INTEGRATION_GROUP = 'integrations';

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
}

function int(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function maybeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

async function savePlain(tenantId: string, key: string, value: unknown, group = INTEGRATION_GROUP) {
  if (value === undefined) return;
  await setSetting(tenantId, key, String(value), group);
}

async function saveEncrypted(tenantId: string, key: string, value: unknown, group = INTEGRATION_GROUP) {
  const plain = maybeString(value);
  if (!plain) return;
  await setSetting(tenantId, key, encryptField(plain) ?? '', group);
}

async function getSecretSet(tenantId: string, key: string) {
  return Boolean(await getSetting(tenantId, key, ''));
}

export type IntegrationSettings = {
  razorpay: {
    enabled: boolean;
    keyId: string;
    keySecretSet: boolean;
    webhookSecretSet: boolean;
    ready: boolean;
  };
  nach: NachConfig & {
    enabled: boolean;
    defaultMaxAmount: number;
    authType: 'netbanking' | 'debitcard' | 'aadhaar';
  };
  messaging: {
    enabled: boolean;
    smsEnabled: boolean;
    whatsappEnabled: boolean;
    msg91AuthKeySet: boolean;
    senderId: string;
    whatsappNumber: string;
  };
  email: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: string;
    smtpUser: string;
    smtpPassSet: boolean;
    fromName: string;
  };
  kyc: {
    enabled: boolean;
    provider: 'digio';
    environment: string;
    clientId: string;
    clientSecretSet: boolean;
    webhookSecretSet: boolean;
  };
  bureau: {
    enabled: boolean;
    provider: string;
    environment: string;
    memberIdSet: boolean;
    apiKeySet: boolean;
    apiSecretSet: boolean;
    certificateSet: boolean;
    privateKeySet: boolean;
  };
};

export async function getIntegrationSettingsMasked(tenantId: string): Promise<IntegrationSettings> {
  const [
    razorpay,
    nach,
    nachEnabled,
    nachDefaultMaxAmount,
    nachAuthType,
    whatsappSmsActive,
    notifyChannelSms,
    notifyChannelWhatsapp,
    notifyChannelEmail,
    msg91SenderId,
    msg91WhatsappNumber,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpFromName,
    kycEnabled,
    kycEnvironment,
    kycClientId,
    bureau,
    msg91AuthKeySet,
    smtpPassSet,
    kycClientSecretSet,
    kycWebhookSecretSet,
  ] = await Promise.all([
    getTenantRazorpayConfigMasked(tenantId),
    getNachConfig(tenantId),
    getSetting(tenantId, 'nach_enabled', 'false'),
    getSetting(tenantId, 'nach_default_max_amount', '0'),
    getSetting(tenantId, 'nach_auth_type', 'netbanking'),
    getSetting(tenantId, 'whatsapp_sms_active', 'true'),
    getSetting(tenantId, 'notify_channel_sms', 'false'),
    getSetting(tenantId, 'notify_channel_whatsapp', 'false'),
    getSetting(tenantId, 'notify_channel_email', 'false'),
    getSetting(tenantId, 'msg91_sender_id', 'LNTRCK'),
    getSetting(tenantId, 'msg91_whatsapp_number', ''),
    getSetting(tenantId, 'smtp_host', ''),
    getSetting(tenantId, 'smtp_port', '587'),
    getSetting(tenantId, 'smtp_user', ''),
    getSetting(tenantId, 'smtp_from_name', ''),
    getSetting(tenantId, 'kyc_digio_enabled', 'false'),
    getSetting(tenantId, 'kyc_digio_environment', 'sandbox'),
    getSetting(tenantId, 'kyc_digio_client_id', ''),
    prisma.bureauCredential.findUnique({ where: { tenantId } }),
    getSecretSet(tenantId, 'msg91_auth_key'),
    getSecretSet(tenantId, 'smtp_pass'),
    getSecretSet(tenantId, 'kyc_digio_client_secret'),
    getSecretSet(tenantId, 'kyc_digio_webhook_secret'),
  ]);

  const authType = ['netbanking', 'debitcard', 'aadhaar'].includes(nachAuthType)
    ? (nachAuthType as IntegrationSettings['nach']['authType'])
    : 'netbanking';

  return {
    razorpay: {
      ...razorpay,
      ready: razorpay.enabled && Boolean(razorpay.keyId && razorpay.keySecretSet),
    },
    nach: {
      ...nach,
      enabled: nachEnabled === 'true',
      defaultMaxAmount: Number(nachDefaultMaxAmount) || 0,
      authType,
    },
    messaging: {
      enabled: whatsappSmsActive !== 'false',
      smsEnabled: notifyChannelSms === 'true',
      whatsappEnabled: notifyChannelWhatsapp === 'true',
      msg91AuthKeySet,
      senderId: msg91SenderId,
      whatsappNumber: msg91WhatsappNumber,
    },
    email: {
      enabled: notifyChannelEmail === 'true',
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassSet,
      fromName: smtpFromName,
    },
    kyc: {
      enabled: kycEnabled === 'true',
      provider: 'digio',
      environment: kycEnvironment || 'sandbox',
      clientId: kycClientId,
      clientSecretSet: kycClientSecretSet,
      webhookSecretSet: kycWebhookSecretSet,
    },
    bureau: {
      enabled: bureau?.isActive ?? false,
      provider: bureau?.provider ?? 'CRIF',
      environment: bureau?.environment ?? 'sandbox',
      memberIdSet: Boolean(bureau?.memberId),
      apiKeySet: Boolean(bureau?.apiKey),
      apiSecretSet: Boolean(bureau?.apiSecret),
      certificateSet: Boolean(bureau?.bureauCert),
      privateKeySet: Boolean(bureau?.bureauKey),
    },
  };
}

export async function saveIntegrationSettings(
  tenantId: string,
  input: Record<string, any>,
): Promise<IntegrationSettings> {
  if (input.nach) {
    await Promise.all([
      savePlain(tenantId, 'nach_enabled', bool(input.nach.enabled).toString(), 'nach'),
      savePlain(tenantId, 'nach_max_retries', int(input.nach.maxRetries, 3), 'nach'),
      savePlain(tenantId, 'nach_retry_interval_days', int(input.nach.retryIntervalDays, 2), 'nach'),
      savePlain(tenantId, 'nach_present_days_before', int(input.nach.presentDaysBefore, 2), 'nach'),
      savePlain(tenantId, 'nach_default_max_amount', Number(input.nach.defaultMaxAmount) || 0, 'nach'),
      savePlain(tenantId, 'nach_auth_type', maybeString(input.nach.authType) ?? 'netbanking', 'nach'),
    ]);
  }

  if (input.messaging) {
    await Promise.all([
      savePlain(tenantId, 'whatsapp_sms_active', bool(input.messaging.enabled, true).toString(), 'notification'),
      savePlain(tenantId, 'notify_channel_sms', bool(input.messaging.smsEnabled).toString(), 'notification'),
      savePlain(tenantId, 'notify_channel_whatsapp', bool(input.messaging.whatsappEnabled).toString(), 'notification'),
      savePlain(tenantId, 'msg91_sender_id', maybeString(input.messaging.senderId) ?? 'LNTRCK', 'notification'),
      savePlain(tenantId, 'msg91_whatsapp_number', maybeString(input.messaging.whatsappNumber) ?? '', 'notification'),
      saveEncrypted(tenantId, 'msg91_auth_key', input.messaging.msg91AuthKey, 'notification'),
    ]);
  }

  if (input.email) {
    await Promise.all([
      savePlain(tenantId, 'notify_channel_email', bool(input.email.enabled).toString(), 'notification'),
      savePlain(tenantId, 'smtp_host', maybeString(input.email.smtpHost) ?? '', 'notification'),
      savePlain(tenantId, 'smtp_port', maybeString(input.email.smtpPort) ?? '587', 'notification'),
      savePlain(tenantId, 'smtp_user', maybeString(input.email.smtpUser) ?? '', 'notification'),
      savePlain(tenantId, 'smtp_from_name', maybeString(input.email.fromName) ?? '', 'notification'),
      saveEncrypted(tenantId, 'smtp_pass', input.email.smtpPass, 'notification'),
    ]);
  }

  if (input.kyc) {
    await Promise.all([
      savePlain(tenantId, 'kyc_digio_enabled', bool(input.kyc.enabled).toString(), 'kyc'),
      savePlain(tenantId, 'kyc_digio_environment', maybeString(input.kyc.environment) ?? 'sandbox', 'kyc'),
      savePlain(tenantId, 'kyc_digio_client_id', maybeString(input.kyc.clientId) ?? '', 'kyc'),
      saveEncrypted(tenantId, 'kyc_digio_client_secret', input.kyc.clientSecret, 'kyc'),
      saveEncrypted(tenantId, 'kyc_digio_webhook_secret', input.kyc.webhookSecret, 'kyc'),
    ]);
  }

  if (input.bureau) {
    const existing = await prisma.bureauCredential.findUnique({ where: { tenantId } });
    const memberId = maybeString(input.bureau.memberId);
    const apiKey = maybeString(input.bureau.apiKey);
    const apiSecret = maybeString(input.bureau.apiSecret);
    if (existing || memberId || apiKey) {
      await prisma.bureauCredential.upsert({
        where: { tenantId },
        update: {
          provider: maybeString(input.bureau.provider) ?? existing?.provider ?? 'CRIF',
          environment: maybeString(input.bureau.environment) ?? existing?.environment ?? 'sandbox',
          isActive: bool(input.bureau.enabled, existing?.isActive ?? false),
          ...(memberId ? { memberId: encryptField(memberId) ?? '' } : {}),
          ...(apiKey ? { apiKey: encryptField(apiKey) ?? '' } : {}),
          ...(apiSecret ? { apiSecret: encryptField(apiSecret) ?? '' } : {}),
        },
        create: {
          tenantId,
          provider: maybeString(input.bureau.provider) ?? 'CRIF',
          environment: maybeString(input.bureau.environment) ?? 'sandbox',
          isActive: bool(input.bureau.enabled),
          memberId: encryptField(memberId ?? '') ?? '',
          apiKey: encryptField(apiKey ?? '') ?? '',
          apiSecret: apiSecret ? encryptField(apiSecret) : null,
        },
      });
    }
  }

  return getIntegrationSettingsMasked(tenantId);
}

export function decryptIntegrationSetting(value: string | null | undefined): string | null {
  return decryptField(value);
}
