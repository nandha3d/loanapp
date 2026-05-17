const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'default' } });
  if (!tenant) throw new Error('Tenant not found');

  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, code: 'HQ' } });
  if (!branch) throw new Error('Branch not found');

  const superPassword = await bcrypt.hash('super123', 12);

  // Use a random phone to avoid unique constraint if it already exists
  const superadmin = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'superadmin' } },
    update: { passwordHash: superPassword, role: 'superadmin', status: 'active' },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Super Admin',
      phone: '9998887776', // Unique phone
      username: 'superadmin',
      passwordHash: superPassword,
      role: 'superadmin',
      status: 'active',
    },
  });

  console.log('✅ Super admin user created or updated:', superadmin.id);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
