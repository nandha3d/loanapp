import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES, uploadBaseDir, validateFileBytes } from '@/lib/fileUpload';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 });
  }

  // Rate limit: 20 uploads per IP per 10 minutes
  const ip = getClientIp(req);
  const rl = await checkRateLimit(routeKey('upload', ip), { limit: 20, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait before trying again.' },
      { status: 429 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed. Only JPEG, PNG, WebP, and PDF are accepted.' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 5 MB limit.' }, { status: 400 });
  }

  // Sanitize filename — prevent path traversal
  const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase() || '.bin';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;

  // Scope files by tenantId in private dir — never publicly accessible
  const uploadDir = path.join(uploadBaseDir(), tenantId);
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!validateFileBytes(buffer, file.type)) {
    return NextResponse.json({ error: 'Invalid file signature. File may be corrupted or spoofed.' }, { status: 400 });
  }

  const filePath = path.join(uploadDir, safeName);
  await writeFile(filePath, buffer);

  const url = `/api/files/${tenantId}/${safeName}`;

  return NextResponse.json({ url, filename: safeName });
}
