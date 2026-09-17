import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/api/dualAuth';
import { createMandate } from '@/lib/nach';
import prisma from '@/lib/db';
import { z } from 'zod';


const ADMIN_ROLES = new Set(['admin', 'superadmin', 'developer']);

const CreateMandateSchema = z.object({
  loanId: z.string().min(1),
  customerId: z.string().min(1),
  accountHolderName: z.string().min(1),
  accountNumber: z.string().min(6),
  accountType: z.enum(['savings', 'current']).default('savings'),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'),
  bankName: z.string().optional(),
  maxAmount: z.number().positive(),
  authType: z.enum(['netbanking', 'debitcard', 'aadhaar']).default('netbanking'),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
});

/** POST /api/v1/nach/mandate — create e-mandate for a loan */
export async function POST(req: NextRequest) {
  const user = await resolveActor(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ADMIN_ROLES.has(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateMandateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 422 });
  }
  const data = parsed.data;

  // Verify loan belongs to tenant
  const loan = await prisma.loan.findFirst({
    where: { id: data.loanId, tenantId: user.tenantId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  if (!['active', 'overdue'].includes(loan.status)) {
    return NextResponse.json({ error: `Cannot register e-NACH on a ${loan.status} loan` }, { status: 409 });
  }

  // Check no active mandate already exists
  const existing = await prisma.nachMandate.findUnique({
    where: { loanId: data.loanId },
    select: { id: true, status: true },
  });
  if (existing && !['cancelled', 'rejected', 'expired'].includes(existing.status)) {
    return NextResponse.json({ error: `Mandate already exists (status: ${existing.status})` }, { status: 409 });
  }

  try {
    const result = await createMandate({
      tenantId: user.tenantId,
      loanId: data.loanId,
      customerId: data.customerId,
      createdById: user.userId,
      accountHolderName: data.accountHolderName,
      accountNumber: data.accountNumber,
      accountType: data.accountType,
      ifscCode: data.ifscCode,
      bankName: data.bankName,
      maxAmount: data.maxAmount,
      authType: data.authType,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail || undefined,
    });
    return NextResponse.json({
      ok: true,
      data: {
        ...result,
        id: result.mandateId,
        status: 'pending_auth',
        accountHolderName: data.accountHolderName,
        accountNumber: data.accountNumber,
        accountType: data.accountType,
        ifscCode: data.ifscCode,
        bankName: data.bankName ?? null,
        maxAmount: data.maxAmount,
        authType: data.authType,
      },
    }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create mandate';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET /api/v1/nach/mandate — list mandates for tenant */
export async function GET(req: NextRequest) {
  const user = await resolveActor(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ADMIN_ROLES.has(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const pageSize = 20;

  const where = {
    tenantId: user.tenantId,
    ...(status ? { status } : {}),
  };

  const [mandates, total] = await Promise.all([
    prisma.nachMandate.findMany({
      where,
      include: {
        loan: { select: { loanCode: true, status: true } },
        customer: { select: { name: true, phone: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.nachMandate.count({ where }),
  ]);

  return NextResponse.json({ ok: true, data: mandates, total, page, pageSize });
}
