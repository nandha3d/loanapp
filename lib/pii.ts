import crypto from 'node:crypto';

const AADHAR_ENCRYPTION_PREFIX = 'enc:v1';

// SEC-04: passphrase -> 32-byte key uses scrypt with a fixed app-level salt.
// Prefer a 64-hex env var (32 raw bytes from /dev/urandom) so this path is
// never taken in production. Salt is intentionally constant so the same
// env value derives the same key across boots (deterministic decrypt).
const PII_SCRYPT_SALT = Buffer.from('loantrack-pii-v1', 'utf8');
const _keyCache = new Map<string, Buffer>();

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

  // SEC-04: anything else gets scrypt-derived (was plain SHA-256 before).
  // Reject low-entropy passphrases in production.
  if (utf8Key.length < 24 && process.env.NODE_ENV === 'production') {
    throw new Error(
      'PII_ENCRYPTION_KEY too weak — provide 64 hex chars OR >= 24 utf8 bytes.',
    );
  }

  const cached = _keyCache.get(rawKey);
  if (cached) return cached;

  const derived = crypto.scryptSync(rawKey, PII_SCRYPT_SALT, 32, {
    N: 16384,
    r: 8,
    p: 1,
  });
  _keyCache.set(rawKey, derived);
  return derived;
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

// SEC-04 migration: rows encrypted before scrypt was introduced used a
// plain SHA-256 derivation of the passphrase. Keep this as a fallback
// only on decrypt so existing data stays readable.
function getLegacySha256Key(rawKey = process.env.PII_ENCRYPTION_KEY): Buffer | null {
  if (!rawKey) return null;
  if (/^[a-f0-9]{64}$/i.test(rawKey)) return null;
  const utf8Key = Buffer.from(rawKey, 'utf8');
  if (utf8Key.length === 32) return null;
  return crypto.createHash('sha256').update(rawKey).digest();
}

function tryDecryptWithKey(
  key: Buffer,
  iv: Buffer,
  tag: Buffer,
  ciphertext: Buffer,
): string | null {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
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

  const iv = Buffer.from(ivValue, 'base64url');
  const tag = Buffer.from(tagValue, 'base64url');
  const ciphertext = Buffer.from(encryptedValue, 'base64url');

  // Try current (scrypt) key first.
  let plaintext = tryDecryptWithKey(getEncryptionKey(rawKey), iv, tag, ciphertext);

  // Fall back to legacy SHA-256 derivation for pre-SEC-04 rows.
  if (plaintext === null) {
    const legacyKey = getLegacySha256Key(rawKey);
    if (legacyKey) {
      plaintext = tryDecryptWithKey(legacyKey, iv, tag, ciphertext);
    }
  }

  if (plaintext === null) {
    throw new Error('Failed to decrypt Aadhaar — key mismatch.');
  }

  return normalizeAadharNumber(plaintext);
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

