import prisma from '@/lib/db';
import { requireApiContext } from '@/lib/apiAuth';
import { apiError } from '@/lib/utils';

export async function GET() {
  try {
    const authResult = await requireApiContext(['superadmin', 'developer']);
    if (authResult.response) return authResult.response;
    const { context } = authResult;
    const tenantId = context.tenantId;

    // Safety cap: 10k rows per section to avoid OOM on large tenants.
    // For a full dump, use db-level mysqldump instead.
    const CAP = 10_000;
    const [customers, loans, accountEntries, routes] = await Promise.all([
      prisma.customer.findMany({
        where: { tenantId },
        select: {
          id: true, customerCode: true, name: true, phone: true, pan: true,
          status: true, createdAt: true,
          route: { select: { name: true } },
          agent: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: CAP,
      }),
      prisma.loan.findMany({
        where: { tenantId },
        select: {
          id: true, loanCode: true, principal: true, totalPayable: true,
          perInstalment: true, frequency: true, tenure: true, startDate: true,
          endDate: true, status: true, totalCollected: true, paidCount: true, createdAt: true,
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: CAP,
      }),
      prisma.accountEntry.findMany({
        where: { tenantId },
        select: {
          id: true, type: true, category: true, amount: true,
          entryDate: true, description: true, createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: CAP,
      }),
      prisma.route.findMany({
        where: { tenantId },
        select: {
          id: true, name: true, status: true, createdAt: true,
          routeAgents: { select: { agent: { select: { name: true } } } },
        },
        take: 500,
      }),
    ]);

    // Helper to escape CSV values
    const esc = (val: any) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      str = str.replace(/"/g, '""'); // Escape quotes
      return `"${str}"`;
    };

    let csv = '';
    csv += `# LoanTrack Database Backup - Generated on ${new Date().toISOString()}\n`;
    csv += `# Tenant ID: ${tenantId}\n\n`;

    // 1. Customers Section
    csv += `=== SECTION: CUSTOMERS ===\n`;
    csv += `"Customer ID","Code","Name","Phone","PAN","Route","Agent","Status","Created At"\n`;
    for (const c of customers) {
      csv += `${esc(c.id)},${esc(c.customerCode)},${esc(c.name)},${esc(c.phone)},${esc(c.pan)},${esc(c.route?.name || 'Unassigned')},${esc(c.agent?.name || 'None')},${esc(c.status)},${esc(c.createdAt.toISOString())}\n`;
    }
    csv += `\n`;

    // 2. Loans Section
    csv += `=== SECTION: LOANS ===\n`;
    csv += `"Loan ID","Code","Customer Name","Principal","Total Payable","Per Instalment","Frequency","Tenure","Start Date","End Date","Status","Total Collected","Paid Count","Created At"\n`;
    for (const l of loans) {
      csv += `${esc(l.id)},${esc(l.loanCode)},${esc(l.customer.name)},${esc(Number(l.principal))},${esc(Number(l.totalPayable))},${esc(Number(l.perInstalment))},${esc(l.frequency)},${esc(l.tenure)},${esc(l.startDate.toISOString().slice(0, 10))},${esc(l.endDate ? l.endDate.toISOString().slice(0, 10) : '')},${esc(l.status)},${esc(Number(l.totalCollected))},${esc(l.paidCount)},${esc(l.createdAt.toISOString())}\n`;
    }
    csv += `\n`;

    // 3. Accounting Section
    csv += `=== SECTION: ACCOUNTING ===\n`;
    csv += `"Entry ID","Type","Category","Amount","Entry Date","Description","Created By","Created At"\n`;
    for (const a of accountEntries) {
      csv += `${esc(a.id)},${esc(a.type)},${esc(a.category)},${esc(Number(a.amount))},${esc(a.entryDate.toISOString().slice(0, 10))},${esc(a.description || '')},${esc(a.user?.name || 'System')},${esc(a.createdAt.toISOString())}\n`;
    }
    csv += `\n`;

    // 4. Routes Section
    csv += `=== SECTION: ROUTES ===\n`;
    csv += `"Route ID","Name","Agents","Status","Created At"\n`;
    for (const r of routes) {
      const agents = r.routeAgents.map((ra: any) => ra.agent?.name).filter(Boolean).join(', ');
      csv += `${esc(r.id)},${esc(r.name)},${esc(agents)},${esc(r.status)},${esc(r.createdAt.toISOString())}\n`;
    }

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="loantrack-backup-${new Date().toISOString().slice(0,10)}.csv"`
      }
    });

  } catch (error: any) {
    return new Response('Backup export failed: ' + error.message, { status: 500 });
  }
}
