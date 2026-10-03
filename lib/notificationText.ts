/**
 * Renders a SystemNotification in the viewer's language.
 *
 * Staff alerts ship an i18n key (`notif.staff.<event>.<title|msg>`) plus
 * `params` the server has already formatted (money, counts — STABLE-8). The web
 * dictionary stores them flat as `notifications.staff_<event>_<title|msg>`.
 * A missing key/locale, or a legacy row without a key, falls back to the stored
 * English text, so nothing changes for rows that predate it.
 */
export function renderNotificationText(
  dict: any,
  key: string | null | undefined,
  fallback: string | null | undefined,
  params: string | Record<string, string> | null | undefined,
): string {
  const fb = fallback ?? '';
  if (!key) return fb;
  const webKey = 'staff_' + key.replace(/^notif\.staff\./, '').replace(/\./g, '_');
  let text: string | undefined = dict?.notifications?.[webKey];
  if (typeof text !== 'string') return fb;

  let p: Record<string, string> | null = null;
  if (typeof params === 'string') {
    try { p = JSON.parse(params); } catch { p = null; }
  } else if (params) {
    p = params;
  }
  if (p) for (const [k, v] of Object.entries(p)) text = text.split(`{${k}}`).join(String(v ?? ''));
  return text;
}
