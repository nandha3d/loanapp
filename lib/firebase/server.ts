import 'server-only';
import fs from 'fs';
import path from 'path';
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function loadServiceAccount(): ServiceAccount | null {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  try {
    if (b64) {
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as ServiceAccount;
    }
    if (raw) {
      return JSON.parse(raw) as ServiceAccount;
    }
    if (filePath && fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ServiceAccount;
    }
    const defaultFile = path.join(process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(defaultFile)) {
      return JSON.parse(fs.readFileSync(defaultFile, 'utf8')) as ServiceAccount;
    }
  } catch (err) {
    console.error('[firebase-admin] invalid service account config', err);
  }
  return null;
}

function ensureFirebaseAdmin(): boolean {
  if (getApps().length > 0) return true;
  const sa = loadServiceAccount();
  if (!sa) return false;
  try {
    initializeApp({ credential: cert(sa) });
    return true;
  } catch (err) {
    if (getApps().length > 0) return true;
    console.error('[firebase-admin] initializeApp failed', err);
    return false;
  }
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      fs.existsSync(path.join(process.cwd(), 'firebase-service-account.json')),
  );
}

export interface FirebaseVerifiedIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  provider: string;
}

/**
 * Verifies a Firebase client ID Token using firebase-admin Auth (signature,
 * audience, expiry). Never accepts an unverified email/token.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<FirebaseVerifiedIdentity | null> {
  if (!idToken || !ensureFirebaseAdmin()) return null;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    if (!decoded.email) return null;
    const provider =
      String(decoded.firebase?.sign_in_provider || 'google.com');
    return {
      uid: decoded.uid,
      email: decoded.email.trim().toLowerCase(),
      emailVerified: Boolean(decoded.email_verified),
      name: typeof decoded.name === 'string' && decoded.name.trim() ? decoded.name.trim() : null,
      provider,
    };
  } catch (err) {
    console.error('[firebase-admin] verifyIdToken failed', err);
    return null;
  }
}
