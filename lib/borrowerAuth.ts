import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

function getBorrowerJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET or AUTH_SECRET environment variable is required for the borrower portal.');
  if (secret.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
  return new TextEncoder().encode(secret);
}

export async function getBorrowerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('borrower_session')?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getBorrowerJwtSecret());
    return payload as {
      loanId: string;
      tenantId: string;
      customerId: string;
      role: string;
    };
  } catch {
    return null;
  }
}
