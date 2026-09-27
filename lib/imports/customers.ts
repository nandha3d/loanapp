import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db';
import { encryptAadharNumber } from '@/lib/pii';
import { getSetting } from '@/lib/tenant';

export type CustomerImportActor = {
  tenantId: string;
  appType: string;
  branchId: string | null;
  userId: string;
  role: string;
};

export class CustomerImportError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

type ImportRow = {
  customerCode?: unknown;
  name?: unknown;
  phone?: unknown;
  aadhaar?: unknown;
  aadharNumber?: unknown;
  pan?: unknown;
};

class CustomerImportRowError extends Error {}

function optionalText(value: unknown, field: string): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 191) {
    throw new CustomerImportRowError(`${field} must be text of at most 191 characters`);
  }
  return value.trim() || null;
}

export function validateCustomerImportRow(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CustomerImportRowError('Row must be an object');
  }
  const row = value as ImportRow;
  const name = optionalText(row.name, 'name');
  const phone = optionalText(row.phone, 'phone');
  if (!name) throw new CustomerImportRowError('name is required');
  if (!phone) throw new CustomerImportRowError('phone is required');
  const aadharNumber = optionalText(row.aadhaar ?? row.aadharNumber, 'aadhaar');
  if (aadharNumber && !/^\d{12}$/.test(aadharNumber)) throw new CustomerImportRowError('aadhaar must have 12 digits');
  return {
    customerCode: optionalText(row.customerCode, 'customerCode') ?? `CUST-${randomUUID()}`,
    name,
    phone,
    aadharNumber,
    pan: optionalText(row.pan, 'pan'),
  };
}

export function assertCustomerImportScope(actor: CustomerImportActor) {
  if (!['admin', 'superadmin', 'developer'].includes(actor.role)) {
    throw new CustomerImportError('Forbidden', 403);
  }
  if (!actor.branchId) {
    throw new CustomerImportError('Select an active branch before importing customers');
  }
}

export async function importCustomers(actor: CustomerImportActor, data: unknown) {
  assertCustomerImportScope(actor);
  if (!Array.isArray(data)) throw new CustomerImportError('Expected a JSON array');
  const configured = Number(await getSetting(actor.tenantId, 'customer_import_max_rows', '1000'));
  const maxRows = Number.isSafeInteger(configured) && configured > 0 ? configured : 1000;
  if (data.length > maxRows) throw new CustomerImportError(`Import exceeds ${maxRows} rows`, 413);

  const result = { total: data.length, success: 0, failed: 0,
    errors: [] as Array<{ row: number; message: string }> };
  for (const [index, value] of data.entries()) {
    try {
      const row = validateCustomerImportRow(value);
      await prisma.$transaction(async (tx) => {
        const duplicate = await tx.customer.findFirst({ where: {
          tenantId: actor.tenantId, appType: actor.appType,
          phone: row.phone, deletedAt: null,
        }, select: { id: true } });
        if (duplicate) throw new CustomerImportRowError('Duplicate customer phone');
        const customer = await tx.customer.create({ data: {
          tenantId: actor.tenantId, appType: actor.appType, branchId: actor.branchId,
          ...row, aadharNumber: encryptAadharNumber(row.aadharNumber), status: 'active',
        } });
        await tx.auditLog.create({ data: {
          tenantId: actor.tenantId, userId: actor.userId,
          action: 'import', entityType: 'customer', entityId: customer.id,
          newValue: JSON.stringify({ customerCode: customer.customerCode,
            appType: actor.appType, branchId: actor.branchId }),
        } });
      });
      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push({ row: index + 1, message: error instanceof CustomerImportRowError
        ? error.message : 'Database rejected row' });
    }
  }
  return result;
}
