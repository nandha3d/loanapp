import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getTenantSettings } from '@/lib/tenant';
import { THEME_SETTING_KEY } from '@/lib/themes';

// Tenant colour theme for the mobile app. Unlike /api/v1/settings this is
// readable by every authenticated role — agents need the theme too.
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const settings = await getTenantSettings(ctx.tenantId);
    return ok({
      preset: settings[THEME_SETTING_KEY] || 'default',
      primary: settings['primary_color'] || null,
      primaryDark: settings['primary_dark'] || null,
      primaryLight: settings['primary_light'] || null,
      accent: settings['accent_color'] || null,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Theme fetch failed', 500);
  }
}
