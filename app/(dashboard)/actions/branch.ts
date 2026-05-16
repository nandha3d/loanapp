'use server';

import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';

export async function switchActiveBranch(branchId: string) {
  const session = await auth();
  const user = session?.user as any;

  if (!user || user.role !== 'superadmin') {
    return { success: false, error: 'Only superadmins can switch branches' };
  }

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      tenantId: user.tenantId,
      superadminId: user.id,
      status: 'active',
    },
    select: { id: true, name: true },
  });

  if (!branch) {
    return { success: false, error: 'Branch not found or access denied' };
  }

  const cookieStore = await cookies();
  cookieStore.set('active_branch_id', branchId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return { success: true, data: { branchId, branchName: branch.name } };
}
