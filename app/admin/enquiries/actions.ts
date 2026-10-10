'use server';

import { auth } from '@/lib/auth';
import { updateEnquiryStatus, deleteEnquiry } from '@/lib/enquiries';
import { revalidatePath } from 'next/cache';

export async function changeEnquiryStatus(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') {
    throw new Error('Unauthorized');
  }

  const id = formData.get('id') as string;
  const status = formData.get('status') as string;

  if (!id || !status) return;

  await updateEnquiryStatus(id, status);
  revalidatePath('/admin/enquiries');
}

export async function deleteEnquiryAction(formData: FormData) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') {
    throw new Error('Unauthorized');
  }

  const id = formData.get('id') as string;
  if (!id) return;

  await deleteEnquiry(id);
  revalidatePath('/admin/enquiries');
}
