import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  maxUploadSizeFor,
  storeTenantUpload,
  validateFileBytes,
} from '@/lib/fileUpload';

// Borrower-mobile counterpart of /api/v1/upload (staff/agent JWT) — same
// validation, different token audience (requireBorrowerMobileContext).
export async function POST(req: NextRequest) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);

  const rl = await checkRateLimit(routeKey('borrower-mobile-upload', getClientIp(req)), { limit: 20, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) return fail('Too many uploads. Please wait before trying again.', 429);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('Invalid form data', 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) return fail('No file provided', 400);

  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    return fail('File type not allowed. Only JPEG, PNG, WebP, and PDF are accepted.', 400);
  }
  if (file.size > maxUploadSizeFor(file.type)) {
    return fail('File exceeds the 5 MB limit.', 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateFileBytes(buffer, file.type)) {
    return fail('Invalid file signature. File may be corrupted or spoofed.', 400);
  }

  const stored = await storeTenantUpload({
    tenantId: borrower.tenantId,
    mimeType: file.type,
    buffer,
  });
  return ok({ url: stored.url, filename: stored.fileName, size: file.size });
}
