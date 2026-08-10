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
        select: {
          name: true,
          customerCode: true,
          branchId: true,
          appType: true,
          agent: { select: { branchId: true } },
        },
      }),
      prisma.loan.findMany({
        where: { tenantId: tenant.id, status: 'pending_review' },
        select: {
          loanCode: true,
          branchId: true,
          appType: true,
          createdBy: { select: { branchId: true } },
        },
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
      ...customers.map((c) => ({
        label: `customer ${c.name} (${c.customerCode})`,
        branchId: c.branchId,
        filerBranchId: c.agent?.branchId ?? null,
        appType: c.appType,
      })),
      ...loans.map((l) => ({
        label: `loan ${l.loanCode}`,
        branchId: l.branchId,
        filerBranchId: l.createdBy?.branchId ?? null,
        appType: l.appType,
      })),
      ...requests.map((r) => ({
        label: `${r.requestType} on ${r.entityType} by ${r.requestedBy?.name ?? '?'}`,
        branchId: r.requestedBy?.branchId ?? null,
        filerBranchId: r.requestedBy?.branchId ?? null,
        appType: r.appType,
      })),
    ];

    console.log('\n-- pending approvals and who they reach --');
    if (items.length === 0) console.log('  (none)');
    for (const item of items) {
      // Mirrors lib/notify/approvers.ts: admins on the record's branch OR the
      // filing agent's branch, plus unbranched admins. The two branches differ
      // when an agent works a route belonging to another branch.
      const targetBranches = [item.branchId, item.filerBranchId].filter(Boolean);
      let reach = admins.filter(
        (a) => targetBranches.length === 0 || !a.branchId || targetBranches.includes(a.branchId),
      );
      // Zero-reach falls back to every admin rather than dropping the approval.
      const usedFallback = reach.length === 0 && admins.length > 0;
      if (usedFallback) reach = admins;

      console.log(`  [${item.appType}] ${item.label}`);
      console.log(`      record branch: ${branchName(item.branchId)}`);
      if (item.filerBranchId !== item.branchId) {
        console.log(`      filed by staff on: ${branchName(item.filerBranchId)}`);
      }
      console.log(
        `      admins reached: ${reach.length ? reach.map((a) => a.name).join(', ') : 'NONE'}` +
          (usedFallback ? '  (via all-admin fallback)' : ''),
      );
      console.log(`      superadmins reached: ${supers.map((s) => s.name).join(', ') || 'NONE'}`);
    }

    // What each admin actually SEES in the Customers / Loans lists. Mirrors
    // scopedBranchWhere: the admin's own branch, nothing else. An admin with no
    // branch is tenant-wide by design.
    console.log('\n-- list visibility per admin (customers / loans) --');
    const [cAll, lAll, cOrphan, lOrphan] = await Promise.all([
      prisma.customer.count({ where: { tenantId: tenant.id } }),
      prisma.loan.count({ where: { tenantId: tenant.id } }),
      prisma.customer.count({ where: { tenantId: tenant.id, branchId: null } }),
      prisma.loan.count({ where: { tenantId: tenant.id, branchId: null } }),
    ]);
    for (const a of admins) {
      const scope = a.branchId ? { branchId: a.branchId } : {};
      const [c, l] = await Promise.all([
        prisma.customer.count({ where: { tenantId: tenant.id, ...scope } }),
        prisma.loan.count({ where: { tenantId: tenant.id, ...scope } }),
      ]);
      console.log(`  ${a.name} (${branchName(a.branchId)})`);
      console.log(`      customers: ${c}/${cAll} visible`);
      console.log(`      loans:     ${l}/${lAll} visible`);
      if (!a.branchId) console.log('      ⚠ no branch assigned — sees the whole tenant');
    }

    // Unbranched records reach no branch admin at all. That is deliberate — the
    // alternative shows them to EVERY branch — but they need repairing.
    if (cOrphan || lOrphan) {
      console.log(
        `\n  ⚠ ${cOrphan} customer(s) and ${lOrphan} loan(s) have no branch: superadmin-only.` +
          '\n    Repair with scripts/backfill-customer-route-agent.js (fills branch + agent from the route).',
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
