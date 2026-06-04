'use server';

import { revalidatePath } from 'next/cache';
import { requireApiContext, AUTHENTICATED_API_ROLES, isApiError } from '@/lib/apiAuth';
import { getAgentRouteIds } from '@/lib/access';
import {
  openRun,
  collectRunLines,
  closeRun,
  reconcileRun,
  type RunActor,
  type RunCollectLine,
} from '@/lib/collectionRun';
import { createSelfPayLink } from '@/lib/selfPay';

async function actorOrError(): Promise<RunActor | { error: string }> {
  const res = await requireApiContext(AUTHENTICATED_API_ROLES);
  if (isApiError(res)) return { error: 'Unauthorized' };
  const c = res.context;
  return {
    tenantId: c.tenantId,
    appType: c.appType,
    agentId: c.userId,
    branchId: c.branchId,
    role: c.role,
    userId: c.userId,
  };
}

export async function startRunAction(routeId: string, lat?: number, lng?: number) {
  const actor = await actorOrError();
  if ('error' in actor) return { success: false, error: actor.error };
  if (actor.role === 'agent') {
    const routeIds = await getAgentRouteIds(actor.userId);
    if (!routeIds.includes(routeId)) return { success: false, error: 'Route not assigned to you' };
  }
  try {
    const run = await openRun(actor, { routeId, lat, lng });
    revalidatePath('/collection/runs');
    return { success: true, runId: run.id };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to open run' };
  }
}

export async function collectRunAction(runId: string, lines: RunCollectLine[]) {
  const actor = await actorOrError();
  if ('error' in actor) return { success: false, error: actor.error };
  try {
    const result = await collectRunLines(actor, runId, lines);
    revalidatePath(`/collection/runs/${runId}`);
    revalidatePath('/collection/runs');
    revalidatePath('/dashboard');
    return { success: true, ...result };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Collection failed' };
  }
}

export async function closeRunAction(runId: string) {
  const actor = await actorOrError();
  if ('error' in actor) return { success: false, error: actor.error };
  try {
    await closeRun(actor, runId);
    revalidatePath(`/collection/runs/${runId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to close run' };
  }
}

export async function reconcileRunAction(
  runId: string,
  cashDeposited: number,
  depositRef?: string,
  note?: string,
) {
  const actor = await actorOrError();
  if ('error' in actor) return { success: false, error: actor.error };
  try {
    const run = await reconcileRun(actor, runId, { cashDeposited, depositRef, note });
    revalidatePath(`/collection/runs/${runId}`);
    return { success: true, variance: Number(run.varianceAmount ?? 0) };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Reconcile failed' };
  }
}

export async function createSelfPayLinkAction(instalmentId: string, amount?: number) {
  const actor = await actorOrError();
  if ('error' in actor) return { success: false, error: actor.error };
  try {
    const link = await createSelfPayLink({ tenantId: actor.tenantId, instalmentId, amount });
    revalidatePath('/collection');
    return { success: true, link };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to create link' };
  }
}
