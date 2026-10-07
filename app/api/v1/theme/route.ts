import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getTenantSettings, setSetting } from '@/lib/tenant';
import { THEME_PRESETS, THEME_SETTING_KEY, getThemePreset } from '@/lib/themes';

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
      // The choices the owner can pick from (Settings → Branding). Served so the
      // app never carries its own copy of the palette list.
      presets: THEME_PRESETS.map((p) => ({
        key: p.key,
        name: p.name,
        primary: p.primary,
        primaryDark: p.primaryDark,
        primaryLight: p.primaryLight,
        accent: p.accent,
      })),
      canEdit: ['superadmin', 'developer'].includes(ctx.role),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Theme fetch failed', 500);
  }
}

/**
 * POST /api/v1/theme  { preset }
 * Applies a preset to the tenant (same writes as the web Settings → Theme tab).
 * "default" restores the per-module colours.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['superadmin', 'developer'].includes(ctx.role)) {
    return fail('Only the account owner can change the theme', 403);
  }

  try {
    const body = await req.json();
    const presetKey = typeof body?.preset === 'string' ? body.preset : '';
    const preset = presetKey === 'default' ? null : getThemePreset(presetKey);
    if (presetKey !== 'default' && !preset) return fail('Unknown theme', 400);

    await Promise.all([
      setSetting(ctx.tenantId, THEME_SETTING_KEY, presetKey, 'branding'),
      setSetting(ctx.tenantId, 'primary_color', preset?.primary ?? '#F5A623', 'branding'),
      setSetting(ctx.tenantId, 'primary_dark', preset?.primaryDark ?? '#E8930C', 'branding'),
      setSetting(ctx.tenantId, 'primary_light', preset?.primaryLight ?? '#FFF3E0', 'branding'),
      setSetting(ctx.tenantId, 'accent_color', preset?.accent ?? '#FFC107', 'branding'),
    ]);

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'settings',
        newValue: JSON.stringify({ keys: [THEME_SETTING_KEY], preset: presetKey }),
      },
    });

    return ok({
      preset: presetKey,
      primary: preset?.primary ?? null,
      primaryDark: preset?.primaryDark ?? null,
      primaryLight: preset?.primaryLight ?? null,
      accent: preset?.accent ?? null,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Theme save failed', 500);
  }
}
