/* eslint-disable */
// DESTRUCTIVE: wipes all data, keeps ONLY the developer account + its tenant
// shell so you can log in (developer/dev123) and register a fresh tenant.
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const dev = await p.user.findFirst({
    where: { role: 'developer' },
    select: { id: true, tenantId: true, username: true },
  });
  if (!dev) {
    console.error('ABORT: no developer user found -> would lock you out.');
    process.exit(1);
  }

  const rows = await p.$queryRawUnsafe(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'",
  );
  const keep = new Set(['users', 'tenants', '_prisma_migrations']);

  await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  let truncated = 0;
  for (const r of rows) {
    const t = r.t;
    if (keep.has(t)) continue;
    await p.$executeRawUnsafe('TRUNCATE TABLE `' + t + '`');
    truncated++;
  }
  // Keep only the developer; detach from any branch (branches were truncated).
  await p.$executeRawUnsafe('UPDATE users SET branch_id = NULL WHERE id = ?', dev.id);
  const delUsers = await p.$executeRawUnsafe('DELETE FROM users WHERE id <> ?', dev.id);
  const delTenants = await p.$executeRawUnsafe('DELETE FROM tenants WHERE id <> ?', dev.tenantId);
  await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

  console.log(
    `Wiped. truncated ${truncated} tables, deleted ${delUsers} users, ${delTenants} tenants.`,
  );
  console.log(`Kept developer "${dev.username}" (tenant ${dev.tenantId}). Login: developer / dev123`);
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
