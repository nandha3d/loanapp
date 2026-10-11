'use server';

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { DELETION_STATUSES, type DeletionStatus, updateDeletionRequestStatus } from '@/lib/deletionRequests';

export async function changeDeletionRequestStatus(id: string, status: string, adminNote?: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') {
    throw new Error('Unauthorized');
  }
  if (!id || !DELETION_STATUSES.includes(status as DeletionStatus)) return;

  await updateDeletionRequestStatus(id, status as DeletionStatus, adminNote);
  revalidatePath('/admin/deletion-requests');
}
