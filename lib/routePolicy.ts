export function getRouteDeletionBlockReason(input: { activeCustomerCount: number }): string | null {
  return input.activeCustomerCount > 0 ? 'Cannot delete route with active customers.' : null;
}
