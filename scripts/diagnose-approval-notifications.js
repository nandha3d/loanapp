#!/usr/bin/env node
/**
 * Read-only diagnostic: why does an admin not see approvals / approval
 * notifications that the superadmin does?
 *
 * Usage: node scripts/diagnose-approval-notifications.js [tenantSlugOrId]
 *
 * Prints, per tenant: every admin/superadmin and the branch they sit on, every
 * pending approval item and the branch it sits on, and which approvers each
 * pending item currently reaches. Writes nothing.
 */
let PrismaClient;
try { ({ PrismaClient } = require('@prisma/client')); }
catch { ({ PrismaClient } = require('../prisma/generated-client')); }
const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2];
  const tenants = await prisma.tenant.findMany({
    where: arg ? { OR: [{ id: arg }, { slug: arg }] } : {},
    select: { id: true, name: true, slug: true },
  });

  for (const tenant of tenants) {
    console.log(`\n=== ${tenant.name} (${tenant.slug}) ===`);

    const branches = await prisma.branch.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
    });
    const branchName = (id) =>
      id ? branches.find((b) => b.id === id)?.name ?? `<missing ${id}>` : '<no branch>';

    const staff = await prisma.user.findMany({
      where: { tenantId: tenant.id, role: { in: ['superadmin', 'admin', 'agent'] } },
      select: { id: true, name: true, role: true, status: true, branchId: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    console.log('\n-- staff --');
    for (const u of staff) {
      console.log(`  ${u.role.padEnd(11)} ${u.status.padEnd(8)} ${String(u.name).padEnd(20)} ${branchName(u.branchId)}`);
    }

    const admins = staff.filter((u) => u.role === 'admin' && u.status === 'active');
    const supers = staff.filter((u) => u.role === 'superadmin' && u.status === 'active');

    const [customers, loans, requests] = await Promise.all([
      prisma.customer.findMany({
        where: { tenantId: tenant.id, status: 'pending_review' },
        select: { name: true, customerCode: true, branchId: true, appType: true },
      }),
      prisma.loan.findMany({
        where: { tenantId: tenant.id, status: 'pending_review' },
        select: { loanCode: true, branchId: true, appType: true },
      }),
      prisma.approvalRequest.findMany({
        where: { tenantId: tenant.id, status: 'pending' },
        select: {
          requestType: true,
          entityType: true,
          appType: true,
          requestedBy: { select: { name: true, branchId: true } },
        },
      }),
    ]);

    const items = [
      ...customers.map((c) => ({ label: `customer ${c.name} (${c.customerCode})`, branchId: c.branchId, appType: c.appType })),
      ...loans.map((l) => ({ label: `loan ${l.loanCode}`, branchId: l.branchId, appType: l.appType })),
      ...requests.map((r) => ({
        label: `${r.requestType} on ${r.entityType} by ${r.requestedBy?.name ?? '?'}`,
        branchId: r.requestedBy?.branchId ?? null,
        appType: r.appType,
      })),
    ];

    console.log('\n-- pending approvals and who they reach --');
    if (items.length === 0) console.log('  (none)');
    for (const item of items) {
      // Same rule the app now uses: branch admins + unbranched admins.
      const reach = admins.filter((a) => !item.branchId || !a.branchId || a.branchId === item.branchId);
      console.log(`  [${item.appType}] ${item.label}`);
      console.log(`      branch: ${branchName(item.branchId)}`);
      console.log(`      admins reached: ${reach.length ? reach.map((a) => a.name).join(', ') : 'NONE  <-- only superadmins see this'}`);
      console.log(`      superadmins reached: ${supers.map((s) => s.name).join(', ') || 'NONE'}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
