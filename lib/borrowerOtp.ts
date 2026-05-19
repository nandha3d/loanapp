import crypto from 'node:crypto';

export const BORROWER_OTP_TTL_SECONDS = 5 * 60;

export function normalizeBorrowerOtpInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function generateBorrowerOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashBorrowerOtp(otp: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(normalizeBorrowerOtpInput(otp)).digest('hex');
}

export function verifyBorrowerOtp(input: { otp: string; expectedHash: string; secret: string }): boolean {
  const actual = Buffer.from(hashBorrowerOtp(input.otp, input.secret), 'hex');
  const expected = Buffer.from(input.expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
