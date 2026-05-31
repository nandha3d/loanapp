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
    const modules = await prisma.modulePriceCatalog.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    return NextResponse.json({ success: true, modules });
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
      module,
      displayName,
      description,
      monthlyPrice,
      isActive = true,
      sortOrder = 0
    } = body;

    if (!module || !displayName || monthlyPrice === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const moduleData = {
      module,
      displayName,
      description,
      monthlyPrice: Number(monthlyPrice),
      isActive: Boolean(isActive),
      sortOrder: Number(sortOrder)
    };

    if (id) {
      const updated = await prisma.modulePriceCatalog.update({
        where: { id },
        data: moduleData
      });
      return NextResponse.json({ success: true, module: updated });
    } else {
      const created = await prisma.modulePriceCatalog.create({
        data: moduleData
      });
      return NextResponse.json({ success: true, module: created });
    }
  } catch (err: any) {
    console.error('[DEV_MODULES_POST_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save module pricing' },
      { status: err.message === 'Unauthorized' ? 403 : 500 }
    );
  }
}
