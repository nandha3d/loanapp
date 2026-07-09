import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  checkRateLimit,
  getClientIp,
  routeKey,
} from '@/lib/rateLimit';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  isAudioMime,
  maxUploadSizeFor,
  uploadBaseDir,
  validateFileBytes,
} from '@/lib/fileUpload';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const ip = getClientIp(req);
  const rl = await checkRateLimit(routeKey('mobile-upload', ip), {
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) {
    return fail('Too many uploads. Please wait before trying again.', 429);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('Invalid form data', 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) return fail('No file provided', 400);

  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    return fail(
      'File type not allowed. Only JPEG, PNG, WebP, PDF, and short audio clips are accepted.',
      400,
    );
  }
  if (file.size > maxUploadSizeFor(file.type)) {
    return fail(
      isAudioMime(file.type)
        ? 'Audio clip exceeds the 1 MB limit.'
        : 'File exceeds the 5 MB limit.',
      400,
    );
  }

  const ext =
    path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase() ||
    '.bin';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const uploadDir = path.join(uploadBaseDir(), ctx.tenantId);
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateFileBytes(buffer, file.type)) {
    return fail(
      'Invalid file signature. File may be corrupted or spoofed.',
      400,
    );
  }

  await writeFile(path.join(uploadDir, safeName), buffer);
  const url = `/api/files/${ctx.tenantId}/${safeName}`;
  return ok({ url, filename: safeName, size: file.size });
}
