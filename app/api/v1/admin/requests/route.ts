import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { normalizeModuleList, isAddOnKey } from '@/types/modules';
import { seedDefaultCoA } from '@/lib/accounting/seedDefaultCoA';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const isDev = ctx.role === 'developer';
    const whereClause = isDev ? {} : { tenantId: ctx.tenantId };

    const branchRequests = await prisma.branchRequest.findMany({
      where: whereClause,
      include: {
        requestedBy: { select: { name: true, email: true } },
        reviewedBy: { select: { name: true } },
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const moduleRequests = await prisma.moduleRequest.findMany({
      where: whereClause,
      include: {
        requestedBy: { select: { name: true, email: true } },
        reviewedBy: { select: { name: true } },
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ok({
      branchRequests: branchRequests.map(r => ({
        id: r.id,
        tenantId: r.tenantId,
        tenantName: r.tenant.name,
        requestedBy: r.requestedBy.name,
        branchId: r.branchId,
        branchName: r.branchName,
        requestedModules: r.requestedModules,
        reason: r.reason,
        status: r.status,
        reviewedBy: r.reviewedBy?.name || null,
        reviewNote: r.reviewNote,
        reviewedAt: r.reviewedAt?.toISOString() || null,
        createdAt: r.createdAt.toISOString(),
      })),
      moduleRequests: moduleRequests.map(r => ({
        id: r.id,
        tenantId: r.tenantId,
        tenantName: r.tenant.name,
        requestedBy: r.requestedBy.name,
        appType: r.appType,
        reason: r.reason,
        status: r.status,
        reviewedBy: r.reviewedBy?.name || null,
        reviewNote: r.reviewNote,
        reviewedAt: r.reviewedAt?.toISOString() || null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role !== 'developer') {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { requestType, requestId, decision, reviewNote } = body;

    if (!requestId || !['approved', 'rejected'].includes(decision)) {
      return fail('Invalid request parameters', 400);
    }

    if (requestType === 'branch') {
      const branchReq = await prisma.branchRequest.findUnique({
        where: { id: requestId },
        include: { requestedBy: { select: { id: true, name: true } } },
      });
      if (!branchReq || branchReq.status !== 'pending') {
        return fail('Request not found or already reviewed', 404);
      }

      const requestedModules = normalizeModuleList(branchReq.requestedModules);
      const requestedModulesStr = JSON.stringify(requestedModules);

      if (decision === 'approved') {
        const sub = await prisma.tenantSubscription.findUnique({
          where: { tenantId: branchReq.tenantId },
          select: { enabledModules: true },
        });
        if (sub) {
          const planModules = normalizeModuleList(sub.enabledModules);
          const invalidModules = requestedModules.filter(m => !planModules.includes(m));
          if (invalidModules.length > 0) {
            return fail(`Modules not in tenant subscription: ${invalidModules.join(', ')}`, 400);
          }
        }

        if (branchReq.branchId) {
          await prisma.branch.update({
            where: { id: branchReq.branchId },
            data: { enabledModules: requestedModulesStr },
          });
        } else {
          await prisma.branch.create({
            data: {
              tenantId: branchReq.tenantId,
              superadminId: branchReq.requestedById,
              name: branchReq.branchName ?? 'New Branch',
              enabledModules: requestedModulesStr,
              status: 'active',
            },
          });
        }
      }

      await prisma.branchRequest.update({
        where: { id: requestId },
        data: {
          status: decision,
          reviewedById: ctx.userId,
          reviewNote: reviewNote || null,
          reviewedAt: new Date(),
        },
      });

      await prisma.systemNotification.create({
        data: {
          tenantId: branchReq.tenantId,
          appType: 'microlending',
          type: 'branch_request',
          icon: decision === 'approved' ? 'check_circle' : 'cancel',
          title: `Branch request ${decision}`,
          message: `${branchReq.branchName || 'Branch module request'} was ${decision}.`,
          link: '/branch-requests',
        },
      }).catch(() => {});

      return ok({ success: true });
    }

    if (requestType === 'module') {
      const moduleReq = await prisma.moduleRequest.findUnique({
        where: { id: requestId },
        include: { requestedBy: { select: { id: true, name: true } } },
      });
      if (!moduleReq || moduleReq.status !== 'pending') {
        return fail('Request not found or already reviewed', 404);
      }

      if (decision === 'approved') {
        if (isAddOnKey(moduleReq.appType)) {
          if (moduleReq.appType === 'premium_accounting') {
            await prisma.tenantSubscription.upsert({
              where: { tenantId: moduleReq.tenantId },
              update: { premiumAccountingEnabled: true },
              create: {
                tenantId: moduleReq.tenantId,
                enabledModules: '[]',
                plan: 'trial',
                status: 'active',
                maxActiveLoans: 50,
                maxAgents: 3,
                premiumAccountingEnabled: true,
              },
            });
            try {
              await seedDefaultCoA(moduleReq.tenantId);
            } catch (e) {
              console.error('seedDefaultCoA failed:', e);
            }
          }
        } else {
          const sub = await prisma.tenantSubscription.findUnique({
            where: { tenantId: moduleReq.tenantId },
            select: { enabledModules: true },
          });
          const current = normalizeModuleList(sub?.enabledModules);
          if (!current.includes(moduleReq.appType as any)) {
            const updated = [...current, moduleReq.appType];
            await prisma.tenantSubscription.upsert({
              where: { tenantId: moduleReq.tenantId },
              update: { enabledModules: JSON.stringify(updated) },
              create: {
                tenantId: moduleReq.tenantId,
                enabledModules: JSON.stringify(updated),
                plan: 'trial',
                status: 'active',
                maxActiveLoans: 50,
                maxAgents: 3,
              },
            });
          }
        }
      }

      await prisma.moduleRequest.update({
        where: { id: requestId },
        data: {
          status: decision,
          reviewedById: ctx.userId,
          reviewNote: reviewNote || null,
          reviewedAt: new Date(),
        },
      });

      const notifTitle = isAddOnKey(moduleReq.appType)
        ? `Add-on request ${decision}`
        : `Module request ${decision}`;
      const notifMsg = `Your request for "${moduleReq.appType}" was ${decision}.`;

      await prisma.systemNotification.create({
        data: {
          tenantId: moduleReq.tenantId,
          appType: 'microlending',
          type: 'module_request',
          icon: decision === 'approved' ? 'check_circle' : 'cancel',
          title: notifTitle,
          message: notifMsg,
          link: '/module-requests',
        },
      }).catch(() => {});

      return ok({ success: true });
    }

    return fail('Invalid requestType', 400);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
