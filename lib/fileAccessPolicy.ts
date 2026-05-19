export function isTenantFileAccessAllowed(input: {
  role: string | null | undefined;
  requestedTenantId: string;
  sessionTenantId: string;
}): boolean {
  return ['superadmin', 'developer'].includes(input.role || '')
    || input.requestedTenantId === input.sessionTenantId;
}
