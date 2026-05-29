import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireDeveloper() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function GET() {
  try {
    await requireDeveloper();
    const addons = await prisma.addonCatalog.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    return NextResponse.json({ success: true, addons });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unauthorized' },
      { status: err.message === 'Unauthorized' ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireDeveloper();
    const body = await request.json();
    const {
      id,
      addon,
      displayName,
      description,
      monthlyPrice,
      isActive = true,
      sortOrder = 0
    } = body;

    if (!addon || !displayName || monthlyPrice === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const addonData = {
      addon,
      displayName,
      description,
      monthlyPrice: Number(monthlyPrice),
      isActive: Boolean(isActive),
      sortOrder: Number(sortOrder)
    };

    if (id) {
      const updated = await prisma.addonCatalog.update({
        where: { id },
        data: addonData
      });
      return NextResponse.json({ success: true, addon: updated });
    } else {
      const created = await prisma.addonCatalog.create({
        data: addonData
      });
      return NextResponse.json({ success: true, addon: created });
    }
  } catch (err: any) {
    console.error('[DEV_ADDONS_POST_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save addon pricing' },
      { status: err.message === 'Unauthorized' ? 403 : 500 }
    );
  }
}
