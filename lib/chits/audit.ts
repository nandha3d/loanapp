export async function createChitAudit(tx: any, input: {
  tenantId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  return tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId || undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue == null ? undefined : JSON.stringify(input.oldValue),
      newValue: input.newValue == null ? undefined : JSON.stringify(input.newValue),
    },
  });
}
