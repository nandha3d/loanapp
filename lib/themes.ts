// Tenant colour themes — 20 presets, each a 3-colour set (primary, dark,
// light) plus an accent. Picked by the superadmin in Settings → Theme and
// stored per-tenant in AppSetting (group "branding"):
//   theme_preset   → preset key ("default" = per-module colours)
//   primary_color / primary_dark / primary_light / accent_color → concrete hex
// The concrete colours are what the web layout and the mobile app consume, so
// neither needs this preset table to render — only the picker does.

export type ThemePreset = {
  key: string;
  name: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
};

export const THEME_SETTING_KEY = 'theme_preset';

// Grouped in 3 colour families (warm / cool / deep) — 20 variants total.
export const THEME_PRESETS: ThemePreset[] = [
  // ── Warm ──────────────────────────────────────────────────────────────
  { key: 'amber',    name: 'Amber',    primary: '#F5A623', primaryDark: '#E8930C', primaryLight: '#FFF3E0', accent: '#FFC107' },
  { key: 'orange',   name: 'Orange',   primary: '#E67E22', primaryDark: '#D35400', primaryLight: '#FFF3E6', accent: '#F39C12' },
  { key: 'sunset',   name: 'Sunset',   primary: '#FF7043', primaryDark: '#E64A19', primaryLight: '#FBE9E7', accent: '#FF8A65' },
  { key: 'crimson',  name: 'Crimson',  primary: '#E74C3C', primaryDark: '#C0392B', primaryLight: '#FDEDEC', accent: '#F1948A' },
  { key: 'rose',     name: 'Rose',     primary: '#E91E63', primaryDark: '#C2185B', primaryLight: '#FCE4EC', accent: '#F06292' },
  { key: 'gold',     name: 'Gold',     primary: '#B8860B', primaryDark: '#8B6914', primaryLight: '#FFF8E7', accent: '#DAA520' },
  { key: 'coffee',   name: 'Coffee',   primary: '#8D6E63', primaryDark: '#5D4037', primaryLight: '#EFEBE9', accent: '#A1887F' },
  // ── Cool ──────────────────────────────────────────────────────────────
  { key: 'blue',     name: 'Blue',     primary: '#2980B9', primaryDark: '#1A5276', primaryLight: '#EBF5FB', accent: '#3498DB' },
  { key: 'sky',      name: 'Sky',      primary: '#0EA5E9', primaryDark: '#0369A1', primaryLight: '#E0F2FE', accent: '#38BDF8' },
  { key: 'teal',     name: 'Teal',     primary: '#009688', primaryDark: '#00695C', primaryLight: '#E0F2F1', accent: '#26A69A' },
  { key: 'cyan',     name: 'Cyan',     primary: '#00ACC1', primaryDark: '#00838F', primaryLight: '#E0F7FA', accent: '#26C6DA' },
  { key: 'green',    name: 'Green',    primary: '#27AE60', primaryDark: '#1E8449', primaryLight: '#EAFAF1', accent: '#2ECC71' },
  { key: 'emerald',  name: 'Emerald',  primary: '#10B981', primaryDark: '#047857', primaryLight: '#D1FAE5', accent: '#34D399' },
  { key: 'forest',   name: 'Forest',   primary: '#2E7D32', primaryDark: '#1B5E20', primaryLight: '#E8F5E9', accent: '#66BB6A' },
  // ── Deep ──────────────────────────────────────────────────────────────
  { key: 'indigo',   name: 'Indigo',   primary: '#3F51B5', primaryDark: '#283593', primaryLight: '#E8EAF6', accent: '#5C6BC0' },
  { key: 'violet',   name: 'Violet',   primary: '#8B5CF6', primaryDark: '#6D28D9', primaryLight: '#F3E8FF', accent: '#A78BFA' },
  { key: 'purple',   name: 'Purple',   primary: '#9C27B0', primaryDark: '#6A1B9A', primaryLight: '#F3E5F5', accent: '#BA68C8' },
  { key: 'midnight', name: 'Midnight', primary: '#34495E', primaryDark: '#1A1A2E', primaryLight: '#EAEAFF', accent: '#5D6D7E' },
  { key: 'slate',    name: 'Slate',    primary: '#607D8B', primaryDark: '#37474F', primaryLight: '#ECEFF1', accent: '#90A4AE' },
  { key: 'graphite', name: 'Graphite', primary: '#424242', primaryDark: '#212121', primaryLight: '#F5F5F5', accent: '#757575' },
];

export function getThemePreset(key: string | null | undefined): ThemePreset | null {
  if (!key || key === 'default') return null;
  return THEME_PRESETS.find((t) => t.key === key) ?? null;
}
