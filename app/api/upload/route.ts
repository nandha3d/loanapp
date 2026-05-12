import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant not resolved' }, { status: 400 });
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

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed. Only JPEG, PNG, WebP, and PDF are accepted.' }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 5 MB limit.' }, { status: 400 });
  }

  // Sanitize filename — prevent path traversal
  const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase() || '.bin';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;

  // Scope files by tenantId — prevents cross-tenant access
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', tenantId);
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(uploadDir, safeName);
  await writeFile(filePath, buffer);

  const url = `/uploads/${tenantId}/${safeName}`;

  return NextResponse.json({ url, filename: safeName });
}
