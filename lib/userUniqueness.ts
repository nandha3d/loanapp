import 'server-only';
import prisma from '@/lib/db';

export type UserUniqueField = 'username' | 'phone' | 'email';

export type UserUniqueConflict = {
  field: UserUniqueField;
  value: string;
  message: string;
};

const LABELS: Record<UserUniqueField, string> = {
  username: 'Username',
  phone: 'Phone number',
  email: 'Email address',
};

export function normalizeUserUniqueValue(field: UserUniqueField, value: unknown): string {
  const text = String(value ?? '').trim();
  if (field === 'username' || field === 'email') return text.toLowerCase();
  return text;
}

export async function isUserFieldAvailable(
  field: UserUniqueField,
  value: unknown,
  excludeUserId?: string | null,
): Promise<boolean> {
  const normalized = normalizeUserUniqueValue(field, value);
  if (!normalized) return true;

  const existing = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      [field]: normalized,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  return !existing;
}

export async function findUserUniqueConflicts(
  fields: Partial<Record<UserUniqueField, unknown>>,
  excludeUserId?: string | null,
): Promise<UserUniqueConflict[]> {
  const checks = (Object.entries(fields) as Array<[UserUniqueField, unknown]>)
    .map(([field, value]) => [field, normalizeUserUniqueValue(field, value)] as const)
    .filter(([, value]) => value);

  const conflicts: UserUniqueConflict[] = [];
  for (const [field, value] of checks) {
    if (!(await isUserFieldAvailable(field, value, excludeUserId))) {
      conflicts.push({
        field,
        value,
        message: `${LABELS[field]} is already in use.`,
      });
    }
  }

  return conflicts;
}
