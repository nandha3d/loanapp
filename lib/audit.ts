import prisma from '@/lib/db';

// SEC-11: audit log PII redaction.
// Any key matching these patterns is replaced with '[REDACTED]' before write.
const PII_KEY_RE = /aadhar|aadhaar|pan|password|passwordHash|totpSecret|otp|cvv|cardNumber|secret/i;

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEY_RE.test(k)) {
      out[k] = v == null ? null : '[REDACTED]';
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

export function redactPii<T>(input: T): T {
  return redact(input) as T;
}

export interface AuditEntry {
  tenantId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Write audit log with auto-redaction of PII fields. */
export async function writeAudit(e: AuditEntry) {
  await prisma.auditLog.create({
    data: {
      tenantId: e.tenantId,
      userId: e.userId ?? null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId ?? null,
      oldValue: e.oldValue == null ? null : JSON.stringify(redactPii(e.oldValue)),
      newValue: e.newValue == null ? null : JSON.stringify(redactPii(e.newValue)),
      ipAddress: e.ipAddress ?? null,
      userAgent: e.userAgent ?? null,
    },
  });
}
