import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';

const prisma = new PrismaClient();

async function tableExists(tableName: string) {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT TABLE_NAME AS table_name
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
  `;

  return rows.length === 1;
}

async function main() {
  assert.equal(await tableExists('rate_limits'), true, 'rate_limits table must exist for credential login');

  const users = await prisma.user.findMany({
    where: { username: { in: ['admin', 'superadmin'] } },
    include: { tenant: true },
  });

  const byUsername = new Map(users.map((user) => [user.username, user]));
  const admin = byUsername.get('admin');
  const superadmin = byUsername.get('superadmin');

  assert.ok(admin, 'admin user should be seeded');
  assert.equal(admin.status, 'active');
  assert.equal(admin.tenant.status, 'active');
  assert.equal(await compare('admin123', admin.passwordHash), true);

  assert.ok(superadmin, 'superadmin user should be seeded');
  assert.equal(superadmin.status, 'active');
  assert.equal(superadmin.tenant.status, 'active');
  assert.equal(await compare('super123', superadmin.passwordHash), true);

  console.log('auth database prerequisites passed');
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
