// Shared phone + email validation. Server-side authoritative; safe to reuse on
// the client for instant feedback.

export type PhoneResult =
  | { ok: true; value: string; e164: string }
  | { ok: false; error: string };

/**
 * Validate an Indian mobile number through every realistic shape a user types:
 * spaces, dashes, brackets, leading 0, +91 / 91 country code.
 *
 * Rules: must be digits only (after stripping formatting), resolve to exactly
 * 10 national digits, and start 6–9 (valid Indian mobile series).
 */
export function validateIndianMobile(raw: unknown): PhoneResult {
  if (raw == null) return { ok: false, error: 'Mobile number is required' };
  const str = String(raw).trim();
  if (!str) return { ok: false, error: 'Mobile number is required' };

  // Reject anything that isn't digits/spaces/+/-/() — catches letters etc.
  if (!/^[+\d][\d\s().-]*$/.test(str)) {
    return { ok: false, error: 'Mobile number must contain digits only' };
  }

  let digits = str.replace(/\D/g, '');

  // Strip country / trunk prefixes down to the 10 national digits.
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  if (digits.length !== 10) {
    return { ok: false, error: 'Mobile number must be 10 digits' };
  }
  if (!/^[6-9]/.test(digits)) {
    return { ok: false, error: 'Mobile number must start with 6, 7, 8 or 9' };
  }
  return { ok: true, value: digits, e164: `+91${digits}` };
}

export type EmailResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** Pragmatic email check — trims, lowercases, rejects obvious malformed input. */
export function validateEmail(raw: unknown): EmailResult {
  if (raw == null) return { ok: false, error: 'Email is required' };
  const value = String(raw).trim().toLowerCase();
  if (!value) return { ok: false, error: 'Email is required' };
  if (value.length > 254) return { ok: false, error: 'Email is too long' };
  // One @, non-empty local part, a dotted domain, no spaces.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    return { ok: false, error: 'Enter a valid email address' };
  }
  return { ok: true, value };
}
