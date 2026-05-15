/**
 * Shared file upload validation helper.
 * Validates that the raw bytes of a file match what the declared MIME type claims
 * (magic-byte / file signature check).  This prevents spoofed uploads where an
 * attacker renames a malicious file to .jpg and sets Content-Type: image/jpeg.
 */

export const ALLOWED_UPLOAD_MIME_TYPES: string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Returns true when the first bytes of `buffer` match the expected magic
 * bytes for `mimeType`.  Returns false for unsupported or mismatched types.
 */
export function validateFileBytes(buffer: Buffer, mimeType: string): boolean {
  const hex = buffer.subarray(0, 12).toString('hex').toUpperCase();

  switch (mimeType) {
    case 'image/jpeg':
      return hex.startsWith('FFD8FF');
    case 'image/png':
      return hex.startsWith('89504E47');
    case 'application/pdf':
      return hex.startsWith('25504446');
    case 'image/webp':
      // WebP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
      return hex.startsWith('52494646') && hex.substring(16, 24) === '57454250';
    default:
      return false;
  }
}
