/**
 * Backfill: convert legacy role-broadcast notifications into per-user rows.
 *
 * Old notifications were single shared rows (targetUserId NULL + targetRole set),
 * so one user reading one marked it read for everyone. notifyUser now fans out
 * per user; this migrates the existing broadcast rows the same way — one copy
 * per matching user (each with its own read state), then deletes the shared row.
 *
 * Idempotent: converted rows have a targetUserId, so a re-run finds nothing.
 *
 *   node scripts/backfill-per-user-notifications.cjs          # DRY RUN
 *   node scripts/backfill-per-user-notifications.cjs apply     # writes
 */
let PrismaClient;
try { ({ PrismaClient } = require('@prisma/client')); }
catch { ({ PrismaClient } = require('../prisma/generated-client')); }

const APPLY = process.argv[2] === 'apply';
const p = new PrismaClient();

(async () => {
  const broadcasts = await p.systemNotification.findMany({
    where: { targetUserId: null, NOT: { targetRole: null } },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Found ${broadcasts.length} legacy broadcast notifications.`);

  let createdRows = 0, deleted = 0, skipped = 0;
  for (const n of broadcasts) {
    const users = await p.user.findMany({
      where: {
        tenantId: n.tenantId,
        role: n.targetRole,
        status: 'active',
        ...(n.branchId ? { branchId: n.branchId } : {}),
      },
      select: { id: true },
    });
    if (users.length === 0) { skipped++; continue; }

    console.log(`  ${APPLY ? 'CONVERT' : 'WOULD CONVERT'} "${n.title}" -> ${users.length} users`);
    createdRows += users.length;

    if (APPLY) {
      await p.$transaction([
        p.systemNotification.createMany({
          data: users.map((u) => ({
            tenantId: n.tenantId,
            branchId: n.branchId,
            targetUserId: u.id,
            targetRole: null,
            appType: n.appType,
            type: n.type,
            icon: n.icon,
            title: n.title,
            message: n.message,
            link: n.link,
            isRead: n.isRead,
            readAt: n.readAt,
            createdAt: n.createdAt,
          })),
        }),
        p.systemNotification.delete({ where: { id: n.id } }),
      ]);
      deleted++;
    }
  }

  console.log(`\n${APPLY ? 'Created' : 'Would create'} ${createdRows} per-user rows from ${broadcasts.length - skipped} broadcasts (${skipped} had no active users).`);
  if (!APPLY && createdRows > 0) console.log('Re-run with:  node scripts/backfill-per-user-notifications.cjs apply');
  await p.$disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
