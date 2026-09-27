import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { PremiumAccountingServiceError } from '@/lib/accounting/premiumMobileService';
import {
  generateAccountingExport, listAccountingExportRuns,
  pushAccountingToTally, testAccountingTallyConnector,
} from '@/lib/accounting/exportService';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  try {
    const page = req.nextUrl.searchParams.get('page');
    return ok(await listAccountingExportRuns(auth.context, page === null ? undefined : Number(page)));
  } catch (error) {
    return fail(message(error, 'Export runs failed'), status(error));
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Invalid action', 400);
    if (body.action === 'generate') {
      const file = await generateAccountingExport(auth.context, body);
      return ok({ filename: file.filename, mimeType: file.mimeType,
        base64: file.bytes.toString('base64') });
    }
    if (body.action === 'test_tally') return ok(await testAccountingTallyConnector(auth.context));
    if (body.action === 'push_tally') return ok(await pushAccountingToTally(auth.context, body.periodKey));
    return fail('Invalid action', 400);
  } catch (error) {
    return fail(message(error, 'Export failed'), status(error));
  }
}

function status(error: unknown) {
  return error instanceof PremiumAccountingServiceError ? error.status : 500;
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
