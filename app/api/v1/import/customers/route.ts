import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getSetting } from '@/lib/tenant';
import { CustomerImportError, importCustomers } from '@/lib/imports/customers';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const actor = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(actor.role)) return fail('Forbidden', 403);
  if (req.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return fail('Expected JSON', 415);
  }

  const configured = Number(await getSetting(actor.tenantId, 'customer_import_max_bytes', '1048576'));
  const maxBytes = Number.isSafeInteger(configured) && configured > 0 ? configured : 1048576;
  const reader = req.body?.getReader();
  if (!reader) return fail('Expected JSON', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return fail(`Import exceeds ${maxBytes} bytes`, 413);
      }
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return ok(await importCustomers(actor, data));
  } catch (error) {
    if (error instanceof SyntaxError) return fail('Invalid JSON', 400);
    if (error instanceof CustomerImportError) return fail(error.message, error.status);
    return fail('Customer import failed', 500);
  } finally {
    reader.releaseLock();
  }
}
