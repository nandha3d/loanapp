import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing empty tenants with 0 branches...');

  // Find all tenants
  const tenants = await prisma.tenant.findMany({
    include: {
      branches: true,
      users: { where: { role: 'superadmin' } },
      subscription: true,
    }
  });

  for (const tenant of tenants) {
    if (tenant.branches.length === 0) {
      console.log(`Tenant "${tenant.name}" (${tenant.id}) has 0 branches. Fixing...`);

      const superadmin = tenant.users[0];
      if (!superadmin) {
        console.warn(`No superadmin user found for tenant "${tenant.name}" (${tenant.id}), skipping.`);
        continue;
      }

      const enabledModules = tenant.subscription?.enabledModules 
        ? JSON.parse(tenant.subscription.enabledModules) 
        : ['microlending'];

      // 1. Create default branch
      const branch = await prisma.branch.create({
        data: {
          tenantId: tenant.id,
          superadminId: superadmin.id,
          name: 'Head Office',
          code: 'HQ',
          status: 'active',
          enabledModules: JSON.stringify(enabledModules),
        }
      });
      console.log(`Created default branch "Head Office (HQ)" for tenant "${tenant.name}"`);

      // 2. Link superadmin to the branch
      await prisma.user.update({
        where: { id: superadmin.id },
        data: { branchId: branch.id }
      });
      console.log(`Associated superadmin "${superadmin.username}" with branch "${branch.name}"`);

      // 3. Create SuperadminBranch link
      await prisma.superadminBranch.create({
        data: {
          superadminId: superadmin.id,
          branchId: branch.id,
          assignedById: superadmin.id,
        }
      });
      console.log('Created SuperadminBranch join link');

      // 4. Create default app settings
      const defaultSettings = [
        { key: 'app_name', value: tenant.name, group: 'branding' },
        { key: 'app_tagline', value: 'Micro-Lending Management System', group: 'branding' },
        { key: 'logo_url', value: '/assets/logo.svg', group: 'branding' },
        { key: 'primary_color', value: '#F5A623', group: 'branding' },
        { key: 'primary_dark', value: '#E8930C', group: 'branding' },
        { key: 'timezone', value: 'Asia/Kolkata', group: 'system' },
        { key: 'currency', value: 'INR', group: 'system' },
        { key: 'currency_symbol', value: '₹', group: 'system' },
        { key: 'date_format', value: 'dd MMM yyyy', group: 'system' },
        { key: 'midnight_cutoff', value: 'true', group: 'system' },
        { key: 'allow_weekend_collection', value: 'false', group: 'system' },
        { key: 'default_penalty_per_day', value: '50', group: 'penalty' },
        { key: 'penalty_grace_period', value: '0', group: 'penalty' },
        { key: 'penalty_max_cap', value: '0', group: 'penalty' },
        { key: 'customer_code_prefix', value: 'CUS', group: 'general' },
        { key: 'loan_code_prefix', value: 'LN', group: 'general' },
        { key: 'customer_code_counter', value: '0', group: 'general' },
        { key: 'loan_code_counter', value: '0', group: 'general' }
      ];

      // Insert settings if they do not exist
      for (const s of defaultSettings) {
        await prisma.appSetting.upsert({
          where: { tenantId_key: { tenantId: tenant.id, key: s.key } },
          update: {},
          create: {
            tenantId: tenant.id,
            key: s.key,
            value: s.value,
            group: s.group,
          }
        });
      }
      console.log(`Initialized default app settings for tenant "${tenant.name}"`);
    } else {
      console.log(`Tenant "${tenant.name}" (${tenant.id}) already has ${tenant.branches.length} branches. Checked.`);
    }
  }

  console.log('Fix complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
