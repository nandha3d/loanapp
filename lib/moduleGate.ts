import prisma from '@/lib/db';

const DEFAULT_MODULES = ['microlending'];

export async function getEnabledModules(tenantId: string): Promise<string[]> {
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  if (!sub?.enabledModules) return DEFAULT_MODULES;

  const modules = sub.enabledModules.split(',').map((module) => module.trim()).filter(Boolean);
  return modules.length > 0 ? modules : DEFAULT_MODULES;
}

export async function requireModule(tenantId: string, module: string): Promise<void> {
  const enabled = await getEnabledModules(tenantId);
  if (!enabled.includes(module)) {
    throw new Error(`The "${module}" module is not enabled on your subscription. Please upgrade your plan.`);
  }
}
