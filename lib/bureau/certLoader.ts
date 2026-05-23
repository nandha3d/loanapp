import https from 'https';
import { decryptField } from '@/lib/pii';

const agentCache = new Map<string, https.Agent>();

/**
 * Creates or retrieves an existing https.Agent with dynamic TLS client certificate credentials.
 * Decrypts PEM certificates directly in-memory to prevent file system leaks.
 * Cached in-memory since PM2 is running Node.js persistently.
 */
export function getOrCreateAgent(tenantId: string, encCert: string, encKey: string): https.Agent {
  if (agentCache.has(tenantId)) {
    return agentCache.get(tenantId)!;
  }

  const decryptedCert = decryptField(encCert);
  const decryptedKey = decryptField(encKey);

  if (!decryptedCert || !decryptedKey) {
    throw new Error('FAILED_TO_DECRYPT_CERT: Invalid or corrupted client credentials.');
  }

  const agent = new https.Agent({
    cert: Buffer.from(decryptedCert, 'utf-8'),
    key: Buffer.from(decryptedKey, 'utf-8'),
    rejectUnauthorized: true,
    keepAlive: true,
    maxSockets: 10,
  });

  agentCache.set(tenantId, agent);
  return agent;
}

// Flush cache on PM2 graceful reloads or process termination
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => agentCache.clear());
  process.on('SIGTERM', () => agentCache.clear());
}
