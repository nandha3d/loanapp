'use server';

import { revalidatePath } from 'next/cache';
import { requireApiContext, AUTHENTICATED_API_ROLES, isApiError } from '@/lib/apiAuth';
import { reconcileSelfPayToken, rejectSelfPayToken } from '@/lib/selfPay';

/** Staff one-tap confirm of a claimed self-pay → posts the collection. */
export async function confirmSelfPayAction(token: string) {
  const res = await requireApiContext(AUTHENTICATED_API_ROLES);
  if (isApiError(res)) return { success: false, error: 'Unauthorized' };
  try {
    const result = await reconcileSelfPayToken({ token, agentId: res.context.userId });
    if (result.status === 'invalid') return { success: false, error: 'Invalid token' };
    revalidatePath('/collection/self-pay');
    revalidatePath('/dashboard');
    return { success: true, status: result.status };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Confirm failed' };
  }
}

/** Staff reject of a claimed self-pay (money never arrived). */
export async function rejectSelfPayAction(token: string) {
  const res = await requireApiContext(AUTHENTICATED_API_ROLES);
  if (isApiError(res)) return { success: false, error: 'Unauthorized' };
  try {
    const result = await rejectSelfPayToken(token);
    revalidatePath('/collection/self-pay');
    return { success: true, status: result.status };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Reject failed' };
  }
}
