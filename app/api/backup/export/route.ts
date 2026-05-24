import prisma from '@/lib/db';
import { requireApiContext } from '@/lib/apiAuth';
import { writeAudit } from '@/lib/audit';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { headers } from 'next/headers';

export async function GET(req: Request) {
  try {
    // SEC-14: superadmin/developer only.
    const authResult = await requireApiContext(['superadmin', 'developer']);
    if (authResult.response) return authResult.response;
    const { context } = authResult;
    const tenantId = context.tenantId;

    // SEC-15: rate limit — 2 exports per hour per user.
    const ip = getClientIp(req);
    const rl = await checkRateLimit(
      routeKey(`backup-export:${context.userId}`, ip),
      { limit: 2, windowMs: 60 * 60 * 1000 },
    );
    if (!rl.allowed) {
      return new Response('Rate limit exceeded — try again in an hour.', { status: 429 });
    }

    // Audit every export attempt (success path; failures captured by error handler).
    await writeAudit({
      tenantId,
      userId: context.userId,
      action: 'export',
      entityType: 'backup',
      ipAddress: ip,
      userAgent: (await headers()).get('user-agent'),
    });

    const [customers, loans, accountEntries, routes] = await Promise.all([
      prisma.customer.findMany({
        where: { tenantId },
        include: { route: true, agent: true }
      }),
      prisma.loan.findMany({
        where: { tenantId },
        include: { customer: true }
      }),
      prisma.accountEntry.findMany({
        where: { tenantId },
        include: { user: true }
      }),
      prisma.route.findMany({
        where: { tenantId },
        include: { routeAgents: { include: { agent: true } } }
      })
    ]);

    const esc = (val: any) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    };

    let csv = '';
    csv += `# LoanTrack Database Backup - Generated on ${new Date().toISOString()}\n`;
    csv += `# Tenant ID: ${tenantId}\n\n`;

    csv += `=== SECTION: CUSTOMERS ===\n`;
    csv += `"Customer ID","Code","Name","Phone","PAN","Route","Agent","Status","Created At"\n`;
    for (const c of customers) {
      csv += `${esc(c.id)},${esc(c.customerCode)},${esc(c.name)},${esc(c.phone)},${esc(c.pan)},${esc(c.route?.name || 'Unassigned')},${esc(c.agent?.name || 'None')},${esc(c.status)},${esc(c.createdAt.toISOString())}\n`;
    }
    csv += `\n`;

    csv += `=== SECTION: LOANS ===\n`;
    csv += `"Loan ID","Code","Customer Name","Principal","Total Payable","Per Instalment","Frequency","Tenure","Start Date","End Date","Status","Total Collected","Paid Count","Created At"\n`;
    for (const l of loans) {
      csv += `${esc(l.id)},${esc(l.loanCode)},${esc(l.customer.name)},${esc(Number(l.principal))},${esc(Number(l.totalPayable))},${esc(Number(l.perInstalment))},${esc(l.frequency)},${esc(l.tenure)},${esc(l.startDate.toISOString().slice(0, 10))},${esc(l.endDate ? l.endDate.toISOString().slice(0, 10) : '')},${esc(l.status)},${esc(Number(l.totalCollected))},${esc(l.paidCount)},${esc(l.createdAt.toISOString())}\n`;
    }
    csv += `\n`;

    csv += `=== SECTION: ACCOUNTING ===\n`;
    csv += `"Entry ID","Type","Category","Amount","Entry Date","Description","Created By","Created At"\n`;
    for (const a of accountEntries) {
      csv += `${esc(a.id)},${esc(a.type)},${esc(a.category)},${esc(Number(a.amount))},${esc(a.entryDate.toISOString().slice(0, 10))},${esc(a.description || '')},${esc(a.user?.name || 'System')},${esc(a.createdAt.toISOString())}\n`;
    }
    csv += `\n`;

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
