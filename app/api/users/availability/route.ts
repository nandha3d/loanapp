import { NextRequest, NextResponse } from 'next/server';
import { findUserUniqueConflicts, normalizeUserUniqueValue, type UserUniqueField } from '@/lib/userUniqueness';

const FIELDS: UserUniqueField[] = ['username', 'phone', 'email'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const excludeUserId = searchParams.get('excludeUserId') || null;
  const values: Partial<Record<UserUniqueField, string>> = {};

  for (const field of FIELDS) {
    const value = searchParams.get(field);
    if (value) values[field] = value;
  }

  const conflicts = await findUserUniqueConflicts(values, excludeUserId);
  const conflictMap = new Map(conflicts.map((conflict) => [conflict.field, conflict]));

  return NextResponse.json({
    success: true,
    fields: Object.fromEntries(
      FIELDS.map((field) => {
        const raw = values[field] ?? '';
        const conflict = conflictMap.get(field);
        return [
          field,
          {
            value: normalizeUserUniqueValue(field, raw),
            checked: Boolean(raw),
            available: !conflict,
            message: conflict?.message ?? null,
          },
        ];
      }),
    ),
  });
}
