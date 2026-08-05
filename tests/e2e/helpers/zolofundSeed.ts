import { hash } from 'bcryptjs';
import { calculateLoanPreview } from '../../../lib/loanCalculator';
import { cleanupRunData } from '../../e2e-business/helpers/cleanup';
import { APP_TYPE, getPrisma, getRunId, requireTestDatabaseUrl, TEST_PASSWORD } from '../../e2e-business/helpers/testDb';

export type ZoloFundUiSeed = {
  runId: string;
  password: string;
  tenant: { id: string; slug: string };
  branch: { id: string };
  route: { id: string };
  admin: { id: string; username: string; name: string };
  agent: { id: string; username: string; name: string };
  customer: { id: string; customerCode: string; name: string; phone: string };
  pendingCustomer: { id: string; customerCode: string; name: string };
  loan: { id: string; loanCode: string };
};

let cachedSeed: ZoloFundUiSeed | null = null;

function numericSeed(runId: string) {
  return runId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 800_000_000;
}

function phone(runId: string, offset: number) {
  return `7${String(numericSeed(runId) + offset).padStart(9, '0')}`.slice(0, 10);
}

async function tableColumns(table: string) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM \`${table}\``);
  return new Set(rows.map((row) => row.Field));
}

async function insertExisting(table: string, values: Record<string, unknown>) {
  const prisma = getPrisma();
  const columns = await tableColumns(table);
  const insertColumns = Object.keys(values).filter((column) => columns.has(column));
  const quotedColumns = insertColumns.map((column) => `\`${column}\``).join(', ');
  const placeholders = insertColumns.map(() => '?').join(', ');
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${table}\` (${quotedColumns}) VALUES (${placeholders})`,
    ...insertColumns.map((column) => values[column]),
  );
}

async function optional(operation: Promise<unknown>) {
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

async function seedUser(input: {
  runId: string;
  tenantId: string;
  branchId: string;
  key: string;
  name: string;
  role: 'admin' | 'agent';
  phoneOffset: number;
}) {
  const id = `${input.runId}-ui-user-${input.key}`;
  const username = `${input.runId}-ui-${input.key}`;
  await insertExisting('users', {
    id,
    tenant_id: input.tenantId,
    branch_id: input.branchId,
    name: `${input.runId} ${input.name}`,
    phone: phone(input.runId, input.phoneOffset),
    email: `${input.runId}-ui-${input.key}@example.test`,
    username,
    password_hash: await hash(TEST_PASSWORD, 4),
    role: input.role,
    app_type: APP_TYPE,
    status: 'active',
    bypass_customer_approval: input.role === 'admin',
    bypass_loan_approval: input.role === 'admin',
    created_at: new Date(),
    updated_at: new Date(),
  });
  return { id, username, name: `${input.runId} ${input.name}` };
}

async function seedCustomer(input: {
  runId: string;
  tenantId: string;
  branchId: string;
  routeId: string;
  agentId: string;
  key: string;
  status: string;
  phoneOffset: number;
  withBorrowerPassword?: boolean;
}) {
  const id = `${input.runId}-ui-customer-${input.key}`;
  const customerCode = `${input.runId}-UI-CUS-${input.key}`;
  const name = `${input.runId} UI Customer ${input.key}`;
  const customerPhone = phone(input.runId, input.phoneOffset);
  await insertExisting('customers', {
    id,
    tenant_id: input.tenantId,
    branch_id: input.branchId,
    route_id: input.routeId,
    agent_id: input.agentId,
    customer_code: customerCode,
    name,
    phone: customerPhone,
    address: `${input.runId} Browser Test Street`,
    status: input.status,
    kyc_status: 'pending',
    app_type: APP_TYPE,
    password_hash: input.withBorrowerPassword ? await hash(TEST_PASSWORD, 4) : null,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return { id, customerCode, name, phone: customerPhone };
}

export async function seedZoloFundUiScenario(runId = getRunId()): Promise<ZoloFundUiSeed> {
  requireTestDatabaseUrl();
  if (cachedSeed?.runId === runId) return cachedSeed;

  const prisma = getPrisma();
  await cleanupRunData(runId);

  const tenant = {
    id: `${runId}-ui-tenant`,
    slug: `${runId}-ui-tenant`.toLowerCase(),
  };
  await insertExisting('tenants', {
    id: tenant.id,
    name: `${runId} UI Tenant`,
    slug: tenant.slug,
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  });
  await insertExisting('tenant_subscriptions', {
    id: `${runId}-ui-subscription`,
    tenant_id: tenant.id,
    plan: 'growth',
    status: 'active',
    max_active_loans: 50,
    max_agents: 10,
    max_branches: 5,
    enabled_modules: JSON.stringify([APP_TYPE]),
    receipt_pdf_allowed: true,
    kyc_enabled: true,
    premium_accounting_enabled: true,
    gps_tracking_enabled: false,
    base_plan_price: 0,
    modules_price: 0,
    addons_price: 0,
    total_monthly_price: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });

  await prisma.appSetting.createMany({
    data: [
      { tenantId: tenant.id, key: 'currency_symbol', value: '₹', group: 'general' },
      { tenantId: tenant.id, key: 'receipt_pdf_active', value: 'true', group: 'payment' },
      { tenantId: tenant.id, key: 'biometric_lock_required', value: 'false', group: 'security' },
    ],
  });

  const branch = await prisma.branch.create({
    data: {
      id: `${runId}-ui-branch`,
      tenantId: tenant.id,
      name: `${runId} UI Branch`,
      code: `${runId}-UI-BR`,
      enabledModules: JSON.stringify([APP_TYPE]),
    },
  });

  const admin = await seedUser({
    runId,
    tenantId: tenant.id,
    branchId: branch.id,
    key: 'admin',
    name: 'UI Admin',
    role: 'admin',
    phoneOffset: 101,
  });
  const agent = await seedUser({
    runId,
    tenantId: tenant.id,
    branchId: branch.id,
    key: 'agent',
    name: 'UI Agent',
    role: 'agent',
    phoneOffset: 102,
  });

  const route = await prisma.route.create({
    data: {
      id: `${runId}-ui-route`,
      tenantId: tenant.id,
      branchId: branch.id,
      name: `${runId} UI Route`,
      assignedAgentId: agent.id,
      appType: APP_TYPE,
      status: 'active',
    },
  });
  await prisma.routeAgent.create({
    data: { routeId: route.id, agentId: agent.id, isPrimary: true },
  });

  const customer = await seedCustomer({
    runId,
    tenantId: tenant.id,
    branchId: branch.id,
    routeId: route.id,
    agentId: agent.id,
    key: 'main',
    status: 'active',
    phoneOffset: 201,
    withBorrowerPassword: true,
  });
  const pendingCustomer = await seedCustomer({
    runId,
    tenantId: tenant.id,
    branchId: branch.id,
    routeId: route.id,
    agentId: agent.id,
    key: 'pending',
    status: 'pending_review',
    phoneOffset: 202,
  });

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const preview = calculateLoanPreview({
    principal: 6000,
    interestType: 'upfront_fixed',
    interestRate: 0,
    tenure: 6,
    frequency: 'daily',
    startDate,
  });
  const loan = await prisma.loan.create({
    data: {
      id: `${runId}-ui-loan`,
      tenantId: tenant.id,
      branchId: branch.id,
      appType: APP_TYPE,
      loanCode: `${runId}-UI-LN-main`,
      customerId: customer.id,
      loanType: 'cheque',
      principal: 6000,
      deduction: preview.deduction,
      deductionType: 'upfront_fixed',
      disbursed: preview.disbursedAmount,
      frequency: 'daily',
      tenure: 6,
      startDate,
      endDate: new Date(preview.schedule[preview.schedule.length - 1].dueDate),
      perInstalment: preview.perInstalment,
      penaltyRate: 0,
      totalPayable: preview.totalPayable,
      totalInstalments: 6,
      createdById: admin.id,
      status: 'active',
      instalments: {
        create: preview.schedule.map((item) => ({
          instalmentNo: item.instalmentNo,
          dueDate: new Date(item.dueDate),
          dueAmount: item.dueAmount,
          status: 'upcoming',
        })),
      },
    },
  });

  const dailyCollection = await prisma.dailyCollection.create({
    data: {
      id: `${runId}-ui-daily-collection`,
      tenantId: tenant.id,
      branchId: branch.id,
      agentId: agent.id,
      routeId: route.id,
      appType: APP_TYPE,
      date: startDate,
      totalExpected: preview.perInstalment,
      totalCollected: 100,
      entriesCount: 1,
      status: 'open',
    },
  });
  await prisma.collectionEntry.create({
    data: {
      id: `${runId}-ui-collection-entry`,
      collectionId: dailyCollection.id,
      tenantId: tenant.id,
      customerId: customer.id,
      loanId: loan.id,
      dueAmount: preview.perInstalment,
      receivedAmount: 100,
      paymentMode: 'cash',
      remarks: `${runId} UI visibility collection`,
      agentId: agent.id,
      submittedAt: new Date(),
      isLocked: true,
      verificationStatus: 'verified',
    },
  });

  await optional(prisma.branchCashAccount.create({
    data: {
      tenantId: tenant.id,
      appType: APP_TYPE,
      branchId: branch.id,
      balance: 100000,
    },
  }));
  await optional(prisma.agentAccount.create({
    data: {
      tenantId: tenant.id,
      appType: APP_TYPE,
      agentId: agent.id,
      balance: 100,
    },
  }));
  await optional(prisma.cashHandover.create({
    data: {
      id: `${runId}-ui-handover`,
      tenantId: tenant.id,
      agentId: agent.id,
      routeId: route.id,
      amount: 100,
      status: 'pending',
      remarks: `${runId} UI handover visibility`,
    },
  }));

  cachedSeed = {
    runId,
    password: TEST_PASSWORD,
    tenant,
    branch: { id: branch.id },
    route: { id: route.id },
    admin,
    agent,
    customer,
    pendingCustomer,
    loan: { id: loan.id, loanCode: loan.loanCode },
  };
  return cachedSeed;
}

export async function cleanupZoloFundUiScenario(runId = getRunId()) {
  cachedSeed = null;
  await cleanupRunData(runId);
}
