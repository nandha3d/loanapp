import prisma from '@/lib/db';

/**
 * Returns the list of route IDs that an agent is assigned to,
 * either as a primary agent (Route.assignedAgentId) or via the
 * RouteAgent many-to-many shared route table.
 */
export async function getAgentRouteIds(agentId: string): Promise<string[]> {
  const [primaryRoutes, sharedRoutes] = await Promise.all([
    // Routes where this agent is the primary assigned agent
    prisma.route.findMany({
      where: { assignedAgentId: agentId, status: 'active' },
      select: { id: true },
    }),
    // Routes assigned via RouteAgent (shared/multi-agent routes)
    prisma.routeAgent.findMany({
      where: { agentId },
      select: { routeId: true },
    }),
  ]);

  const ids = new Set<string>();
  primaryRoutes.forEach(r => ids.add(r.id));
  sharedRoutes.forEach(r => ids.add(r.routeId));
  return Array.from(ids);
}
