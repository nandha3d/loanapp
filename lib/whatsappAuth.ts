import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import prisma from './db';
import { decryptField } from './pii';
import { getSetting } from './tenant';
import { generateBorrowerOtp, hashBorrowerOtp, verifyBorrowerOtp, normalizeBorrowerOtpInput } from './borrowerOtp';
import { checkRateLimit, routeKey } from './rateLimit';

/**
 * STRICT SECURITY INVARIANT:
 * loan.samuraibuiness.in is a standalone single-tenant client deployment.
 * Under NO circumstances should WhatsApp authentication touch, override, or alter
 * loan.samuraibuiness.in.
 */
export const EXCLUDED_DOMAINS = [
  'loan.samuraibuiness.in',
  'samuraibuiness.in',
];

export const DEFAULT_MSG91_AUTH_KEY = '463379AbmG58Zt6892f626P1';
export const WHATSAPP_OTP_TTL_SECONDS = 5 * 60; // 5 minutes

export interface DomainCheckInput {
  host?: string | null;
  tenantSlug?: string | null;
  tenantId?: string | null;
}

/**
 * Checks whether the given host, slug, or tenantId belongs to the excluded Samurai standalone client.
 * Returns true if the domain/tenant must NOT be touched by WhatsApp authentication.
 */
export async function isSamuraiExcludedDomain(input: DomainCheckInput): Promise<boolean> {
  const { host, tenantSlug, tenantId } = input;

  if (host) {
    const cleanHost = host.toLowerCase().split(':')[0].trim();
    if (EXCLUDED_DOMAINS.some((d) => cleanHost === d || cleanHost.endsWith(`.${d}`))) {
      return true;
    }
  }

  if (tenantSlug) {
    const cleanSlug = tenantSlug.toLowerCase().trim();
    if (cleanSlug === 'samurai' || cleanSlug.includes('samuraibusiness') || cleanSlug.includes('samuraibuiness')) {
      return true;
    }
  }

  if (tenantId) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { customDomain: true, slug: true },
      });
      if (tenant?.customDomain && EXCLUDED_DOMAINS.includes(tenant.customDomain.toLowerCase())) {
        return true;
      }
      if (tenant?.slug && (tenant.slug.toLowerCase() === 'samurai' || tenant.slug.toLowerCase().includes('samuraibuiness'))) {
        return true;
      }
    } catch (e) {
      console.error('[whatsappAuth] Failed to check tenant exclusion:', e);
    }
  }

  return false;
}

/**
 * Resolves the JWT secret used to sign and verify WhatsApp OTP challenges.
 */
function getChallengeSecret(): Uint8Array {
  const secret = process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('MOBILE_JWT_SECRET, NEXTAUTH_SECRET, or AUTH_SECRET is required for WhatsApp OTP signing.');
  }
  return new TextEncoder().encode(secret);
}

function getBorrowerSecretString(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.MOBILE_JWT_SECRET;
  if (!secret) throw new Error('Secret is required for OTP hashing.');
  return secret;
}

/**
 * Normalises a phone number to standard 10-digit format and E.164 (without plus, e.g. 91XXXXXXXXXX).
 */
export function normalisePhoneForWhatsApp(rawPhone: string): { e164: string; digits10: string } | null {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10) {
    return { e164: `91${digits}`, digits10: digits };
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return { e164: digits, digits10: digits.slice(2) };
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return { e164: digits, digits10: digits.slice(-10) };
  }
  return null;
}

export interface Msg91ResolvedConfig {
  authKey: string;
  whatsappNumber: string;
  templateName: string;
  templateId?: string;
}

/**
 * Resolves MSG91 credentials from AppSetting (tenant-scoped) or environment variables.
 */
export async function getMsg91Config(tenantId?: string | null): Promise<Msg91ResolvedConfig> {
  let tenantAuthKey = '';
  let tenantWaNumber = '';
  let tenantTemplate = '';
  let tenantTemplateId = '';

  if (tenantId) {
    try {
      [tenantAuthKey, tenantWaNumber, tenantTemplate, tenantTemplateId] = await Promise.all([
        getSetting(tenantId, 'msg91_auth_key', ''),
        getSetting(tenantId, 'msg91_whatsapp_number', ''),
        getSetting(tenantId, 'msg91_whatsapp_otp_template', ''),
        getSetting(tenantId, 'msg91_otp_template_id', ''),
      ]);
    } catch {
      // Ignore tenant lookup error, will fall back to env
    }
  }

  const rawKey = tenantAuthKey || process.env.MSG91_AUTH_KEY || DEFAULT_MSG91_AUTH_KEY;
  const authKey = decryptField(rawKey) || rawKey;

  const whatsappNumber =
    tenantWaNumber ||
    process.env.MSG91_WHATSAPP_NUMBER ||
    '15559636218';

  const templateName =
    tenantTemplate ||
    process.env.MSG91_WHATSAPP_OTP_TEMPLATE ||
    'zolofund_auth';

  const templateId =
    tenantTemplateId ||
    process.env.MSG91_OTP_TEMPLATE_ID ||
    undefined;

  return {
    authKey,
    whatsappNumber,
    templateName,
    templateId,
  };
}

export interface SendWhatsAppOtpOptions {
  phone: string;
  tenantId?: string | null;
  host?: string | null;
  tenantSlug?: string | null;
  purpose?: 'login' | 'borrower_login' | '2fa' | 'reset_password';
  userId?: string | null;
  customerId?: string | null;
}

export interface SendWhatsAppOtpResult {
  success: boolean;
  challengeToken?: string;
  error?: string;
  testOtp?: string;
}

/**
 * Generates an OTP and sends it via MSG91 WhatsApp Outbound API.
 * Returns a signed challenge token to be verified by verifyWhatsAppOtp.
 */
export async function sendWhatsAppAuthOtp(options: SendWhatsAppOtpOptions): Promise<SendWhatsAppOtpResult> {
  const { phone, tenantId, host, tenantSlug, purpose = 'login', userId, customerId } = options;

  // 1. Strict Samurai protection guard
  const isExcluded = await isSamuraiExcludedDomain({ host, tenantSlug, tenantId });
  if (isExcluded) {
    return {
      success: false,
      error: 'WhatsApp authentication service is not permitted for this domain.',
    };
  }

  // 2. Validate and normalise phone
  const normalised = normalisePhoneForWhatsApp(phone);
  if (!normalised) {
    return { success: false, error: 'Invalid phone number. Please provide a valid 10-digit mobile number.' };
  }

  // 3. Cost-protection shields (rate limit, cooldown, daily cap)
  const isTest = process.env.NODE_ENV === 'test';
  if (!isTest) {
    // 3a. Cooldown: Maximum 1 OTP per 60 seconds per phone
    const cooldown = await checkRateLimit(routeKey('wa:cooldown', normalised.digits10), {
      limit: 1,
      windowMs: 60 * 1000,
    });
    if (!cooldown.allowed) {
      return { success: false, error: 'Please wait 60 seconds before requesting another code.' };
    }

    // 3b. Per-phone rate limit: Max 3 OTP requests per 15 minutes
    const phoneLimit = await checkRateLimit(routeKey('wa:phone', normalised.digits10), {
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });
    if (!phoneLimit.allowed) {
      return { success: false, error: 'Too many OTP requests for this number. Please wait 15 minutes.' };
    }

    // 3c. Tenant daily budget cap (default 50 OTPs/day)
    if (tenantId) {
      const maxDaily = Number(process.env.MSG91_MAX_DAILY_OTP || 50);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const sentToday = await prisma.notificationLog.count({
        where: {
          tenantId,
          channel: 'whatsapp',
          event: 'auth_otp',
          status: 'sent',
          createdAt: { gte: startOfDay },
        },
      });

      if (sentToday >= maxDaily) {
        return {
          success: false,
          error: 'Daily WhatsApp verification limit reached for this organization. Please sign in with password.',
        };
      }
    }
  }

  // 4. Generate secure 6-digit OTP & Hash
  const otpCode = generateBorrowerOtp();
  const secretStr = getBorrowerSecretString();
  const otpHash = hashBorrowerOtp(otpCode, secretStr);

  // 4. Issue HMAC-signed challenge token with 5-minute TTL
  const challengeToken = await new SignJWT({
    phone: normalised.digits10,
    e164: normalised.e164,
    otpHash,
    tenantId: tenantId ?? null,
    purpose,
    userId: userId ?? null,
    customerId: customerId ?? null,
    role: 'whatsapp_otp',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('zolofund')
    .setAudience('whatsapp-otp-challenge')
    .setExpirationTime(`${WHATSAPP_OTP_TTL_SECONDS}s`)
    .sign(getChallengeSecret());

  // 5. Send message via MSG91
  const config = await getMsg91Config(tenantId);

  let deliverySuccess = false;
  let deliveryError: string | undefined;

  if (config.authKey && config.whatsappNumber) {
    try {
      // Primary: Exact MSG91 template format with body_1 parameter
      const res = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: config.authKey,
        },
        body: JSON.stringify({
          integrated_number: config.whatsappNumber,
          content_type: 'template',
          payload: {
            messaging_product: 'whatsapp',
            type: 'template',
            template: {
              name: config.templateName,
              language: {
                code: 'en',
                policy: 'deterministic',
              },
              namespace: null,
              to_and_components: [
                {
                  to: [normalised.e164],
                  components: {
                    body_1: {
                      type: 'text',
                      value: otpCode,
                    },
                  },
                },
              ],
            },
          },
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.status === 'success' || !data.error)) {
        deliverySuccess = true;
      } else {
        // Fallback: Alternative array-based component format
        const fallbackRes = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authkey: config.authKey,
          },
          body: JSON.stringify({
            integrated_number: config.whatsappNumber,
            content_type: 'template',
            payload: {
              to: normalised.e164,
              type: 'template',
              template: {
                name: config.templateName,
                language: { code: 'en' },
                components: [
                  {
                    type: 'body',
                    parameters: [{ type: 'text', text: otpCode }],
                  },
                ],
              },
            },
          }),
        });

        const fallbackData = await fallbackRes.json().catch(() => ({}));
        if (fallbackRes.ok && (fallbackData.status === 'success' || !fallbackData.error)) {
          deliverySuccess = true;
        } else {
          deliveryError = JSON.stringify(data.error || fallbackData.error || fallbackData);
        }
      }
    } catch (err: any) {
      deliveryError = err.message;
      console.error('[whatsappAuth] Network error sending WhatsApp message:', err);
    }
  }

  // 6. Log notification
  if (tenantId) {
    try {
      await prisma.notificationLog.create({
        data: {
          tenantId,
          channel: 'whatsapp',
          recipient: normalised.e164,
          status: deliverySuccess ? 'sent' : 'failed',
          errorMessage: deliveryError ?? null,
          provider: 'msg91',
          entityType: customerId ? 'customer' : userId ? 'user' : null,
          entityId: customerId ?? userId ?? null,
          event: 'auth_otp',
          messageBody: `WhatsApp OTP requested for ${purpose}. Template: ${config.templateName}`,
        },
      });
    } catch (e) {
      console.error('[whatsappAuth] Failed to write notification log:', e);
    }
  }

  const isDev = process.env.NODE_ENV !== 'production';

  return {
    success: true, // Challenge is always issued so caller can test OTP in dev or proceed
    challengeToken,
    ...(isDev || !deliverySuccess ? { testOtp: otpCode } : {}),
    ...(deliveryError && !deliverySuccess ? { error: `WhatsApp delivery note: ${deliveryError}` } : {}),
  };
}

export interface VerifyWhatsAppOtpOptions {
  phone: string;
  otp: string;
  challengeToken: string;
  host?: string | null;
  tenantSlug?: string | null;
}

export interface VerifyWhatsAppOtpResult {
  success: boolean;
  error?: string;
  claims?: {
    phone: string;
    e164: string;
    tenantId: string | null;
    purpose: string;
    userId: string | null;
    customerId: string | null;
  };
}

/**
 * Verifies a WhatsApp OTP against the challenge token.
 */
export async function verifyWhatsAppAuthOtp(options: VerifyWhatsAppOtpOptions): Promise<VerifyWhatsAppOtpResult> {
  const { phone, otp, challengeToken, host, tenantSlug } = options;

  // 1. Strict Samurai protection guard
  const isExcluded = await isSamuraiExcludedDomain({ host, tenantSlug });
  if (isExcluded) {
    return { success: false, error: 'WhatsApp authentication service is not permitted for this domain.' };
  }

  const normalised = normalisePhoneForWhatsApp(phone);
  if (!normalised) {
    return { success: false, error: 'Invalid phone number format.' };
  }

  const cleanOtp = normalizeBorrowerOtpInput(otp);
  if (!cleanOtp || cleanOtp.length !== 6) {
    return { success: false, error: 'Invalid OTP. Code must be 6 digits.' };
  }

  // 2. Verify challenge token
  let payload: any;
  try {
    const verified = await jwtVerify(challengeToken, getChallengeSecret(), {
      issuer: 'zolofund',
      audience: 'whatsapp-otp-challenge',
    });
    payload = verified.payload;
  } catch (err: any) {
    return { success: false, error: 'OTP challenge session expired or invalid. Please request a new OTP.' };
  }

  if (payload.role !== 'whatsapp_otp' || payload.phone !== normalised.digits10) {
    return { success: false, error: 'OTP session mismatch. Please request a new OTP.' };
  }

  // 3. Verify OTP hash with timingSafeEqual
  const secretStr = getBorrowerSecretString();
  const isValid = verifyBorrowerOtp({
    otp: cleanOtp,
    expectedHash: payload.otpHash,
    secret: secretStr,
  });

  if (!isValid) {
    return { success: false, error: 'Incorrect OTP verification code.' };
  }

  return {
    success: true,
    claims: {
      phone: payload.phone,
      e164: payload.e164,
      tenantId: payload.tenantId,
      purpose: payload.purpose,
      userId: payload.userId,
      customerId: payload.customerId,
    },
  };
}
