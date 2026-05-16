import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Create Default Tenant ──
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'LoanTrack',
      slug: 'default',
      status: 'active',
    },
  });
  console.log('✅ Tenant created:', tenant.id);

  // ── Create Default Branch ──
  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'HQ' } },
    update: { enabledModules: ['microlending'] },
    create: {
      tenantId: tenant.id,
      name: 'Head Office',
      code: 'HQ',
      address: 'Main Branch',
      status: 'active',
      enabledModules: ['microlending'],
    },
  });
  console.log('✅ Branch created:', branch.id);

  // ── Create Admin User ──
  const adminPassword = await hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'admin' } },
    update: { passwordHash: adminPassword },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Admin User',
      phone: '9800000000',
      username: 'admin',
      passwordHash: adminPassword,
      role: 'admin',
      status: 'active',
    },
  });
  console.log('✅ Admin user created:', admin.id);

  // ── Create Demo Agent ──
  const agentPassword = await hash('agent123', 12);
  const agent1 = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'karthik' } },
    update: { passwordHash: agentPassword },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Karthik Rajan',
      phone: '9876543210',
      username: 'karthik',
      passwordHash: agentPassword,
      role: 'agent',
      status: 'active',
    },
  });
  console.log('✅ Agent user created:', agent1.id);

  // ── Create Developer User ──
  const devPassword = await hash('dev123', 12);
  await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'developer' } },
    update: { passwordHash: devPassword },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Developer',
      phone: '9000000001',
      username: 'developer',
      passwordHash: devPassword,
      role: 'developer',
      status: 'active',
    },
  });
  console.log('✅ Developer user created');

  // ── Create Super Admin User ──
  const superPassword = await hash('super123', 12);
  const superadmin = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'superadmin' } },
    update: { passwordHash: superPassword },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Super Admin',
      phone: '9000000002',
      username: 'superadmin',
      passwordHash: superPassword,
      role: 'superadmin',
      status: 'active',
    },
  });
  console.log('✅ Super admin user created');

  // ── Create Default Routes ──
  await prisma.branch.update({
    where: { id: branch.id },
    data: { superadminId: superadmin.id },
  });

  const erodeBranch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ERODE' } },
    update: {
      superadminId: superadmin.id,
      enabledModules: ['autofinance', 'chitfunds'],
    },
    create: {
      tenantId: tenant.id,
      superadminId: superadmin.id,
      name: 'Erode',
      code: 'ERODE',
      enabledModules: ['autofinance', 'chitfunds'],
      status: 'active',
    },
  });

  const namakkalBranch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'NAMAKKAL' } },
    update: {
      superadminId: superadmin.id,
      enabledModules: ['microlending'],
    },
    create: {
      tenantId: tenant.id,
      superadminId: superadmin.id,
      name: 'Namakkal',
      code: 'NAMAKKAL',
      enabledModules: ['microlending'],
      status: 'active',
    },
  });
  console.log('Example module branches created:', erodeBranch.id, namakkalBranch.id);

  const routeNames = ['Erode', 'Chithode', 'Gobichettipalayam', 'Bhavani'];
  for (const name of routeNames) {
    await prisma.route.upsert({
      where: { id: `route-${name.toLowerCase()}` },
      update: {},
      create: {
        id: `route-${name.toLowerCase()}`,
        tenantId: tenant.id,
        branchId: branch.id,
        name,
        assignedAgentId: agent1.id,
        status: 'active',
      },
    });
  }
  console.log('✅ Routes created');

  // ── Create Default App Settings ──
  const defaultSettings: { key: string; value: string; group: string }[] = [
    // Branding
    { key: 'app_name', value: 'LoanTrack', group: 'branding' },
    { key: 'app_tagline', value: 'Micro-Lending Management System', group: 'branding' },
    { key: 'logo_url', value: '/assets/logo.svg', group: 'branding' },
    { key: 'primary_color', value: '#F5A623', group: 'branding' },
    { key: 'primary_dark', value: '#E8930C', group: 'branding' },
    // System
    { key: 'timezone', value: 'Asia/Kolkata', group: 'system' },
    { key: 'currency', value: 'INR', group: 'system' },
    { key: 'currency_symbol', value: '₹', group: 'system' },
    { key: 'date_format', value: 'dd MMM yyyy', group: 'system' },
    { key: 'midnight_cutoff', value: 'true', group: 'system' },
    { key: 'allow_weekend_collection', value: 'false', group: 'system' },
    // Penalty
    { key: 'default_penalty_per_day', value: '50', group: 'penalty' },
    { key: 'penalty_grace_period', value: '0', group: 'penalty' },
    { key: 'penalty_max_cap', value: '0', group: 'penalty' },
    // Customer & Loan codes
    { key: 'customer_code_prefix', value: 'CUS', group: 'general' },
    { key: 'loan_code_prefix', value: 'LN', group: 'general' },
    { key: 'customer_code_counter', value: '0', group: 'general' },
    { key: 'loan_code_counter', value: '0', group: 'general' },
  ];

  for (const s of defaultSettings) {
    await prisma.appSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: s.key } },
      update: {},
      create: { tenantId: tenant.id, key: s.key, value: s.value, group: s.group },
    });
  }
  console.log('✅ App settings created');

  // ── Create Default Loan Packages ──
  const packages = [
    { name: 'Standard 100-Day Daily', principal: 30000, deduction: 3000, frequency: 'daily', tenure: 100, perInstalment: 300, penaltyRate: 50 },
    { name: 'Premium 100-Day Daily', principal: 50000, deduction: 5000, frequency: 'daily', tenure: 100, perInstalment: 500, penaltyRate: 100 },
    { name: 'Weekly 20-Week', principal: 20000, deduction: 2000, frequency: 'weekly', tenure: 20, perInstalment: 1000, penaltyRate: 200 },
    { name: 'Monthly 10-Month', principal: 25000, deduction: 2500, frequency: 'monthly', tenure: 10, perInstalment: 2500, penaltyRate: 500 },
  ];

  for (const pkg of packages) {
    const existing = await prisma.loanPackage.findFirst({
      where: { tenantId: tenant.id, name: pkg.name },
    });
    if (!existing) {
      await prisma.loanPackage.create({
        data: {
          tenantId: tenant.id,
          name: pkg.name,
          principal: pkg.principal,
          deduction: pkg.deduction,
          frequency: pkg.frequency,
          tenure: pkg.tenure,
          perInstalment: pkg.perInstalment,
          penaltyRate: pkg.penaltyRate,
          status: 'active',
        },
      });
    }
  }
  console.log('✅ Loan packages created');

  // ── Create Notification Templates (stubs) ──
  const templates = [
    { name: 'payment_reminder', channel: 'sms', body: 'Dear {{customer_name}}, your payment of {{currency_symbol}}{{amount}} for loan {{loan_code}} is due today. Please pay your agent.' },
    { name: 'payment_reminder', channel: 'whatsapp', body: 'Hi {{customer_name}} 👋\n\nYour payment of {{currency_symbol}}{{amount}} for loan *{{loan_code}}* is due today.\n\nPlease arrange payment with your field agent.\n\nThank you!' },
    { name: 'overdue_alert', channel: 'sms', body: 'ALERT: Dear {{customer_name}}, your payment for loan {{loan_code}} is overdue by {{days}} days. Penalty of {{currency_symbol}}{{penalty}} has been applied.' },
    { name: 'loan_created', channel: 'sms', body: 'Dear {{customer_name}}, your loan {{loan_code}} of {{currency_symbol}}{{principal}} has been approved. Collection starts {{start_date}}. Per instalment: {{currency_symbol}}{{per_instalment}}.' },
  ];

  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { tenantId_name_channel: { tenantId: tenant.id, name: t.name, channel: t.channel } },
      update: {},
      create: { tenantId: tenant.id, name: t.name, channel: t.channel, body: t.body, isActive: true },
    });
  }
  console.log('✅ Notification templates created');

  console.log('\n🎉 Seeding complete!');
  console.log('─────────────────────────');
  console.log('Admin login:      admin / admin123');
  console.log('Agent login:      karthik / agent123');
  console.log('Developer login:  developer / dev123');
  console.log('Superadmin login: superadmin / super123');
  console.log('─────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
