import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  maxUploadSizeFor,
  uploadBaseDir,
  validateFileBytes,
} from '@/lib/fileUpload';

// Borrower-portal counterpart of /api/v1/upload (staff/agent mobile JWT) —
// same validation, but authenticated via the borrower_session cookie.
export async function POST(req: Request) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = getClientIp(req);
  const rl = await checkRateLimit(routeKey('borrower-upload', ip), { limit: 20, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many uploads. Please wait before trying again.' }, { status: 429 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed. Only JPEG, PNG, WebP, and PDF are accepted.' }, { status: 400 });
  }
  if (file.size > maxUploadSizeFor(file.type)) {
    return NextResponse.json({ error: 'File exceeds the 5 MB limit.' }, { status: 400 });
  }

  const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase() || '.bin';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const uploadDir = path.join(uploadBaseDir(), session.tenantId);
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateFileBytes(buffer, file.type)) {
    return NextResponse.json({ error: 'Invalid file signature. File may be corrupted or spoofed.' }, { status: 400 });
  }

  await writeFile(path.join(uploadDir, safeName), buffer);
  const url = `/api/files/${session.tenantId}/${safeName}`;
  return NextResponse.json({ url, filename: safeName, size: file.size });
}
