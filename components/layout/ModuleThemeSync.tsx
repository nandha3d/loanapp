'use client';

import { useEffect } from 'react';

type ModuleThemeSyncProps = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
};

const SYNCED_VARS = [
  '--primary',
  '--primary-dark',
  '--primary-light',
  '--primary-border',
  '--primary-tint',
  '--primary-glow',
  '--accent',
] as const;

/**
 * Mirrors the active module/tenant CSS theme variables onto `document.body` so
 * portaled UI elements (`createPortal(..., document.body)` — modals, dropdowns,
 * tooltips, topbar pickers) inherit the module theme instead of `:root` purple.
 */
export default function ModuleThemeSync({
  primary,
  primaryDark,
  primaryLight,
  accent,
}: ModuleThemeSyncProps) {
  useEffect(() => {
    const bodyStyle = document.body.style;
    const prev = new Map<string, string>();
    for (const key of SYNCED_VARS) {
      prev.set(key, bodyStyle.getPropertyValue(key));
    }

    bodyStyle.setProperty('--primary', primary);
    bodyStyle.setProperty('--primary-dark', primaryDark);
    bodyStyle.setProperty('--primary-light', primaryLight);
    bodyStyle.setProperty('--primary-border', `color-mix(in srgb, ${primary} 28%, #ffffff)`);
    bodyStyle.setProperty('--primary-tint', `color-mix(in srgb, ${primary} 12%, #ffffff)`);
    bodyStyle.setProperty('--primary-glow', `color-mix(in srgb, ${primary} 28%, transparent)`);
    bodyStyle.setProperty('--accent', accent);

    return () => {
      for (const key of SYNCED_VARS) {
        const oldVal = prev.get(key);
        if (oldVal) {
          bodyStyle.setProperty(key, oldVal);
        } else {
          bodyStyle.removeProperty(key);
        }
      }
    };
  }, [primary, primaryDark, primaryLight, accent]);

  return null;
}
