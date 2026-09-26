import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { getRouteDeletionBlockReason } from '@/lib/routePolicy';

export type RouteActor = {
  tenantId: string;
  appType: string;
  branchId: string | null;
  userId: string;
  role: string;
};

export class RouteError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function requireManager(actor: RouteActor) {
  if (!['admin', 'superadmin', 'developer'].includes(actor.role)) throw new RouteError('Forbidden', 403);
}

export function routeWhere(actor: RouteActor, id?: string): Prisma.RouteWhereInput {
  return {
    ...(id ? { id } : {}),
    tenantId: actor.tenantId,
    appType: actor.appType,
    ...(actor.role === 'agent'
      ? { OR: [
          { assignedAgentId: actor.userId },
          { routeAgents: { some: { agentId: actor.userId } } },
        ] }
      : actor.branchId ? { branchId: actor.branchId } : {}),
  };
}

export async function listManagedRoutes(actor: RouteActor) {
  return prisma.route.findMany({
    where: routeWhere(actor),
    include: {
      assignedAgent: { select: { id: true, name: true, phone: true } },
      routeAgents: { include: { agent: { select: { id: true, name: true } } } },
      _count: { select: { customers: true } },
    },
    orderBy: { name: 'asc' },
  });
}

async function writeBranchId(tx: Prisma.TransactionClient, actor: RouteActor) {
  if (actor.branchId) {
    const branch = await tx.branch.findFirst({
      where: { id: actor.branchId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!branch) throw new RouteError('Branch not found', 404);
    return branch.id;
  }
  const branches = await tx.branch.findMany({
    where: { tenantId: actor.tenantId },
    select: { id: true },
    take: 2,
  });
  if (branches.length !== 1) throw new RouteError('Select a branch', 400);
  return branches[0].id;
}

async function requireRoute(tx: Prisma.TransactionClient, actor: RouteActor, id: string) {
  const route = await tx.route.findFirst({ where: routeWhere(actor, id) });
  if (!route) throw new RouteError('Route not found', 404);
  return route;
}

async function requireAgent(tx: Prisma.TransactionClient, actor: RouteActor, agentId: string, branchId: string) {
  const agent = await tx.user.findFirst({
    where: {
      id: agentId,
      tenantId: actor.tenantId,
      appType: actor.appType,
      branchId,
      role: 'agent',
      status: 'active',
    },
    select: { id: true },
  });
  if (!agent) throw new RouteError('Agent not found in route branch', 404);
}

async function audit(tx: Prisma.TransactionClient, actor: RouteActor, routeId: string, action: string, details?: object) {
  await tx.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      userId: actor.userId,
      action,
      entityType: 'route',
      entityId: routeId,
      newValue: details ? JSON.stringify(details) : undefined,
    },
  });
}

export async function createManagedRoute(actor: RouteActor, input: {
  name: string;
  primaryAgentId?: string | null;
  sharedAgentIds?: string[];
}) {
  requireManager(actor);
  const name = input.name.trim();
  if (!name) throw new RouteError('Route name required', 400);
  return prisma.$transaction(async (tx) => {
    const branchId = await writeBranchId(tx, actor);
    const primaryAgentId = input.primaryAgentId || null;
    const sharedAgentIds = [...new Set(input.sharedAgentIds ?? [])].filter(id => id !== primaryAgentId);
    for (const agentId of [primaryAgentId, ...sharedAgentIds]) {
      if (agentId) await requireAgent(tx, actor, agentId, branchId);
    }
    const route = await tx.route.create({
      data: {
        tenantId: actor.tenantId,
        appType: actor.appType,
        branchId,
        name,
        status: 'active',
        assignedAgentId: primaryAgentId,
        routeAgents: { create: sharedAgentIds.map(agentId => ({ agentId })) },
      },
    });
    await audit(tx, actor, route.id, 'create', { name, primaryAgentId, sharedAgentIds });
    return route;
  });
}

export async function updateManagedRoute(actor: RouteActor, id: string, name: string) {
  requireManager(actor);
  const trimmed = name.trim();
  if (!trimmed) throw new RouteError('Route name required', 400);
  return prisma.$transaction(async (tx) => {
    await requireRoute(tx, actor, id);
    const route = await tx.route.update({ where: { id }, data: { name: trimmed } });
    await audit(tx, actor, id, 'update', { name: trimmed });
    return route;
  });
}

export async function deleteManagedRoute(actor: RouteActor, id: string) {
  requireManager(actor);
  return prisma.$transaction(async (tx) => {
    await requireRoute(tx, actor, id);
    const activeCustomerCount = await tx.customer.count({
      where: { routeId: id, tenantId: actor.tenantId, appType: actor.appType, status: 'active' },
    });
    const reason = getRouteDeletionBlockReason({ activeCustomerCount });
    if (reason) throw new RouteError(reason, 409);
    await audit(tx, actor, id, 'delete');
    await tx.route.delete({ where: { id } });
  });
}

export async function assignManagedRouteAgent(actor: RouteActor, id: string, agentId: string) {
  requireManager(actor);
  return prisma.$transaction(async (tx) => {
    const route = await requireRoute(tx, actor, id);
    if (!route.branchId) throw new RouteError('Route has no branch', 409);
    await requireAgent(tx, actor, agentId, route.branchId);
    await tx.routeAgent.upsert({
      where: { routeId_agentId: { routeId: id, agentId } },
      create: { routeId: id, agentId },
      update: {},
    });
    await audit(tx, actor, id, 'assign_agent', { agentId });
  });
}

export async function removeManagedRouteAgent(actor: RouteActor, id: string, agentId: string) {
  requireManager(actor);
  return prisma.$transaction(async (tx) => {
    await requireRoute(tx, actor, id);
    const removed = await tx.routeAgent.deleteMany({ where: { routeId: id, agentId } });
    if (removed.count) await audit(tx, actor, id, 'remove_agent', { agentId });
  });
}

export async function setManagedPrimaryAgent(actor: RouteActor, id: string, agentId: string | null) {
  requireManager(actor);
  return prisma.$transaction(async (tx) => {
    const route = await requireRoute(tx, actor, id);
    if (agentId) {
      if (!route.branchId) throw new RouteError('Route has no branch', 409);
      await requireAgent(tx, actor, agentId, route.branchId);
    }
    await tx.route.update({ where: { id }, data: { assignedAgentId: agentId } });
    await audit(tx, actor, id, 'set_primary_agent', { agentId });
  });
}
