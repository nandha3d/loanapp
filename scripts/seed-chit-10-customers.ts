import prisma from '../lib/db';

const CHIT_CUSTOMERS_HQ = [
  {
    code: 'CHIT-HQ-01',
    name: 'Rajesh Kumar Sharma',
    phone: '9841011101',
    email: 'rajesh.sharma@example.com',
    address: '14, Anna Salai, T. Nagar, Chennai - 600017',
    occupation: 'Textile Merchant',
    monthlyIncome: 85000,
    pan: 'ABCDE1234F',
    designation: 'Proprietor',
    companyName: 'Sharma Silks & Sarees',
  },
  {
    code: 'CHIT-HQ-02',
    name: 'Priya Sundaram',
    phone: '9841011102',
    email: 'priya.sundaram@example.com',
    address: '28, CP Ramaswamy Road, Alwarpet, Chennai - 600018',
    occupation: 'Software Architect',
    monthlyIncome: 140000,
    pan: 'BNMPS5678G',
    designation: 'Lead Architect',
    companyName: 'TechSolutions India',
  },
  {
    code: 'CHIT-HQ-03',
    name: 'Suresh Balasubramanian',
    phone: '9841011103',
    email: 'suresh.bala@example.com',
    address: '5, RK Mutt Road, Mylapore, Chennai - 600004',
    occupation: 'Civil Contractor',
    monthlyIncome: 110000,
    pan: 'CRVKL9012H',
    designation: 'Managing Director',
    companyName: 'Bala Constructions',
  },
  {
    code: 'CHIT-HQ-04',
    name: 'Lakshmi Narayanan',
    phone: '9841011104',
    email: 'lakshmi.narayanan@example.com',
    address: '42, Kutchery Road, Mylapore, Chennai - 600004',
    occupation: 'Chartered Accountant',
    monthlyIncome: 95000,
    pan: 'DLSNR3456J',
    designation: 'Senior Partner',
    companyName: 'L Narayanan & Co',
  },
  {
    code: 'CHIT-HQ-05',
    name: 'Anandhi Venkatesh',
    phone: '9841011105',
    email: 'anandhi.v@example.com',
    address: '19, Besant Avenue Road, Adyar, Chennai - 600020',
    occupation: 'Boutique Owner',
    monthlyIncome: 65000,
    pan: 'EPSVT7890K',
    designation: 'Owner',
    companyName: 'Anandhi Fashions',
  },
  {
    code: 'CHIT-HQ-06',
    name: 'Karthik Sridhar',
    phone: '9841011106',
    email: 'karthik.s@example.com',
    address: '77, Velachery Main Road, Guindy, Chennai - 600032',
    occupation: 'Automobile Dealer',
    monthlyIncome: 125000,
    pan: 'FRKSR1234L',
    designation: 'General Manager',
    companyName: 'Sridhar Motors',
  },
  {
    code: 'CHIT-HQ-07',
    name: 'Meenakshi Krishnan',
    phone: '9841011107',
    email: 'meenakshi.k@example.com',
    address: '11, 2nd Avenue, Anna Nagar East, Chennai - 600010',
    occupation: 'High School Principal',
    monthlyIncome: 75000,
    pan: 'GSMNK5678M',
    designation: 'Principal',
    companyName: 'Vidya Mandir School',
  },
  {
    code: 'CHIT-HQ-08',
    name: 'Venkatesh Raman',
    phone: '9841011108',
    email: 'venkat.raman@example.com',
    address: '63, Usman Road, T. Nagar, Chennai - 600017',
    occupation: 'Jewellery Trader',
    monthlyIncome: 160000,
    pan: 'HTVRM9012N',
    designation: 'Partner',
    companyName: 'Raman & Sons Jewellers',
  },
  {
    code: 'CHIT-HQ-09',
    name: 'Divya Parthasarathy',
    phone: '9841011109',
    email: 'divya.partha@example.com',
    address: '8, Sterling Road, Nungambakkam, Chennai - 600034',
    occupation: 'Interior Designer',
    monthlyIncome: 80000,
    pan: 'JVDPS3456P',
    designation: 'Creative Director',
    companyName: 'Studio D Interiors',
  },
  {
    code: 'CHIT-HQ-10',
    name: 'Gowtham Chandrasekar',
    phone: '9841011110',
    email: 'gowtham.c@example.com',
    address: '105, Mount Poonamallee Road, Porur, Chennai - 600116',
    occupation: 'Logistics Consultant',
    monthlyIncome: 90000,
    pan: 'KWGCS7890Q',
    designation: 'Operations Head',
    companyName: 'FastTrack Logistics',
  },
];

const CHIT_CUSTOMERS_ERODE = [
  {
    code: 'CHIT-ER-01',
    name: 'Arun Kumar Sengottuvel',
    phone: '9842011101',
    email: 'arun.sengottuvel@example.com',
    address: '45, Brough Road, Erode - 638001',
    occupation: 'Turmeric Exporter',
    monthlyIncome: 150000,
    pan: 'ALXKS1111E',
    designation: 'Proprietor',
    companyName: 'Sengottuvel Turmeric Exports',
  },
  {
    code: 'CHIT-ER-02',
    name: 'Deepa Muthusamy',
    phone: '9842011102',
    email: 'deepa.m@example.com',
    address: '12, Perundurai Road, Erode - 638011',
    occupation: 'Powerloom Owner',
    monthlyIncome: 120000,
    pan: 'BMPDM2222F',
    designation: 'Owner',
    companyName: 'Muthusamy Textiles',
  },
  {
    code: 'CHIT-ER-03',
    name: 'Murugesan Palanisamy',
    phone: '9842011103',
    email: 'murugesan.p@example.com',
    address: '88, Chennimalai Road, Erode - 638009',
    occupation: 'Agricultural Equipment Dealer',
    monthlyIncome: 95000,
    pan: 'CNPMP3333G',
    designation: 'Managing Partner',
    companyName: 'Palanisamy Agro Tools',
  },
  {
    code: 'CHIT-ER-04',
    name: 'Saranya Thangavel',
    phone: '9842011104',
    email: 'saranya.t@example.com',
    address: '34, Gandhi Ji Road, Erode - 638001',
    occupation: 'Garment Manufacturer',
    monthlyIncome: 110000,
    pan: 'DOPST4444H',
    designation: 'Director',
    companyName: 'Thangavel Garments',
  },
  {
    code: 'CHIT-ER-05',
    name: 'Prabhu Kandasamy',
    phone: '9842011105',
    email: 'prabhu.k@example.com',
    address: '15, Sathy Road, Erode - 638003',
    occupation: 'Hardware Merchant',
    monthlyIncome: 85000,
    pan: 'EPQPK5555J',
    designation: 'Proprietor',
    companyName: 'Kandasamy Hardware Stores',
  },
  {
    code: 'CHIT-ER-06',
    name: 'Kavitha Natarajan',
    phone: '9842011106',
    email: 'kavitha.n@example.com',
    address: '56, Mettur Road, Erode - 638011',
    occupation: 'Fertilizer Distributor',
    monthlyIncome: 105000,
    pan: 'FQRKN6666K',
    designation: 'Partner',
    companyName: 'Natarajan Agro Supplies',
  },
  {
    code: 'CHIT-ER-07',
    name: 'Dinesh Shanmugam',
    phone: '9842011107',
    email: 'dinesh.s@example.com',
    address: '23, Sampath Nagar, Erode - 638011',
    occupation: 'Transport Fleet Owner',
    monthlyIncome: 135000,
    pan: 'GRSDS7777L',
    designation: 'Managing Director',
    companyName: 'Shanmugam Roadways',
  },
  {
    code: 'CHIT-ER-08',
    name: 'Nandhini Gounder',
    phone: '9842011108',
    email: 'nandhini.g@example.com',
    address: '7, Teachers Colony, Erode - 638011',
    occupation: 'College Professor & Author',
    monthlyIncome: 80000,
    pan: 'HSYNG8888M',
    designation: 'Head of Department',
    companyName: 'Erode Arts College',
  },
  {
    code: 'CHIT-ER-09',
    name: 'Ramesh Karuppannan',
    phone: '9842011109',
    email: 'ramesh.k@example.com',
    address: '91, EVN Road, Erode - 638009',
    occupation: 'Oil Mill Owner',
    monthlyIncome: 140000,
    pan: 'ITZRK9999N',
    designation: 'Owner',
    companyName: 'Karuppannan Edible Oils',
  },
  {
    code: 'CHIT-ER-10',
    name: 'Bhuvaneswari Subramaniam',
    phone: '9842011110',
    email: 'bhuvaneswari.s@example.com',
    address: '102, Solar Road, Erode - 638002',
    occupation: 'Solar Systems Contractor',
    monthlyIncome: 90000,
    pan: 'JUBBS0000P',
    designation: 'Chief Executive',
    companyName: 'Subramaniam Green Energy',
  },
];

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'default' },
  });
  if (!tenant) {
    throw new Error('Default tenant not found');
  }

  // Ensure 'chitfunds' is enabled on HQ and ERODE branches of default tenant
  const branches = await prisma.branch.findMany({
    where: { tenantId: tenant.id },
  });

  for (const b of branches) {
    let mods = [];
    try {
      mods = JSON.parse(b.enabledModules || '[]');
    } catch {
      mods = [];
    }
    if (!mods.includes('chitfunds')) {
      mods.push('chitfunds');
      await prisma.branch.update({
        where: { id: b.id },
        data: { enabledModules: JSON.stringify(mods) },
      });
      console.log(`Enabled chitfunds module on branch: ${b.name} (${b.code})`);
    }
  }

  const hqBranch = branches.find((b) => b.code === 'HQ') || branches[0];
  const erodeBranch = branches.find((b) => b.code === 'ERODE' || b.code === 'CHIT-DEMO') || hqBranch;

  let createdCount = 0;

  // 1. Create 10 customers on HQ Branch
  for (const c of CHIT_CUSTOMERS_HQ) {
    await prisma.customer.upsert({
      where: {
        tenantId_customerCode: {
          tenantId: tenant.id,
          customerCode: c.code,
        },
      },
      update: {
        appType: 'chitfunds',
        branchId: hqBranch.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        occupation: c.occupation,
        monthlyIncome: c.monthlyIncome,
        pan: c.pan,
        designation: c.designation,
        companyName: c.companyName,
        status: 'active',
        kycStatus: 'verified',
      },
      create: {
        tenantId: tenant.id,
        branchId: hqBranch.id,
        appType: 'chitfunds',
        customerCode: c.code,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        occupation: c.occupation,
        monthlyIncome: c.monthlyIncome,
        pan: c.pan,
        designation: c.designation,
        companyName: c.companyName,
        status: 'active',
        kycStatus: 'verified',
      },
    });
    createdCount++;
  }
  console.log(`Created/Updated 10 chitfund customers for HQ branch (${hqBranch.name}).`);

  // 2. Create 10 customers on ERODE Branch
  if (erodeBranch.id !== hqBranch.id) {
    for (const c of CHIT_CUSTOMERS_ERODE) {
      await prisma.customer.upsert({
        where: {
          tenantId_customerCode: {
            tenantId: tenant.id,
            customerCode: c.code,
          },
        },
        update: {
          appType: 'chitfunds',
          branchId: erodeBranch.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          occupation: c.occupation,
          monthlyIncome: c.monthlyIncome,
          pan: c.pan,
          designation: c.designation,
          companyName: c.companyName,
          status: 'active',
          kycStatus: 'verified',
        },
        create: {
          tenantId: tenant.id,
          branchId: erodeBranch.id,
          appType: 'chitfunds',
          customerCode: c.code,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          occupation: c.occupation,
          monthlyIncome: c.monthlyIncome,
          pan: c.pan,
          designation: c.designation,
          companyName: c.companyName,
          status: 'active',
          kycStatus: 'verified',
        },
      });
      createdCount++;
    }
    console.log(`Created/Updated 10 chitfund customers for Erode branch (${erodeBranch.name}).`);
  }

  console.log(`Total chitfund customers ready: ${createdCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
