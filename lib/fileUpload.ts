/**
 * Shared file upload validation helper.
 * Validates that the raw bytes of a file match what the declared MIME type claims
 * (magic-byte / file signature check).  This prevents spoofed uploads where an
 * attacker renames a malicious file to .jpg and sets Content-Type: image/jpeg.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

const UPLOAD_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'audio/mp4': '.m4a',
  'audio/m4a': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/webm': '.webm',
  'audio/mpeg': '.mp3',
};

function assertSafeUploadSegment(value: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(value)) {
    throw new UploadValidationError(`Invalid upload ${label}`);
  }
}

export function uploadExtensionForMime(mimeType: string): string {
  const extension = UPLOAD_EXTENSIONS[mimeType];
  if (!extension) throw new UploadValidationError('File type not allowed');
  return extension;
}

export function buildUploadFileName(
  mimeType: string,
  options: { id?: string; prefix?: string } = {},
): string {
  const id = options.id ?? randomUUID();
  const prefix = options.prefix ?? 'upload';
  assertSafeUploadSegment(id, 'identifier');
  assertSafeUploadSegment(prefix, 'prefix');
  return `${prefix}_${id}${uploadExtensionForMime(mimeType)}`;
}

export function resolveTenantUploadPath(input: {
  baseDir: string;
  tenantId: string;
  scopes?: string[];
  fileName: string;
}): string {
  const base = path.resolve(input.baseDir);
  const scopes = input.scopes ?? [];
  assertSafeUploadSegment(input.tenantId, 'tenant');
  for (const scope of scopes) assertSafeUploadSegment(scope, 'scope');
  assertSafeUploadSegment(input.fileName, 'filename');

  const target = path.resolve(base, input.tenantId, ...scopes, input.fileName);
  if (!target.startsWith(`${base}${path.sep}`)) {
    throw new UploadValidationError('Invalid upload path');
  }
  return target;
}

/**
 * Base directory for uploaded files (profile photos, KYC docs, QR codes…).
 * Set UPLOAD_DIR to an ABSOLUTE path outside the app checkout in production —
 * the default lives inside the repo folder and is wiped by deploys that
 * reset/clean the working tree.
 */
export function uploadBaseDir(): string {
  const dir = process.env.UPLOAD_DIR;
  if (dir && dir.trim()) return path.resolve(dir.trim());
  return path.join(process.cwd(), 'private', 'uploads');
}

export const ALLOWED_UPLOAD_MIME_TYPES: string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  // Short voice-bid proof clips (chit live room). Capped separately at 1 MB.
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/webm',
  'audio/mpeg',
];

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (images/PDF)
// Voice clips are a few seconds long — a tighter cap keeps disk + poll cheap.
export const MAX_AUDIO_UPLOAD_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

export function isAudioMime(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}

/** Size cap for a given MIME type (audio is tighter than images/PDF). */
export function maxUploadSizeFor(mimeType: string): number {
  return isAudioMime(mimeType) ? MAX_AUDIO_UPLOAD_SIZE_BYTES : MAX_UPLOAD_SIZE_BYTES;
}

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
    case 'audio/mp4':
    case 'audio/m4a':
    case 'audio/x-m4a':
    case 'audio/aac':
      // MP4/M4A container: "ftyp" at byte offset 4. Raw AAC (ADTS): 0xFFF1/0xFFF9.
      return (
        hex.substring(8, 16) === '66747970' ||
        hex.startsWith('FFF1') ||
        hex.startsWith('FFF9')
      );
    case 'audio/webm':
      // EBML header shared by WebM/Matroska.
      return hex.startsWith('1A45DFA3');
    case 'audio/mpeg':
      // MP3: ID3 tag or an MPEG frame sync (0xFFEx/0xFFFx).
      return hex.startsWith('494433') || hex.startsWith('FFF') || hex.startsWith('FFE');
    default:
      return false;
  }
}

export function detectMimeTypeFromBytes(buffer: Buffer): string | null {
  const hex = buffer.subarray(0, 12).toString('hex').toUpperCase();
  if (hex.startsWith('FFD8FF')) return 'image/jpeg';
  if (hex.startsWith('89504E47')) return 'image/png';
  if (hex.startsWith('25504446')) return 'application/pdf';
  if (hex.startsWith('52494646') && hex.substring(16, 24) === '57454250') return 'image/webp';
  if (hex.substring(8, 16) === '66747970' || hex.startsWith('FFF1') || hex.startsWith('FFF9')) return 'audio/mp4';
  if (hex.startsWith('1A45DFA3')) return 'audio/webm';
  if (hex.startsWith('494433') || hex.startsWith('FFF') || hex.startsWith('FFE')) return 'audio/mpeg';
  return null;
}

export async function storeTenantUpload(input: {
  tenantId: string;
  mimeType: string;
  buffer: Buffer;
  scopes?: string[];
  prefix?: string;
}): Promise<{ fileName: string; url: string }> {
  let effectiveMime = input.mimeType;

  if (!validateFileBytes(input.buffer, effectiveMime)) {
    const detected = detectMimeTypeFromBytes(input.buffer);
    if (detected && ALLOWED_UPLOAD_MIME_TYPES.includes(detected)) {
      effectiveMime = detected;
    } else {
      throw new UploadValidationError('Invalid file signature');
    }
  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(effectiveMime)) {
    throw new UploadValidationError('File type not allowed');
  }
  if (input.buffer.byteLength > maxUploadSizeFor(effectiveMime)) {
    throw new UploadValidationError(
      isAudioMime(effectiveMime)
        ? 'Audio clip exceeds the 1 MB limit'
        : 'File exceeds the 5 MB limit',
    );
  }

  const scopes = input.scopes ?? [];
  const fileName = buildUploadFileName(effectiveMime, { prefix: input.prefix });
  const target = resolveTenantUploadPath({
    baseDir: uploadBaseDir(),
    tenantId: input.tenantId,
    scopes,
    fileName,
  });
  await mkdir(path.dirname(target), { recursive: true });

  const handle = await open(target, 'wx');
  try {
    await handle.writeFile(input.buffer);
  } finally {
    await handle.close();
  }

  return {
    fileName,
    url: `/api/files/${[input.tenantId, ...scopes, fileName].join('/')}`,
  };
}
