import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Inspecting data for newsuper user...');
  const user = await prisma.user.findFirst({
    where: { username: 'newsuper' },
    include: { tenant: true, branch: true }
  });

  if (!user) {
    console.log('User newsuper not found!');
    return;
  }

  console.log('USER:', {
    id: user.id,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId,
    branchId: user.branchId,
  });

  console.log('TENANT:', {
    id: user.tenant.id,
    name: user.tenant.name,
    slug: user.tenant.slug,
  });

  const branches = await prisma.branch.findMany({
    where: { tenantId: user.tenantId }
  });

  console.log('BRANCHES IN TENANT:', branches.map(b => ({
    id: b.id,
    name: b.name,
    code: b.code,
    superadminId: b.superadminId,
    enabledModules: b.enabledModules,
    status: b.status,
  })));

  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId: user.tenantId }
  });

  console.log('SUBSCRIPTION:', sub);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
