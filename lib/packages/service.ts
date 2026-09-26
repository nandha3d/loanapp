import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { branchOrSharedWhere } from '@/lib/masterDataScope';

export type PackageActor = {
  tenantId: string;
  appType: string;
  branchId: string | null;
  userId: string;
  role: string;
};

export class PackageError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function requireManager(actor: PackageActor) {
  if (!['admin', 'superadmin', 'developer'].includes(actor.role)) throw new PackageError('Forbidden', 403);
}

export function packageWhere(actor: PackageActor, id?: string): Prisma.LoanPackageWhereInput {
  return {
    ...(id ? { id } : {}),
    tenantId: actor.tenantId,
    appType: actor.appType,
    ...branchOrSharedWhere(actor.branchId),
  };
}

function editablePackageWhere(actor: PackageActor, id: string): Prisma.LoanPackageWhereInput {
  return {
    id,
    tenantId: actor.tenantId,
    appType: actor.appType,
    ...(actor.branchId ? { branchId: actor.branchId } : {}),
  };
}

export function calculatePackageDeduction(principal: number, deduction: number, type: string): number {
  return type === 'percentage' ? Math.round(principal * deduction / 100) : deduction;
}

export function normalizePackageInput(input: Record<string, unknown>) {
  const name = String(input.name ?? '').trim();
  const principal = Number(input.principal);
  const rateOrAmount = Number(input.deduction);
  const tenure = Number(input.tenure);
  const penaltyRate = Number(input.penaltyRate ?? 0);
  const perInstalment = input.perInstalment == null
    ? Math.round(principal / tenure)
    : Number(input.perInstalment);
  const frequency = String(input.frequency || 'daily');
  const deductionType = input.deductionType === 'percentage' ? 'percentage' : 'fixed';
  if (!name || !Number.isFinite(principal) || principal <= 0 ||
      !Number.isFinite(rateOrAmount) || rateOrAmount < 0 ||
      !Number.isInteger(tenure) || tenure <= 0 ||
      !Number.isFinite(perInstalment) || perInstalment < 0 ||
      !Number.isFinite(penaltyRate) || penaltyRate < 0 || !frequency.trim()) {
    throw new PackageError('Invalid loan package terms', 400);
  }
  return {
    name,
    principal,
    deduction: calculatePackageDeduction(principal, rateOrAmount, deductionType),
    deductionType,
    frequency,
    tenure,
    perInstalment,
    penaltyRate,
  };
}

export async function listPackages(actor: PackageActor, includeInactive = false) {
  if (includeInactive) requireManager(actor);
  return prisma.loanPackage.findMany({
    where: { ...packageWhere(actor), ...(includeInactive ? {} : { status: 'active' }) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPackage(actor: PackageActor, id: string) {
  requireManager(actor);
  const pkg = await prisma.loanPackage.findFirst({ where: packageWhere(actor, id) });
  if (!pkg) throw new PackageError('Package not found', 404);
  return pkg;
}

export async function createPackage(actor: PackageActor, input: Record<string, unknown>) {
  requireManager(actor);
  const data = normalizePackageInput(input);
  return prisma.$transaction(async (tx) => {
    const pkg = await tx.loanPackage.create({
      data: {
        ...data,
        tenantId: actor.tenantId,
        appType: actor.appType,
        branchId: actor.branchId,
        status: 'active',
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'create',
        entityType: 'loan_package',
        entityId: pkg.id,
        newValue: JSON.stringify(data),
      },
    });
    return pkg;
  });
}

export async function updatePackage(actor: PackageActor, id: string, input: Record<string, unknown>) {
  requireManager(actor);
  const allowed = ['name', 'principal', 'deduction', 'deductionType', 'frequency', 'tenure', 'perInstalment', 'penaltyRate', 'status'];
  const patch = Object.fromEntries(allowed.filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]]));
  if (!Object.keys(patch).length) throw new PackageError('No package changes supplied', 400);
  return prisma.$transaction(async (tx) => {
    const current = await tx.loanPackage.findFirst({ where: editablePackageWhere(actor, id) });
    if (!current) throw new PackageError('Package not found', 404);
    if (patch.status !== undefined && !['active', 'inactive'].includes(String(patch.status))) {
      throw new PackageError('Invalid package status', 400);
    }
    const terms = normalizePackageInput({
      name: patch.name ?? current.name,
      principal: patch.principal ?? Number(current.principal),
      deduction: patch.deduction ?? Number(current.deduction),
      deductionType: patch.deductionType ?? current.deductionType,
      frequency: patch.frequency ?? current.frequency,
      tenure: patch.tenure ?? current.tenure,
      perInstalment: patch.perInstalment ?? Number(current.perInstalment),
      penaltyRate: patch.penaltyRate ?? Number(current.penaltyRate),
    });
    // PATCH uses the stored rupee deduction, as the existing web API does.
    terms.deduction = patch.deduction === undefined ? Number(current.deduction) : Number(patch.deduction);
    const pkg = await tx.loanPackage.update({
      where: { id },
      data: { ...terms, ...(patch.status !== undefined ? { status: String(patch.status) } : {}) },
    });
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'update',
        entityType: 'loan_package',
        entityId: id,
        newValue: JSON.stringify({ ...terms, status: pkg.status }),
      },
    });
    return pkg;
  });
}

export async function deletePackage(actor: PackageActor, id: string) {
  requireManager(actor);
  return prisma.$transaction(async (tx) => {
    const pkg = await tx.loanPackage.findFirst({ where: editablePackageWhere(actor, id) });
    if (!pkg) throw new PackageError('Package not found', 404);
    const loanCount = await tx.loan.count({
      where: { packageId: id, tenantId: actor.tenantId, appType: actor.appType },
    });
    if (loanCount) throw new PackageError('Package is referenced by existing loans', 409);
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'delete',
        entityType: 'loan_package',
        entityId: id,
      },
    });
    await tx.loanPackage.delete({ where: { id } });
  });
}
