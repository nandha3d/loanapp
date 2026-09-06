import { normalizeModuleList, type ModuleKey } from '@/types/modules';

export type AgentBranchResolutionInput = {
  actorRole?: string | null;
  activeBranchId?: string | null;
  requestedBranchId?: string | null;
};

export type AgentBranchResolution =
  | { ok: true; branchId: string }
  | { ok: false; error: string };

export function resolveAgentTargetBranchId({
  actorRole,
  activeBranchId,
  requestedBranchId,
}: AgentBranchResolutionInput): AgentBranchResolution {
  const branchId = actorRole === 'developer' ? requestedBranchId : activeBranchId;
  if (!branchId) {
    return {
      ok: false,
      error: 'Select a branch before saving an agent.',
    };
  }
  return { ok: true, branchId };
}

export type AgentModuleValidation =
  | { ok: true; modules: ModuleKey[] }
  | { ok: false; error: string };

export function validateAgentModuleSelection(
  requestedModules: unknown,
  branchModules: unknown,
): AgentModuleValidation {
  const modules = normalizeModuleList(requestedModules);
  if (modules.length === 0) {
    return {
      ok: false,
      error: 'Select at least one module before saving an agent.',
    };
  }

  const allowedModules = normalizeModuleList(branchModules);
  if (allowedModules.length === 0) {
    return {
      ok: false,
      error: 'The selected branch has no enabled modules.',
    };
  }

  const invalid = modules.filter((module) => !allowedModules.includes(module));
  if (invalid.length > 0) {
    return {
      ok: false,
      error: `Modules not enabled for this branch: ${invalid.join(', ')}`,
    };
  }

  return { ok: true, modules };
}
