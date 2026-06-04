import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

type ApiSession = {
  apiToken?: string;
} | null;

export async function GET() {
  const session = await auth() as ApiSession;

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = session?.apiToken;

  if (!token) {
    return NextResponse.json(
      { error: 'No API token available. Please sign in again.' },
      { status: 401 },
    );
  }

  // Never expose the full session — return only what the client needs
  return NextResponse.json(
    { token },
    {
      headers: {
        // Prevent this response from being cached anywhere
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}

// Block all other methods explicitly
function methodNotAllowed() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST() { return methodNotAllowed(); }
export async function PUT() { return methodNotAllowed(); }
export async function PATCH() { return methodNotAllowed(); }
export async function DELETE() { return methodNotAllowed(); }
