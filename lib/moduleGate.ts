import prisma from '@/lib/db';
import { normalizeEnabledModules } from './subscription';

const DEFAULT_MODULES = ['microlending'];

export async function getEnabledModules(tenantId: string): Promise<string[]> {
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  return normalizeEnabledModules(sub?.enabledModules);
}

export async function requireModule(tenantId: string, module: string): Promise<void> {
  const enabled = await getEnabledModules(tenantId);
  if (!enabled.includes(module)) {
    throw new Error(`The "${module}" module is not enabled on your subscription. Please upgrade your plan.`);
  }
}
