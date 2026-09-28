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

function loadServiceAccount(): any | null {
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
    select: { token: true },
  });
  await sendToTokens(rows.map((r) => r.token), payload);
}

async function sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
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

  const messaging = getMessaging();
  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500);
    const imgUrl = payload.data?.imageUrl || payload.data?.logoUrl || payload.data?.avatarUrl || undefined;
    const notifObj: { title: string; body: string; imageUrl?: string } = {
      title: payload.title,
      body: payload.body,
    };
    if (imgUrl) notifObj.imageUrl = imgUrl;

    try {
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: notifObj,
        data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            icon: 'ic_notification',
            color: '#7D287E',
            imageUrl: imgUrl,
            channelId:
              data?.type?.includes('approval') || data?.type === 'float_insufficient'
                ? 'approvals_channel'
                : 'general_channel',
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
