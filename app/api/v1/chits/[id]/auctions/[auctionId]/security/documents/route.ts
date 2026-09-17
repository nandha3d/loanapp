import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

const ALLOWED_DOCUMENT_TYPES = new Set([
  'guarantor_photo',
  'guarantor_kyc',
  'security_cheque',
]);

function fileNameFromUrl(fileUrl: string) {
  const clean = fileUrl.split('?')[0] ?? fileUrl;
  return decodeURIComponent(clean.split('/').filter(Boolean).pop() || 'security-document');
}

async function loadScopedSecurity(
  ctx: Awaited<ReturnType<typeof requireMobileContext>>['context'],
  id: string,
  auctionId: string,
) {
  if (!ctx) return null;
  const auction = await prisma.chitAuction.findFirst({
    where: {
      id: auctionId,
      chitGroupId: id,
      chitGroup: {
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        ...scopedBranchWhere(ctx),
        deletedAt: null,
      },
    },
    include: { chitGroup: true },
  });
  if (!auction) return null;
  const security = await prisma.chitSecurity.findFirst({
    where: {
      tenantId: ctx.tenantId,
      chitGroupId: id,
      auctionId,
    },
    orderBy: { updatedAt: 'desc' },
  });
  return { auction, security };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id, auctionId } = await params;

  try {
    const scoped = await loadScopedSecurity(ctx, id, auctionId);
    if (!scoped) return fail('Auction not found', 404);
    if (!scoped.security) return ok([]);
    const documents = await prisma.chitDocument.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: 'chitfunds',
        entityType: 'chit_security',
        entityId: scoped.security.id,
      },
      orderBy: [{ documentType: 'asc' }, { uploadedAt: 'desc' }],
    });
    return ok(documents);
  } catch (e: any) {
    return fail(e?.message ?? 'Security documents load failed', 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);
  const { id, auctionId } = await params;
  const body = await req.json().catch(() => null) as any;
  const documentType = typeof body?.documentType === 'string' ? body.documentType.trim() : '';
  const fileUrl = typeof body?.fileUrl === 'string' ? body.fileUrl.trim() : '';

  if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) return fail('Invalid document type', 400);
  if (!fileUrl) return fail('fileUrl is required', 400);

  try {
    const scoped = await loadScopedSecurity(ctx, id, auctionId);
    if (!scoped) return fail('Auction not found', 404);
    if (!scoped.security) return fail('Submit security before uploading documents', 400);
    const document = await prisma.chitDocument.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: scoped.auction.chitGroup.branchId,
        appType: 'chitfunds',
        entityType: 'chit_security',
        entityId: scoped.security.id,
        documentType,
        fileName: typeof body?.fileName === 'string' && body.fileName.trim()
          ? body.fileName.trim()
          : fileNameFromUrl(fileUrl),
        fileUrl,
        mimeType: typeof body?.mimeType === 'string' && body.mimeType.trim() ? body.mimeType.trim() : null,
        sizeBytes: Number.isFinite(Number(body?.sizeBytes)) ? Number(body.sizeBytes) : null,
        status: 'pending',
        uploadedById: ctx.userId,
      },
    });
    return ok(document);
  } catch (e: any) {
    return fail(e?.message ?? 'Security document upload failed', 500);
  }
}
