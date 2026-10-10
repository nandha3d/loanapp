'use server';

import { auth } from '@/lib/auth';
import { updateEnquiryStatus, deleteEnquiry } from '@/lib/enquiries';
import { revalidatePath } from 'next/cache';

export async function changeEnquiryStatus(formDataOrId: FormData | string, maybeStatus?: string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') {
    throw new Error('Unauthorized');
  }

  let id: string;
  let status: string;
  if (typeof formDataOrId === 'string') {
    id = formDataOrId;
    status = maybeStatus || '';
  } else {
    id = formDataOrId.get('id') as string;
    status = formDataOrId.get('status') as string;
  }

  if (!id || !status) return;

  await updateEnquiryStatus(id, status);
  revalidatePath('/admin/enquiries');
}

export async function deleteEnquiryAction(formDataOrId: FormData | string) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') {
    throw new Error('Unauthorized');
  }

  let id: string;
  if (typeof formDataOrId === 'string') {
    id = formDataOrId;
  } else {
    id = formDataOrId.get('id') as string;
  }
  if (!id) return;

  await deleteEnquiry(id);
  revalidatePath('/admin/enquiries');
}
