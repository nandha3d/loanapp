import prisma from '@/lib/db';

/**
 * Approval requests store the filer's raw field changes (`requestedChanges`),
 * which for customer profile/GPS edits include foreign keys — `routeId`,
 * `agentId`, `branchId` — as cuids. Reviewers cannot read those, so the server
 * resolves each to the record's display name and ships it beside the request as
 * `changeLabels`. Clients only render it (STABLE-8); `requestedChanges` itself is
 * untouched because approval applies it verbatim.
 */
const LABELLED_KEYS = ['routeId', 'agentId', 'branchId'] as const;

type Row = { requestedChanges?: unknown };

function parseChanges(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const idsOf = (all: Record<string, unknown>[], key: string): string[] =>
  Array.from(new Set(all.map((c) => c[key]).filter((v): v is string => typeof v === 'string' && v !== '')));

/** Returns the rows with `changeLabels` (key → display name) added. Unresolved ids are simply left out. */
export async function attachChangeLabels<T extends Row>(
  tenantId: string,
  rows: T[],
): Promise<(T & { changeLabels: Record<string, string> })[]> {
  const parsed = rows.map((r) => parseChanges(r.requestedChanges));
  const routeIds = idsOf(parsed, 'routeId');
  const userIds = idsOf(parsed, 'agentId');
  const branchIds = idsOf(parsed, 'branchId');

  const [routes, users, branches] = await Promise.all([
    routeIds.length ? prisma.route.findMany({ where: { tenantId, id: { in: routeIds } }, select: { id: true, name: true } }) : [],
    userIds.length ? prisma.user.findMany({ where: { tenantId, id: { in: userIds } }, select: { id: true, name: true } }) : [],
    branchIds.length ? prisma.branch.findMany({ where: { tenantId, id: { in: branchIds } }, select: { id: true, name: true } }) : [],
  ]);
  const names: Record<(typeof LABELLED_KEYS)[number], Map<string, string>> = {
    routeId: new Map(routes.map((x) => [x.id, x.name])),
    agentId: new Map(users.map((x) => [x.id, x.name])),
    branchId: new Map(branches.map((x) => [x.id, x.name])),
  };

  return rows.map((row, i) => {
    const changeLabels: Record<string, string> = {};
    for (const key of LABELLED_KEYS) {
      const value = parsed[i][key];
      const name = typeof value === 'string' ? names[key].get(value) : undefined;
      if (name) changeLabels[key] = name;
    }
    return { ...row, changeLabels };
  });
}
