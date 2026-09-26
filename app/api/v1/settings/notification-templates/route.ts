import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { listNotificationTemplates, saveManagedNotificationTemplate, TemplateError } from '@/lib/notify/templates';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await listNotificationTemplates(auth.context));
  } catch (error) {
    return fail(error instanceof TemplateError ? error.message : 'Template list failed',
      error instanceof TemplateError ? error.status : 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const data = await req.json().catch(() => null);
  if (!data || typeof data !== 'object') return fail('Invalid JSON body', 400);
  try {
    return ok(await saveManagedNotificationTemplate(auth.context, data));
  } catch (error) {
    return fail(error instanceof TemplateError ? error.message : 'Template save failed',
      error instanceof TemplateError ? error.status : 500);
  }
}
