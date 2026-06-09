import 'server-only';
import prisma from '../../db';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Server-side FCM push dispatcher. Sends to app users' registered devices
// (DeviceToken). Credentials come from a Firebase service account in env:
//   FIREBASE_SERVICE_ACCOUNT_BASE64  (base64 of the service-account JSON)  — preferred
//   FIREBASE_SERVICE_ACCOUNT         (raw JSON)                            — alt
// If neither is set, push is a no-op (other channels keep working).

function loadServiceAccount(): any | null {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  try {
    if (b64) return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[push] invalid FIREBASE_SERVICE_ACCOUNT env', e);
  }
  return null;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT);
}

let triedInit = false;
function ensureApp(): boolean {
  if (getApps().length) return true;
  if (triedInit) return getApps().length > 0;
  triedInit = true;
  const sa = loadServiceAccount();
  if (!sa) {
    console.warn('[push] no Firebase service account — push disabled');
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

  const data: Record<string, string> = { ...(payload.data || {}) };
  if (payload.link) data.link = payload.link;

  const messaging = getMessaging();
  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: payload.title, body: payload.body },
        data,
        android: { priority: 'high', notification: { sound: 'default' } },
      });
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
