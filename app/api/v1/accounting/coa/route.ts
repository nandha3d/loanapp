import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { defaultNormalSide } from '@/lib/accounting/enums';
import { seedDefaultCoA } from '@/lib/accounting/seedDefaultCoA';
import { writeAuditLog } from '@/lib/accounting/premium';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const showInactive = req.nextUrl.searchParams.get('showInactive') === 'true';
    
    const accounts = await prisma.account.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(showInactive ? {} : { isActive: true }),
      },
      orderBy: { code: 'asc' },
    });

    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const balances = await prisma.accountBalance.findMany({
      where: { tenantId: ctx.tenantId, periodKey },
      select: { accountId: true, closingDr: true, closingCr: true },
    });
    
    const balMap = new Map(balances.map((b) => [b.accountId, b]));

    const formatted = accounts.map((a) => {
      const bal = balMap.get(a.id);
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        classType: a.classType,
        subType: a.subType,
        normalSide: a.normalSide,
        isCash: a.isCash,
        parentId: a.parentId,
        isActive: a.isActive,
        description: a.description,
        balance: bal ? {
          closingDr: Number(bal.closingDr),
          closingCr: Number(bal.closingCr),
        } : null,
      };
    });

    return ok(formatted);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'reseed') {
      const result = await seedDefaultCoA(ctx.tenantId);
      return ok({ success: true, ...result });
    }

    const { code, name, classType, subType, parentId, isCash, description } = body;
    if (!code || !name || !classType) {
      return fail('Missing code, name or classType', 400);
    }

    const exists = await prisma.account.findUnique({
      where: { tenantId_code: { tenantId: ctx.tenantId, code } },
    });
    if (exists) {
      return fail('duplicateCode', 400);
    }

    const normalSide = defaultNormalSide(classType as any);
    const account = await prisma.account.create({
      data: {
        tenantId: ctx.tenantId,
        code,
        name,
        classType,
        subType: subType || null,
        normalSide,
        isCash: isCash ?? false,
        parentId: parentId ?? null,
        description: description || null,
      },
    });

    await writeAuditLog({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'account',
      entityId: account.id,
      after: { code: account.code, name: account.name },
    });

    return ok({ success: true, account });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { id, action, name, subType, parentId, isCash, description, isActive } = body;

    if (!id) {
      return fail('Missing account id', 400);
    }

    const account = await prisma.account.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!account) {
      return fail('Account not found', 404);
    }

    if (action === 'toggle') {
      const nextActive = !account.isActive;
      if (!nextActive) {
        const children = await prisma.account.count({
          where: { parentId: id, isActive: true },
        });
        if (children > 0) {
          return fail('has_active_children', 400);
        }
      }

      const updated = await prisma.account.update({
        where: { id },
        data: { isActive: nextActive },
      });

      await writeAuditLog({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'account',
        entityId: id,
        after: { isActive: nextActive },
      });

      return ok({ success: true, account: updated });
    }

    const updated = await prisma.account.update({
      where: { id },
      data: {
        name: name !== undefined ? name : account.name,
        subType: subType !== undefined ? subType : account.subType,
        parentId: parentId !== undefined ? parentId : account.parentId,
        isCash: isCash !== undefined ? isCash : account.isCash,
        description: description !== undefined ? description : account.description,
        isActive: isActive !== undefined ? isActive : account.isActive,
        updatedAt: new Date(),
      },
    });

    await writeAuditLog({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'account',
      entityId: id,
      after: body,
    });

    return ok({ success: true, account: updated });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
