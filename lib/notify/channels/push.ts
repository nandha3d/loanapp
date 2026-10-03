import 'server-only';
import prisma from '../../db';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

import fs from 'fs';
import path from 'path';

// Server-side FCM push dispatcher. Sends to app users' registered devices
// (DeviceToken). Credentials come from a Firebase service account in env:
//   FIREBASE_SERVICE_ACCOUNT_BASE64  (base64 of the service-account JSON)  — preferred
//   FIREBASE_SERVICE_ACCOUNT         (raw JSON)                            — alt
//   FIREBASE_SERVICE_ACCOUNT_PATH    (path to service account JSON file)
//   GOOGLE_APPLICATION_CREDENTIALS   (standard Google env variable)
//   firebase-service-account.json    (root file fallback)
// If neither is set, push is a no-op (other channels keep working).

function loadServiceAccount(): Record<string, unknown> | null {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  try {
    if (b64) return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    if (raw) return JSON.parse(raw);
    if (filePath && fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    const defaultFile = path.join(process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(defaultFile)) {
      return JSON.parse(fs.readFileSync(defaultFile, 'utf8'));
    }
  } catch (e) {
    console.error('[push] invalid FIREBASE_SERVICE_ACCOUNT env or file', e);
  }
  return null;
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    fs.existsSync(path.join(process.cwd(), 'firebase-service-account.json'))
  );
}

let triedInit = false;
function ensureApp(): boolean {
  if (getApps().length) return true;
  if (triedInit) return getApps().length > 0;
  triedInit = true;
  const sa = loadServiceAccount();
  if (!sa) {
    console.warn('[push] no Firebase service account found — push notifications are disabled');
    return false;
  }
  try {
    initializeApp({ credential: cert(sa) });
    return true;
  } catch (e) {
    console.error('[push] firebase-admin init failed', e);
    return false;
  }
}

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  link?: string;
};

/** Push to every device registered to any of these app users. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length || !ensureApp()) return;
  const rows = await prisma.deviceToken.findMany({
    where: { userId: { in: ids } },
    select: { token: true, platform: true },
  });
  // Android is sent DATA-ONLY: with a `notification` block the OS draws the
  // notification itself while the app is closed — no logo, no Approve/Reject
  // buttons. Data-only wakes the app's background handler, which draws both.
  // iOS and web keep the `notification` block (they cannot draw either from data).
  const android = rows.filter((r) => (r.platform || 'android') === 'android').map((r) => r.token);
  const other = rows.filter((r) => (r.platform || 'android') !== 'android').map((r) => r.token);
  await sendToTokens(android, payload, true);
  await sendToTokens(other, payload, false);
}

/** FCM rejects a non-URL `imageUrl` with invalid-argument — and we prune on that. */
function validImageUrl(u: string | undefined): string | undefined {
  return u && /^https:\/\//i.test(u) ? u : undefined;
}

async function sendToTokens(tokens: string[], payload: PushPayload, androidDataOnly: boolean): Promise<void> {
  const unique = [...new Set(tokens)].filter(Boolean);
  if (!unique.length) return;

  const data: Record<string, string> = {};
  if (payload.data) {
    for (const [k, v] of Object.entries(payload.data)) {
      if (v != null) {
        data[k] = typeof v === 'string' ? v : String(v);
      }
    }
  }
  if (payload.title && !data.title) data.title = String(payload.title);
  if (payload.body && !data.body) data.body = String(payload.body);
  if (payload.body && !data.message) data.message = String(payload.body);
  if (payload.link && !data.link) data.link = String(payload.link);
  if (!data.largeIcon) data.largeIcon = 'app_logo';
  if (!data.icon) data.icon = 'ic_notification';
  if (!data.click_action) data.click_action = 'FLUTTER_NOTIFICATION_CLICK';

  // Only the server's explicit flag makes a push actionable (Approve/Reject
  // buttons). Matching on "approv" in the text also hit result notices such as
  // "Request approved", which agents cannot act on. `notifyApprovers` sets
  // `actionable` + `approvalId` for every real pending request.
  const isActionable = data.actionable === 'true';
  const isApproval = isActionable || Boolean(data?.type?.includes('approval'));

  if (isActionable && !data.approvalId && payload.link) {
    const m = payload.link.match(/[?&]id=([^&]+)/);
    if (m) data.approvalId = m[1];
  }

  const messaging = getMessaging();
  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500);
    const imgUrl = validImageUrl(payload.data?.imageUrl || payload.data?.logoUrl || payload.data?.avatarUrl);
    const notifObj: { title: string; body: string; imageUrl?: string } = {
      title: payload.title,
      body: payload.body,
    };
    if (imgUrl) notifObj.imageUrl = imgUrl;
    const channelId =
      isApproval || data?.type === 'float_insufficient' ? 'approvals_channel' : 'general_channel';

    try {
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        // Android: data-only (see sendPushToUsers). Everyone else: visible push.
        ...(androidDataOnly ? {} : { notification: notifObj }),
        data: androidDataOnly ? { ...data, channelId, ...(imgUrl ? { imageUrl: imgUrl } : {}) } : data,
        android: androidDataOnly
          ? { priority: 'high', ttl: 60 * 60 * 1000 }
          : {
              priority: 'high',
              notification: {
                sound: 'default',
                icon: 'ic_notification',
                color: '#7D287E',
                imageUrl: imgUrl,
                channelId,
                defaultSound: true,
                defaultVibrateTimings: true,
              },
            },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });
      console.log(`[push] FCM send result: ${res.successCount} succeeded, ${res.failureCount} failed out of ${batch.length} tokens`);
      // Prune tokens FCM reports as dead so the table stays clean.
      const dead: string[] = [];
      res.responses.forEach((r, idx) => {
        const code = r.success ? '' : (r.error?.code || '');
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token') ||
          code.includes('invalid-argument')
        ) {
          dead.push(batch[idx]);
        }
      });
      if (dead.length) {
        await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } }).catch(() => {});
      }
    } catch (e) {
      console.error('[push] sendEachForMulticast failed', e);
    }
  }
}
