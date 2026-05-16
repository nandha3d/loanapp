import { getActiveModules } from './branch';
import type { ModuleKey } from '@/types/modules';

export async function assertModuleEnabled(module: ModuleKey): Promise<void> {
  const modules = await getActiveModules();
  if (!modules.includes(module)) {
    throw new Error(`Module '${module}' is not enabled for this branch`);
  }
}

export async function isModuleEnabled(module: ModuleKey): Promise<boolean> {
  const modules = await getActiveModules();
  return modules.includes(module);
}

export async function getEnabledModules(_tenantId?: string): Promise<ModuleKey[]> {
  return getActiveModules();
}

export async function requireModule(_tenantId: string, module: ModuleKey): Promise<void> {
  return assertModuleEnabled(module);
}
