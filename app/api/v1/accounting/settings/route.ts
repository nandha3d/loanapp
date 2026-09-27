import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import {
  getPremiumAccountingSettings,
  PremiumAccountingServiceError,
} from '@/lib/accounting/premiumMobileService';
import { updateAccountingSettings } from '@/lib/accounting/settingsUpdate';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  try {
    return ok(await getPremiumAccountingSettings(auth.context));
  } catch (error) {
    return fail(message(error, 'Accounting settings failed'), status(error));
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await updateAccountingSettings(auth.context, await req.json()));
  } catch (error) {
    return fail(message(error, 'Accounting settings update failed'), status(error));
  }
}

function status(error: unknown) {
  return error instanceof PremiumAccountingServiceError ? error.status : 500;
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
