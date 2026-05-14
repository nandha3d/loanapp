import crypto from 'node:crypto';

const AADHAR_ENCRYPTION_PREFIX = 'enc:v1';

function normalizeAadharNumber(value: string): string {
  return value.replace(/\D/g, '');
}

function getEncryptionKey(rawKey = process.env.PII_ENCRYPTION_KEY): Buffer {
  if (!rawKey) {
    throw new Error('PII_ENCRYPTION_KEY is required to encrypt or decrypt Aadhaar numbers.');
  }

  if (/^[a-f0-9]{64}$/i.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  const utf8Key = Buffer.from(rawKey, 'utf8');
  if (utf8Key.length === 32) {
    return utf8Key;
  }

  return crypto.createHash('sha256').update(rawKey).digest();
}

export function encryptAadharNumber(value: string | null | undefined, rawKey?: string): string | null {
  if (!value) return null;
  if (value.startsWith(`${AADHAR_ENCRYPTION_PREFIX}:`)) return value;

  const normalized = normalizeAadharNumber(value);
  if (!normalized) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(rawKey), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    AADHAR_ENCRYPTION_PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptAadharNumber(value: string | null | undefined, rawKey?: string): string | null {
  if (!value) return null;
  if (!value.startsWith(`${AADHAR_ENCRYPTION_PREFIX}:`)) {
    const normalized = normalizeAadharNumber(value);
    return normalized || null;
  }

  const [, version, ivValue, tagValue, encryptedValue] = value.split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Unsupported Aadhaar encryption payload.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(rawKey),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');

  return normalizeAadharNumber(decrypted);
}

export function maskAadharNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeAadharNumber(value);
  if (!normalized) return null;
  const lastFour = normalized.slice(-4);
  return `XXXX XXXX ${lastFour}`;
}

export function isMaskedAadharNumber(value: string | null | undefined): boolean {
  return Boolean(value && /^x{4}\s*x{4}\s*\d{4}$/i.test(value.trim()));
}

