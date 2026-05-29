import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const prisma = new PrismaClient();

// ── Avatar PNG generator ──────────────────────────────────────────────────────
// Creates a 64×64 PNG with a coloured circle on white background (no deps needed)
function crc32(buf: Buffer): number {
  let c = 0xFFFFFFFF;
  for (const b of buf) { c ^= b; for (let j = 0; j < 8; j++) c = (c & 1) ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function circleAvatarPng(r: number, g: number, b: number): Buffer {
  const SIZE = 64;
  const RADIUS = 28;
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const rows: Buffer[] = [];
  for (let y = 0; y < SIZE; y++) {
    const row = Buffer.alloc(1 + SIZE * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < SIZE; x++) {
      const d = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2);
      if (d < RADIUS) {
        row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b;
      } else {
        row[1 + x * 3] = 245; row[2 + x * 3] = 245; row[3 + x * 3] = 245; // light grey bg
      }
    }
    rows.push(row);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(SIZE, 0); ihdrData.writeUInt32BE(SIZE, 4);
  ihdrData[8] = 8; ihdrData[9] = 2; // 8-bit RGB
  const idat = zlib.deflateSync(Buffer.concat(rows));
  return Buffer.concat([sig, pngChunk('IHDR', ihdrData), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// 5 avatar colours: orange, blue, green, purple, teal
const AVATAR_COLORS: [number, number, number][] = [
  [243, 156,  18],  // orange
  [ 52, 152, 219],  // blue
  [ 46, 204, 113],  // green
  [155,  89, 182],  // purple
  [ 26, 188, 156],  // teal
];

// Reference date – matches current seeding context
const TODAY = new Date('2026-05-28');

// ── Date helpers ──────────────────────────────────────────────────────────────
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

type Freq = 'daily' | 'weekly' | 'monthly';

function dueAt(start: Date, n: number, freq: Freq): Date {
  if (freq === 'daily')   return addDays(start, n - 1);
  if (freq === 'weekly')  return addDays(start, (n - 1) * 7);
  return addMonths(start, n - 1);
}

// ── Instalment builder ───────────────────────────────────────────────────────
interface InstalmentRow {
  loanId: string;
  instalmentNo: number;
  dueDate: Date;
  dueAmount: number;
  receivedAmount: number;
  status: string;
  agentId: string | null;
  receivedAt: Date | null;
  paymentMode: string | null;
}

function buildInstalments(
  loanId: string,
  start: Date,
  tenure: number,
  freq: Freq,
  perInstalment: number,
  agentId: string,
  allPaid = false,
): InstalmentRow[] {
  return Array.from({ length: tenure }, (_, i) => {
    const n = i + 1;
    const due = dueAt(start, n, freq);
    const paid = allPaid || due < TODAY;
    return {
      loanId,
      instalmentNo: n,
      dueDate: due,
      dueAmount: perInstalment,
      receivedAmount: paid ? perInstalment : 0,
      status: paid ? 'paid' : 'upcoming',
      agentId: paid ? agentId : null,
      receivedAt: paid ? due : null,
      paymentMode: paid ? 'cash' : null,
    };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding database...');

  // ── Tenant ──────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: { name: 'LoanTrack', slug: 'default', status: 'active' },
  });
  console.log('✅ Tenant:', tenant.id);

  // ── Write avatar images to upload directory ───────────────────────────────
  const uploadDir = path.join(process.cwd(), 'private', 'uploads', tenant.id, 'profiles');
  fs.mkdirSync(uploadDir, { recursive: true });
  const avatarFilenames: string[] = [];
  for (let i = 0; i < 5; i++) {
    const [r, g, b] = AVATAR_COLORS[i];
    const filename = `seed-avatar-${i + 1}.png`;
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, circleAvatarPng(r, g, b));
    }
    avatarFilenames.push(filename);
  }
  console.log('✅ Avatar images written');

  // ── Subscription ────────────────────────────────────────────────────────────
  await prisma.tenantSubscription.upsert({
    where: { tenantId: tenant.id },
    update: { npaEnabled: true },
    create: {
      tenantId: tenant.id,
      plan: 'pro',
      status: 'active',
      maxActiveLoans: 500,
      maxAgents: 20,
      maxBranches: 10,
      enabledModules: JSON.stringify(['microlending', 'autofinance', 'chitfunds']),
      whatsappSmsEnabled: true,
      receiptPdfAllowed: true,
      bureauEnabled: false,
      npaEnabled: true,
      foreclosureEnabled: true,
      kycEnabled: false,
      gpsTrackingEnabled: false,
      premiumAccountingEnabled: false,
    },
  });

  // ── Branch ───────────────────────────────────────────────────────────────────
  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'HQ' } },
    update: { enabledModules: JSON.stringify(['microlending']) },
    create: {
      tenantId: tenant.id,
      name: 'Head Office',
      code: 'HQ',
      address: 'Main Branch',
      status: 'active',
      enabledModules: JSON.stringify(['microlending']),
    },
  });
  console.log('✅ Branch:', branch.id);

  // ── Users ────────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'admin' } },
    update: { passwordHash: await hash('admin123', 12) },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Admin User',
      phone: '9800000000',
      username: 'admin',
      passwordHash: await hash('admin123', 12),
      role: 'admin',
      status: 'active',
    },
  });

  const agent1 = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'karthik' } },
    update: { passwordHash: await hash('agent123', 12) },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Karthik Rajan',
      phone: '9876543210',
      username: 'karthik',
      passwordHash: await hash('agent123', 12),
      role: 'agent',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'developer' } },
    update: { passwordHash: await hash('dev123', 12) },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Developer',
      phone: '9000000001',
      username: 'developer',
      passwordHash: await hash('dev123', 12),
      role: 'developer',
      status: 'active',
    },
  });

  const superadmin = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'superadmin' } },
    update: { passwordHash: await hash('super123', 12) },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Super Admin',
      phone: '9998887776',
      username: 'superadmin',
      passwordHash: await hash('super123', 12),
      role: 'superadmin',
      status: 'active',
    },
  });

  await prisma.branch.update({
    where: { id: branch.id },
    data: { superadminId: superadmin.id },
  });
  console.log('✅ Users created');

  // ── Extra branches ────────────────────────────────────────────────────────────
  const erodeBranch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ERODE' } },
    update: { superadminId: superadmin.id, enabledModules: JSON.stringify(['autofinance', 'chitfunds']) },
    create: {
      tenantId: tenant.id,
      superadminId: superadmin.id,
      name: 'Erode',
      code: 'ERODE',
      enabledModules: JSON.stringify(['autofinance', 'chitfunds']),
      status: 'active',
    },
  });
  const namakkalBranch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'NAMAKKAL' } },
    update: { superadminId: superadmin.id, enabledModules: JSON.stringify(['microlending']) },
    create: {
      tenantId: tenant.id,
      superadminId: superadmin.id,
      name: 'Namakkal',
      code: 'NAMAKKAL',
      enabledModules: JSON.stringify(['microlending']),
      status: 'active',
    },
  });
  console.log('✅ Extra branches:', erodeBranch.id, namakkalBranch.id);

  // ── Routes ────────────────────────────────────────────────────────────────────
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

  // ── App settings ──────────────────────────────────────────────────────────────
  const defaultSettings: { key: string; value: string; group: string }[] = [
    { key: 'app_name',                value: 'LoanTrack',                     group: 'branding' },
    { key: 'app_tagline',             value: 'Micro-Lending Management System', group: 'branding' },
    { key: 'logo_url',                value: '/assets/logo.svg',              group: 'branding' },
    { key: 'primary_color',           value: '#F5A623',                       group: 'branding' },
    { key: 'primary_dark',            value: '#E8930C',                       group: 'branding' },
    { key: 'timezone',                value: 'Asia/Kolkata',                  group: 'system'   },
    { key: 'currency',                value: 'INR',                           group: 'system'   },
    { key: 'currency_symbol',         value: '₹',                             group: 'system'   },
    { key: 'date_format',             value: 'dd MMM yyyy',                   group: 'system'   },
    { key: 'midnight_cutoff',         value: 'true',                          group: 'system'   },
    { key: 'allow_weekend_collection',value: 'false',                         group: 'system'   },
    { key: 'default_penalty_per_day', value: '50',                            group: 'penalty'  },
    { key: 'penalty_grace_period',    value: '0',                             group: 'penalty'  },
    { key: 'penalty_max_cap',         value: '0',                             group: 'penalty'  },
    { key: 'customer_code_prefix',    value: 'CUS',                           group: 'general'  },
    { key: 'loan_code_prefix',        value: 'LN',                            group: 'general'  },
    // Counters reflect seeded data
    { key: 'customer_code_counter',   value: '20',                            group: 'general'  },
    { key: 'loan_code_counter',       value: '0',                             group: 'general'  },
    { key: 'loan_prefix_daily',       value: 'DL',                            group: 'general'  },
    { key: 'loan_prefix_weekly',      value: 'WK',                            group: 'general'  },
    { key: 'loan_prefix_biweekly',    value: 'BW',                            group: 'general'  },
    { key: 'loan_prefix_monthly',     value: 'ML',                            group: 'general'  },
    { key: 'loan_counter_daily',      value: '12',                            group: 'general'  },
    { key: 'loan_counter_weekly',     value: '11',                            group: 'general'  },
    { key: 'loan_counter_biweekly',   value: '0',                             group: 'general'  },
    { key: 'loan_counter_monthly',    value: '11',                            group: 'general'  },
  ];

  for (const s of defaultSettings) {
    await prisma.appSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: s.key } },
      update: { value: s.value },
      create: { tenantId: tenant.id, key: s.key, value: s.value, group: s.group },
    });
  }
  console.log('✅ App settings created');

  // ── Loan packages ─────────────────────────────────────────────────────────────
  const packages = [
    { name: 'Standard 100-Day Daily',  principal: 30000,  deduction: 3000, frequency: 'daily',   tenure: 100, perInstalment: 300,  penaltyRate: 50  },
    { name: 'Premium 100-Day Daily',   principal: 50000,  deduction: 5000, frequency: 'daily',   tenure: 100, perInstalment: 500,  penaltyRate: 100 },
    { name: 'Weekly 20-Week',          principal: 20000,  deduction: 2000, frequency: 'weekly',  tenure: 20,  perInstalment: 1000, penaltyRate: 200 },
    { name: 'Monthly 10-Month',        principal: 25000,  deduction: 2500, frequency: 'monthly', tenure: 10,  perInstalment: 2500, penaltyRate: 500 },
  ];
  for (const pkg of packages) {
    const existing = await prisma.loanPackage.findFirst({ where: { tenantId: tenant.id, name: pkg.name } });
    if (!existing) {
      await prisma.loanPackage.create({
        data: { tenantId: tenant.id, ...pkg, status: 'active' },
      });
    }
  }
  console.log('✅ Loan packages created');

  // ── Notification templates ────────────────────────────────────────────────────
  const templates = [
    { name: 'payment_reminder', channel: 'sms',      body: 'Dear {{customer_name}}, your payment of {{currency_symbol}}{{amount}} for loan {{loan_code}} is due today.' },
    { name: 'payment_reminder', channel: 'whatsapp', body: 'Hi {{customer_name}} 👋\nYour payment of {{currency_symbol}}{{amount}} for loan *{{loan_code}}* is due today.' },
    { name: 'overdue_alert',    channel: 'sms',      body: 'ALERT: Dear {{customer_name}}, your payment for loan {{loan_code}} is overdue by {{days}} days. Penalty: {{currency_symbol}}{{penalty}}.' },
    { name: 'loan_created',     channel: 'sms',      body: 'Dear {{customer_name}}, your loan {{loan_code}} of {{currency_symbol}}{{principal}} has been approved. Starts {{start_date}}. Per instalment: {{currency_symbol}}{{per_instalment}}.' },
  ];
  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { tenantId_name_channel: { tenantId: tenant.id, name: t.name, channel: t.channel } },
      update: {},
      create: { tenantId: tenant.id, name: t.name, channel: t.channel, body: t.body, isActive: true },
    });
  }
  console.log('✅ Notification templates created');

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLEAR EXISTING CUSTOMER / LOAN DATA
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('🗑️  Clearing existing customers & loans...');
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;

  const existingLoans = await prisma.loan.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
  const loanIds = existingLoans.map((l) => l.id);

  if (loanIds.length > 0) {
    await prisma.instalment.deleteMany({ where: { loanId: { in: loanIds } } });
    await prisma.penalty.deleteMany({ where: { loanId: { in: loanIds } } });
    await prisma.collectionEntry.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.dailyCollection.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.loan.deleteMany({ where: { tenantId: tenant.id } });
  }
  await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });

  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
  console.log('✅ Cleared');

  // ═══════════════════════════════════════════════════════════════════════════════
  // CUSTOMERS  (20 customers across 4 routes)
  // Route assignment: Erode → 1-5, Chithode → 6-10, Gobichettipalayam → 11-15, Bhavani → 16-20
  // ═══════════════════════════════════════════════════════════════════════════════
  const customerDefs = [
    // Erode route
    { code: 'CUS0001', name: 'Karthik',       phone: '9700000001', route: 'route-erode'              },
    { code: 'CUS0002', name: 'Arul',           phone: '9700000002', route: 'route-erode'              },
    { code: 'CUS0003', name: 'Kavin',          phone: '9700000003', route: 'route-erode'              },
    { code: 'CUS0004', name: 'Surya',          phone: '9700000004', route: 'route-erode'              },
    { code: 'CUS0005', name: 'Velan',          phone: '9700000005', route: 'route-erode'              },
    // Chithode route
    { code: 'CUS0006', name: 'Iniyan',         phone: '9700000006', route: 'route-chithode'           },
    { code: 'CUS0007', name: 'Pranav',         phone: '9700000007', route: 'route-chithode'           },
    { code: 'CUS0008', name: 'Sarvesh',        phone: '9700000008', route: 'route-chithode'           },
    { code: 'CUS0009', name: 'Tharun',         phone: '9700000009', route: 'route-chithode'           },
    { code: 'CUS0010', name: 'Ilango',         phone: '9700000010', route: 'route-chithode'           },
    // Gobichettipalayam route
    { code: 'CUS0011', name: 'Thamizharasan',  phone: '9700000011', route: 'route-gobichettipalayam'  },
    { code: 'CUS0012', name: 'Kabilan',        phone: '9700000012', route: 'route-gobichettipalayam'  },
    { code: 'CUS0013', name: 'Krishna',        phone: '9700000013', route: 'route-gobichettipalayam'  },
    { code: 'CUS0014', name: 'Kumar',          phone: '9700000014', route: 'route-gobichettipalayam'  },
    { code: 'CUS0015', name: 'Madhav',         phone: '9700000015', route: 'route-gobichettipalayam'  },
    // Bhavani route
    { code: 'CUS0016', name: 'Mohan',          phone: '9700000016', route: 'route-bhavani'            },
    { code: 'CUS0017', name: 'Naveen',         phone: '9700000017', route: 'route-bhavani'            },
    { code: 'CUS0018', name: 'Prakash',        phone: '9700000018', route: 'route-bhavani'            },
    { code: 'CUS0019', name: 'Rajesh',         phone: '9700000019', route: 'route-bhavani'            },
    { code: 'CUS0020', name: 'Ramesh',         phone: '9700000020', route: 'route-bhavani'            },
  ];

  const customerMap: Record<string, string> = {};
  for (let idx = 0; idx < customerDefs.length; idx++) {
    const c = customerDefs[idx];
    const avatarFile = avatarFilenames[idx % 5];
    const profilePhoto = `/api/files/${tenant.id}/profiles/${avatarFile}`;
    const created = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        customerCode: c.code,
        name: c.name,
        phone: c.phone,
        routeId: c.route,
        agentId: agent1.id,
        status: 'active',
        appType: 'microlending',
        kycStatus: 'pending',
        profilePhoto,
      },
    });
    customerMap[c.name] = created.id;
  }
  console.log('✅ 20 customers created');

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOANS
  // Format: DL = daily, WK = weekly, ML = monthly
  // loanCode pattern: prefix + padStart(4, '0')  e.g. DL0001
  //
  // ACTIVE (22 loans – "in progress")
  // CLOSED (12 loans – all instalments paid, early dates)
  //
  // Deduction = 10% of principal; disbursed = principal - deduction
  // ═══════════════════════════════════════════════════════════════════════════════

  interface LoanDef {
    code: string;
    customer: string;
    principal: number;
    deduction: number;
    freq: Freq;
    tenure: number;
    perInstalment: number;
    penaltyRate: number;
    startDate: Date;
    status: 'active' | 'closed';
  }

  const loanDefs: LoanDef[] = [
    // ── ACTIVE DAILY LOANS (100-day, started 10–50 days ago) ──────────────────
    { code: 'DL0001', customer: 'Karthik',      principal: 10000, deduction: 1000, freq: 'daily', tenure: 100, perInstalment: 100,  penaltyRate: 50,  startDate: new Date('2026-04-08'), status: 'active' },
    { code: 'DL0002', customer: 'Arul',          principal: 20000, deduction: 2000, freq: 'daily', tenure: 100, perInstalment: 200,  penaltyRate: 50,  startDate: new Date('2026-04-18'), status: 'active' },
    { code: 'DL0003', customer: 'Iniyan',        principal: 20000, deduction: 2000, freq: 'daily', tenure: 100, perInstalment: 200,  penaltyRate: 50,  startDate: new Date('2026-04-28'), status: 'active' },
    { code: 'DL0004', customer: 'Tharun',        principal: 20000, deduction: 2000, freq: 'daily', tenure: 100, perInstalment: 200,  penaltyRate: 50,  startDate: new Date('2026-05-03'), status: 'active' },
    { code: 'DL0005', customer: 'Ilango',        principal: 15000, deduction: 1500, freq: 'daily', tenure: 100, perInstalment: 150,  penaltyRate: 50,  startDate: new Date('2026-05-13'), status: 'active' },
    { code: 'DL0006', customer: 'Kumar',         principal: 30000, deduction: 3000, freq: 'daily', tenure: 100, perInstalment: 300,  penaltyRate: 50,  startDate: new Date('2026-05-18'), status: 'active' },
    { code: 'DL0007', customer: 'Mohan',         principal: 10000, deduction: 1000, freq: 'daily', tenure: 100, perInstalment: 100,  penaltyRate: 50,  startDate: new Date('2026-04-23'), status: 'active' },

    // ── ACTIVE WEEKLY LOANS (20-week, started 3–9 weeks ago) ──────────────────
    { code: 'WK0001', customer: 'Pranav',        principal: 10000, deduction: 1000, freq: 'weekly', tenure: 20, perInstalment: 500,  penaltyRate: 100, startDate: new Date('2026-04-10'), status: 'active' },
    { code: 'WK0002', customer: 'Sarvesh',       principal: 75000, deduction: 7500, freq: 'weekly', tenure: 20, perInstalment: 3750, penaltyRate: 200, startDate: new Date('2026-04-24'), status: 'active' },
    { code: 'WK0003', customer: 'Kabilan',       principal: 15000, deduction: 1500, freq: 'weekly', tenure: 20, perInstalment: 750,  penaltyRate: 100, startDate: new Date('2026-05-01'), status: 'active' },
    { code: 'WK0004', customer: 'Krishna',       principal: 25000, deduction: 2500, freq: 'weekly', tenure: 20, perInstalment: 1250, penaltyRate: 100, startDate: new Date('2026-04-17'), status: 'active' },
    { code: 'WK0005', customer: 'Madhav',        principal: 40000, deduction: 4000, freq: 'weekly', tenure: 20, perInstalment: 2000, penaltyRate: 200, startDate: new Date('2026-05-07'), status: 'active' },
    { code: 'WK0006', customer: 'Prakash',       principal: 15000, deduction: 1500, freq: 'weekly', tenure: 20, perInstalment: 750,  penaltyRate: 100, startDate: new Date('2026-03-27'), status: 'active' },
    { code: 'WK0007', customer: 'Rajesh',        principal: 20000, deduction: 2000, freq: 'weekly', tenure: 20, perInstalment: 1000, penaltyRate: 100, startDate: new Date('2026-05-01'), status: 'active' },

    // ── ACTIVE MONTHLY LOANS (10-month, started 1–4 months ago) ───────────────
    { code: 'ML0001', customer: 'Kavin',         principal: 50000, deduction: 5000, freq: 'monthly', tenure: 10, perInstalment: 5000,  penaltyRate: 500, startDate: new Date('2026-02-28'), status: 'active' },
    { code: 'ML0002', customer: 'Surya',         principal: 25000, deduction: 2500, freq: 'monthly', tenure: 10, perInstalment: 2500,  penaltyRate: 500, startDate: new Date('2026-03-28'), status: 'active' },
    { code: 'ML0003', customer: 'Surya',         principal: 25000, deduction: 2500, freq: 'monthly', tenure: 10, perInstalment: 2500,  penaltyRate: 500, startDate: new Date('2026-04-28'), status: 'active' },
    { code: 'ML0004', customer: 'Velan',         principal: 100000,deduction:10000, freq: 'monthly', tenure: 10, perInstalment: 10000, penaltyRate: 500, startDate: new Date('2026-03-28'), status: 'active' },
    { code: 'ML0005', customer: 'Thamizharasan', principal: 50000, deduction: 5000, freq: 'monthly', tenure: 10, perInstalment: 5000,  penaltyRate: 500, startDate: new Date('2026-01-28'), status: 'active' },
    { code: 'ML0006', customer: 'Naveen',        principal: 35000, deduction: 3500, freq: 'monthly', tenure: 10, perInstalment: 3500,  penaltyRate: 500, startDate: new Date('2026-04-28'), status: 'active' },
    { code: 'ML0007', customer: 'Ramesh',        principal: 10000, deduction: 1000, freq: 'monthly', tenure: 10, perInstalment: 1000,  penaltyRate: 200, startDate: new Date('2026-03-28'), status: 'active' },
    { code: 'ML0008', customer: 'Ramesh',        principal: 10000, deduction: 1000, freq: 'monthly', tenure: 10, perInstalment: 1000,  penaltyRate: 200, startDate: new Date('2026-04-28'), status: 'active' },

    // ── CLOSED DAILY LOANS (all paid, started 8–11 months ago) ────────────────
    { code: 'DL0008', customer: 'Arul',          principal: 15000, deduction: 1500, freq: 'daily', tenure: 100, perInstalment: 150,  penaltyRate: 50,  startDate: new Date('2025-08-20'), status: 'closed' },
    { code: 'DL0009', customer: 'Krishna',       principal: 15000, deduction: 1500, freq: 'daily', tenure: 100, perInstalment: 150,  penaltyRate: 50,  startDate: new Date('2025-08-01'), status: 'closed' },
    { code: 'DL0010', customer: 'Mohan',         principal: 8000,  deduction: 800,  freq: 'daily', tenure: 100, perInstalment: 80,   penaltyRate: 50,  startDate: new Date('2025-07-15'), status: 'closed' },
    { code: 'DL0011', customer: 'Rajesh',        principal: 10000, deduction: 1000, freq: 'daily', tenure: 100, perInstalment: 100,  penaltyRate: 50,  startDate: new Date('2025-06-01'), status: 'closed' },
    { code: 'DL0012', customer: 'Ramesh',        principal: 8000,  deduction: 800,  freq: 'daily', tenure: 100, perInstalment: 80,   penaltyRate: 50,  startDate: new Date('2025-07-15'), status: 'closed' },

    // ── CLOSED WEEKLY LOANS (all paid, started 7–11 months ago) ───────────────
    { code: 'WK0008', customer: 'Pranav',        principal: 8000,  deduction: 800,  freq: 'weekly', tenure: 20, perInstalment: 400,  penaltyRate: 100, startDate: new Date('2025-07-01'), status: 'closed' },
    { code: 'WK0009', customer: 'Sarvesh',       principal: 40000, deduction: 4000, freq: 'weekly', tenure: 20, perInstalment: 2000, penaltyRate: 200, startDate: new Date('2025-06-01'), status: 'closed' },
    { code: 'WK0010', customer: 'Prakash',       principal: 12000, deduction: 1200, freq: 'weekly', tenure: 20, perInstalment: 600,  penaltyRate: 100, startDate: new Date('2025-07-01'), status: 'closed' },
    { code: 'WK0011', customer: 'Ramesh',        principal: 12000, deduction: 1200, freq: 'weekly', tenure: 20, perInstalment: 600,  penaltyRate: 100, startDate: new Date('2025-09-01'), status: 'closed' },

    // ── CLOSED MONTHLY LOANS (all paid, started 10–14 months ago) ─────────────
    { code: 'ML0009', customer: 'Krishna',       principal: 20000, deduction: 2000, freq: 'monthly', tenure: 10, perInstalment: 2000, penaltyRate: 500, startDate: new Date('2025-05-01'), status: 'closed' },
    { code: 'ML0010', customer: 'Rajesh',        principal: 15000, deduction: 1500, freq: 'monthly', tenure: 10, perInstalment: 1500, penaltyRate: 500, startDate: new Date('2025-05-01'), status: 'closed' },
    { code: 'ML0011', customer: 'Surya',         principal: 15000, deduction: 1500, freq: 'monthly', tenure: 10, perInstalment: 1500, penaltyRate: 500, startDate: new Date('2025-04-01'), status: 'closed' },
  ];

  let loanCount = 0;
  let instalmentCount = 0;

  for (const def of loanDefs) {
    const customerId = customerMap[def.customer];
    if (!customerId) {
      console.warn(`⚠️  Customer not found: ${def.customer}`);
      continue;
    }

    const lastInstalment = dueAt(def.startDate, def.tenure, def.freq);
    const allPaid = def.status === 'closed';

    // Count how many paid for status tracking
    let paidCount = 0;
    if (allPaid) {
      paidCount = def.tenure;
    } else {
      for (let i = 1; i <= def.tenure; i++) {
        if (dueAt(def.startDate, i, def.freq) < TODAY) paidCount++;
        else break;
      }
    }

    const totalCollected = paidCount * def.perInstalment;
    const totalPayable = def.tenure * def.perInstalment;

    const loan = await prisma.loan.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        loanCode: def.code,
        customerId,
        loanType: 'cheque',
        appType: 'microlending',
        principal: def.principal,
        deduction: def.deduction,
        disbursed: def.principal - def.deduction,
        frequency: def.freq,
        tenure: def.tenure,
        totalInstalments: def.tenure,
        startDate: def.startDate,
        endDate: lastInstalment,
        perInstalment: def.perInstalment,
        penaltyRate: def.penaltyRate,
        status: def.status,
        paidCount,
        totalCollected,
        totalPayable,
        createdById: admin.id,
        ...(allPaid ? {
          closedAt: lastInstalment,
          closureType: 'completed',
        } : {}),
      },
    });
    loanCount++;

    // Create instalments
    const rows = buildInstalments(
      loan.id,
      def.startDate,
      def.tenure,
      def.freq,
      def.perInstalment,
      agent1.id,
      allPaid,
    );

    await prisma.instalment.createMany({ data: rows });
    instalmentCount += rows.length;
  }

  console.log(`✅ ${loanCount} loans created (${loanDefs.filter(l => l.status === 'active').length} active, ${loanDefs.filter(l => l.status === 'closed').length} closed)`);
  console.log(`✅ ${instalmentCount} instalments created`);

  console.log('\n🎉 Seeding complete!');
  console.log('────────────────────────────────────────────');
  console.log('Admin login:      admin / admin123');
  console.log('Agent login:      karthik / agent123');
  console.log('Developer login:  developer / dev123');
  console.log('Superadmin login: superadmin / super123');
  console.log('────────────────────────────────────────────');
  console.log('Customers: 20  |  Active loans: 22  |  Closed loans: 12');
  console.log('Daily: DL0001-DL0012  |  Weekly: WK0001-WK0011  |  Monthly: ML0001-ML0011');
  console.log('────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
