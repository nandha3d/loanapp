import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/db';
import { isTenantFileAccessAllowed } from '@/lib/fileAccessPolicy';

const PRIVATE_DIR = path.join(process.cwd(), 'private', 'uploads');

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.gif': 'image/gif',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  let sessionTenantId: string;
  let role: string;
  let userId: string;

  const session = await auth();
  if (session?.user?.id) {
    sessionTenantId = (session.user as any).tenantId as string;
    role = (session.user as any).role as string;
    userId = session.user.id;
  } else {
    const borrowerSession = await getBorrowerSession();
    if (borrowerSession) {
      sessionTenantId = borrowerSession.tenantId;
      role = borrowerSession.role || 'borrower';
      userId = borrowerSession.customerId;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { path: segments } = await params;
  if (!segments || segments.length < 2) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  // segments[0] is the tenantId — enforce tenant isolation
  const requestedTenantId = segments[0];

  if (!isTenantFileAccessAllowed({ role, requestedTenantId, sessionTenantId })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Prevent path traversal — every segment must be a plain name
  for (const seg of segments) {
    if (!seg || seg === '..' || seg === '.' || seg.includes('/') || seg.includes('\\')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }
  }

  const filePath = path.join(PRIVATE_DIR, ...segments);

  // Double-check the resolved path stays within PRIVATE_DIR
  const resolved = path.resolve(filePath);
  const base = path.resolve(PRIVATE_DIR);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const buffer = fs.readFileSync(resolved);
  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const filename = segments[segments.length - 1];

  // Audit log
  prisma.auditLog.create({
    data: {
      tenantId: sessionTenantId,
      userId: userId,
      action: 'file_download',
      entityType: 'file',
      entityId: segments.join('/'),
    },
  }).catch(() => {}); // fire and forget

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
