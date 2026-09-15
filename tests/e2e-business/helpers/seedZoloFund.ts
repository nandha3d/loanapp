import { hash } from 'bcryptjs';
import { calculateLoanPreview } from '../../../lib/loanCalculator';
import { APP_TYPE, getPrisma, getRunId, TEST_PASSWORD } from './testDb';
import { cleanupRunData } from './cleanup';

type SeedUser = {
  id: string;
  tenantId: string;
  username: string;
  phone: string;
  role: string;
  branchId: string | null;
  appType: string;
};

export type ZoloFundScenario = {
  runId: string;
  password: string;
  tenantA: { id: string; slug: string };
  tenantB: { id: string; slug: string };
  branchA1: { id: string };
  branchA2: { id: string };
  branchB1: { id: string };
  routeA1: { id: string };
  routeA2: { id: string };
  routeB1: { id: string };
  users: {
    adminA1: SeedUser;
    adminA2: SeedUser;
    agentA1: SeedUser;
    agentA2: SeedUser;
    disabledA1: SeedUser;
    adminB1: SeedUser;
    agentB1: SeedUser;
  };
  packageA: { id: string };
};

function numericSeed(runId: string) {
  return runId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 800_000_000;
}

function phone(runId: string, offset: number) {
  return `7${String(numericSeed(runId) + offset).padStart(9, '0')}`.slice(0, 10);
}

export function phoneForRun(runId: string, offset: number) {
  return phone(runId, offset);
}

function email(runId: string, name: string) {
  return `${runId}-${name}@example.test`;
}

async function ignoreMissingSchema(operation: Promise<unknown>) {
  try {
    await operation;
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (code === 'P2021' || code === 'P2022') return;
    throw error;
  }
}

async function createUser(input: {
  tenantId: string;
  branchId: string | null;
  runId: string;
  key: string;
  name: string;
  role: string;
  phoneOffset: number;
  status?: string;
  bypassCustomerApproval?: boolean;
  bypassLoanApproval?: boolean;
  autoReleaseFloat?: boolean;
}) {
  const prisma = getPrisma();
  const username = `${input.runId}-${input.key}`;
  const user = {
    id: `${input.runId}-user-${input.key}`,
    tenantId: input.tenantId,
    branchId: input.branchId,
    name: `${input.runId} ${input.name}`,
    phone: phone(input.runId, input.phoneOffset),
    email: email(input.runId, input.key),
    username,
    passwordHash: await hash(TEST_PASSWORD, 4),
    role: input.role,
    appType: APP_TYPE,
    status: input.status ?? 'active',
  };
  // QA schemas can lag optional approval/float columns. Insert only stable
  // columns needed by auth and v1 route scoping.
  await prisma.$executeRaw`
    INSERT INTO users
      (id, tenant_id, branch_id, name, phone, email, username, password_hash, role, app_type, status, created_at, updated_at)
    VALUES
      (${user.id}, ${user.tenantId}, ${user.branchId}, ${user.name}, ${user.phone}, ${user.email}, ${user.username},
       ${user.passwordHash}, ${user.role}, ${user.appType}, ${user.status}, NOW(), NOW())
  `;
  return {
    id: user.id,
    tenantId: user.tenantId,
    username: user.username,
    phone: user.phone,
    role: user.role,
    branchId: user.branchId,
    appType: user.appType,
  };
}

async function createTenantWithSubscription(runId: string, suffix: string) {
  const prisma = getPrisma();
  const tenant = {
    id: `${runId}-tenant-${suffix}`,
    name: `${runId} Tenant ${suffix}`,
    slug: `${runId}-tenant-${suffix}`.toLowerCase(),
  };

  // Some QA databases lag optional Tenant columns in the Prisma model (for
  // example custom_domain). Insert only the stable columns the v1 APIs need.
  await prisma.$executeRaw`
    INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
    VALUES (${tenant.id}, ${tenant.name}, ${tenant.slug}, 'active', NOW(), NOW())
  `;

  // The checked-in Prisma model can be ahead of older migration-created QA
  // schemas, so insert only columns that actually exist in the test database.
  const columns = await prisma.$queryRaw<Array<{ Field: string }>>`SHOW COLUMNS FROM tenant_subscriptions`;
  const existingColumns = new Set(columns.map((column) => column.Field));
  const subscriptionValues: Record<string, unknown> = {
    id: `${runId}-sub-${suffix}`,
    tenant_id: tenant.id,
    plan: 'growth',
    status: 'active',
    max_active_loans: 500,
    max_agents: 50,
    max_branches: 20,
    enabled_modules: JSON.stringify([APP_TYPE]),
    receipt_pdf_allowed: true,
    kyc_enabled: true,
    premium_accounting_enabled: true,
    gps_tracking_enabled: true,
    base_plan_price: 0,
    modules_price: 0,
    addons_price: 0,
    total_monthly_price: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const insertColumns = Object.keys(subscriptionValues).filter((column) => existingColumns.has(column));
  const placeholders = insertColumns.map(() => '?').join(', ');
  const quotedColumns = insertColumns.map((column) => `\`${column}\``).join(', ');
  await prisma.$executeRawUnsafe(
    `INSERT INTO tenant_subscriptions (${quotedColumns}) VALUES (${placeholders})`,
    ...insertColumns.map((column) => subscriptionValues[column]),
  );
  const enabledFlags = [
    'npa_enabled',
    'foreclosure_enabled',
    'kyc_enabled',
    'gps_tracking_enabled',
    'premium_accounting_enabled',
    'receipt_pdf_allowed',
  ].filter((column) => existingColumns.has(column));
  if (enabledFlags.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE tenant_subscriptions SET ${enabledFlags.map((column) => `\`${column}\` = 1`).join(', ')} WHERE tenant_id = ?`,
      tenant.id,
    );
  }

  await prisma.appSetting.createMany({
    data: [
      { tenantId: tenant.id, key: 'receipt_pdf_active', value: 'true', group: 'payment' },
      { tenantId: tenant.id, key: 'biometric_lock_required', value: 'false', group: 'security' },
    ],
  });

  return tenant;
}

export async function seedZoloFundScenario(runId = getRunId()): Promise<ZoloFundScenario> {
  const prisma = getPrisma();
  await cleanupRunData(runId);

  const tenantA = await createTenantWithSubscription(runId, 'a');
  const tenantB = await createTenantWithSubscription(runId, 'b');

  const branchA1 = await prisma.branch.create({
    data: {
      tenantId: tenantA.id,
      name: `${runId} Branch A1`,
      code: `${runId}-A1`,
      enabledModules: JSON.stringify([APP_TYPE]),
    },
  });
  const branchA2 = await prisma.branch.create({
    data: {
      tenantId: tenantA.id,
      name: `${runId} Branch A2`,
      code: `${runId}-A2`,
      enabledModules: JSON.stringify([APP_TYPE]),
    },
  });
  const branchB1 = await prisma.branch.create({
    data: {
      tenantId: tenantB.id,
      name: `${runId} Branch B1`,
      code: `${runId}-B1`,
      enabledModules: JSON.stringify([APP_TYPE]),
    },
  });

  const adminA1 = await createUser({
    tenantId: tenantA.id,
    branchId: branchA1.id,
    runId,
    key: 'admin-a1',
    name: 'Admin A1',
    role: 'admin',
    phoneOffset: 1,
    bypassCustomerApproval: true,
    bypassLoanApproval: true,
  });
  const adminA2 = await createUser({
    tenantId: tenantA.id,
    branchId: branchA2.id,
    runId,
    key: 'admin-a2',
    name: 'Admin A2',
    role: 'admin',
    phoneOffset: 2,
    bypassCustomerApproval: true,
    bypassLoanApproval: true,
  });
  const agentA1 = await createUser({
    tenantId: tenantA.id,
    branchId: branchA1.id,
    runId,
    key: 'agent-a1',
    name: 'Agent A1',
    role: 'agent',
    phoneOffset: 3,
  });
  const agentA2 = await createUser({
    tenantId: tenantA.id,
    branchId: branchA2.id,
    runId,
    key: 'agent-a2',
    name: 'Agent A2',
    role: 'agent',
    phoneOffset: 4,
  });
  const disabledA1 = await createUser({
    tenantId: tenantA.id,
    branchId: branchA1.id,
    runId,
    key: 'disabled-a1',
    name: 'Disabled A1',
    role: 'agent',
    phoneOffset: 5,
    status: 'disabled',
  });
  const adminB1 = await createUser({
    tenantId: tenantB.id,
    branchId: branchB1.id,
    runId,
    key: 'admin-b1',
    name: 'Admin B1',
    role: 'admin',
    phoneOffset: 6,
    bypassCustomerApproval: true,
    bypassLoanApproval: true,
  });
  const agentB1 = await createUser({
    tenantId: tenantB.id,
    branchId: branchB1.id,
    runId,
    key: 'agent-b1',
    name: 'Agent B1',
    role: 'agent',
    phoneOffset: 7,
  });

  const routeA1 = await prisma.route.create({
    data: {
      tenantId: tenantA.id,
      branchId: branchA1.id,
      name: `${runId} Route A1`,
      assignedAgentId: agentA1.id,
      appType: APP_TYPE,
      status: 'active',
    },
  });
  const routeA2 = await prisma.route.create({
    data: {
      tenantId: tenantA.id,
      branchId: branchA2.id,
      name: `${runId} Route A2`,
      assignedAgentId: agentA2.id,
      appType: APP_TYPE,
      status: 'active',
    },
  });
  const routeB1 = await prisma.route.create({
    data: {
      tenantId: tenantB.id,
      branchId: branchB1.id,
      name: `${runId} Route B1`,
      assignedAgentId: agentB1.id,
      appType: APP_TYPE,
      status: 'active',
    },
  });

  await ignoreMissingSchema(prisma.branchCashAccount.createMany({
    data: [
      { tenantId: tenantA.id, appType: APP_TYPE, branchId: branchA1.id, balance: 1_000_000 },
      { tenantId: tenantA.id, appType: APP_TYPE, branchId: branchA2.id, balance: 1_000_000 },
      { tenantId: tenantB.id, appType: APP_TYPE, branchId: branchB1.id, balance: 1_000_000 },
    ],
  }));
  await ignoreMissingSchema(prisma.agentAccount.createMany({
    data: [
      { tenantId: tenantA.id, appType: APP_TYPE, agentId: agentA1.id, balance: 1_000_000 },
      { tenantId: tenantA.id, appType: APP_TYPE, agentId: agentA2.id, balance: 1_000_000 },
      { tenantId: tenantB.id, appType: APP_TYPE, agentId: agentB1.id, balance: 1_000_000 },
    ],
  }));

  const packageA = await prisma.loanPackage.create({
    data: {
      tenantId: tenantA.id,
      name: `${runId} Daily Package`,
      principal: 10000,
      deduction: 100,
      deductionType: 'upfront_fixed',
      frequency: 'daily',
      tenure: 10,
      perInstalment: 1000,
      penaltyRate: 10,
      appType: APP_TYPE,
      status: 'active',
    },
  });

  return {
    runId,
    password: TEST_PASSWORD,
    tenantA: { id: tenantA.id, slug: tenantA.slug },
    tenantB: { id: tenantB.id, slug: tenantB.slug },
    branchA1: { id: branchA1.id },
    branchA2: { id: branchA2.id },
    branchB1: { id: branchB1.id },
    routeA1: { id: routeA1.id },
    routeA2: { id: routeA2.id },
    routeB1: { id: routeB1.id },
    users: { adminA1, adminA2, agentA1, agentA2, disabledA1, adminB1, agentB1 },
    packageA: { id: packageA.id },
  };
}

export async function createCustomerFixture(
  scenario: ZoloFundScenario,
  input: {
    key: string;
    branchId?: string;
    routeId?: string;
    agentId?: string;
    tenantId?: string;
    status?: string;
    phoneOffset: number;
    appType?: string;
  },
) {
  const prisma = getPrisma();
  const customer = {
    id: `${scenario.runId}-customer-${input.key}`,
    tenantId: input.tenantId ?? scenario.tenantA.id,
    branchId: input.branchId ?? scenario.branchA1.id,
    routeId: input.routeId ?? scenario.routeA1.id,
    agentId: input.agentId ?? scenario.users.agentA1.id,
    customerCode: `${scenario.runId}-CUS-${input.key}`,
    name: `${scenario.runId} Customer ${input.key}`,
    phone: phone(scenario.runId, input.phoneOffset),
    address: `${scenario.runId} Address ${input.key}`,
    status: input.status ?? 'active',
    appType: input.appType ?? APP_TYPE,
    kycStatus: 'pending',
    pan: `${scenario.runId}-${input.key}-PAN`.toUpperCase().slice(0, 20),
  };

  const columns = await prisma.$queryRaw<Array<{ Field: string }>>`SHOW COLUMNS FROM customers`;
  const existingColumns = new Set(columns.map((column) => column.Field));
  const values: Record<string, unknown> = {
    id: customer.id,
    tenant_id: customer.tenantId,
    branch_id: customer.branchId,
    route_id: customer.routeId,
    agent_id: customer.agentId,
    customer_code: customer.customerCode,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    status: customer.status,
    app_type: customer.appType,
    kyc_status: customer.kycStatus,
    pan: customer.pan,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const insertColumns = Object.keys(values).filter((column) => existingColumns.has(column));
  const placeholders = insertColumns.map(() => '?').join(', ');
  const quotedColumns = insertColumns.map((column) => `\`${column}\``).join(', ');
  await prisma.$executeRawUnsafe(
    `INSERT INTO customers (${quotedColumns}) VALUES (${placeholders})`,
    ...insertColumns.map((column) => values[column]),
  );

  return customer;
}

export async function createLoanFixture(
  scenario: ZoloFundScenario,
  input: {
    key: string;
    customerId: string;
    branchId?: string;
    createdById?: string;
    tenantId?: string;
    status?: string;
    principal?: number;
    tenure?: number;
  },
) {
  const prisma = getPrisma();
  const principal = input.principal ?? 6000;
  const tenure = input.tenure ?? 6;
  const startDate = new Date('2026-01-01T00:00:00.000Z');
  const preview = calculateLoanPreview({
    principal,
    interestType: 'upfront_fixed',
    interestRate: 0,
    tenure,
    frequency: 'daily',
    startDate,
  });

  return prisma.loan.create({
    data: {
      tenantId: input.tenantId ?? scenario.tenantA.id,
      branchId: input.branchId ?? scenario.branchA1.id,
      appType: APP_TYPE,
      loanCode: `${scenario.runId}-LN-${input.key}`,
      customerId: input.customerId,
      loanType: 'cheque',
      principal,
      deduction: preview.deduction,
      deductionType: 'upfront_fixed',
      disbursed: preview.disbursedAmount,
      frequency: 'daily',
      tenure,
      startDate,
      endDate: new Date(preview.schedule[preview.schedule.length - 1].dueDate),
      perInstalment: preview.perInstalment,
      penaltyRate: 0,
      totalPayable: preview.totalPayable,
      totalInstalments: tenure,
      createdById: input.createdById ?? scenario.users.adminA1.id,
      status: input.status ?? 'active',
      instalments: {
        create: preview.schedule.map((item) => ({
          instalmentNo: item.instalmentNo,
          dueDate: new Date(item.dueDate),
          dueAmount: item.dueAmount,
          status: 'upcoming',
        })),
      },
    },
    include: { instalments: true },
  });
}
