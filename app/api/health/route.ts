import { apiSuccess } from '@/lib/utils';

export async function GET() {
  return apiSuccess({ ok: true, version: '1.0.0', timestamp: new Date().toISOString() });
}
