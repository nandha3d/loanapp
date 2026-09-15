# Foreclosure / Early Settlement — Complete Implementation

> Allows admin to close a loan before its natural end date.
> Calculates exact outstanding principal, accrued net penalty, and applies an optional discount.
> Generates a settlement letter PDF. Marks remaining instalments as waived. Full audit trail.
>
> **Current state:** `closeLoan()` in `loans/[id]/actions.ts` simply sets `status='closed'` with no
> outstanding balance calculation, no penalty resolution, and no closure type distinction.
> The `Loan` model has `closedAt` but no `closureType`, `foreclosureAmount`, or `foreclosureById`.

---

## Overview of changes

| Layer | File | Change |
|---|---|---|
| Schema | `prisma/schema.prisma` | Add 4 fields to `Loan`, add named relation to `User` |
| Lib | `lib/foreclosure.ts` | NEW — calculation engine |
| API | `app/api/loans/[id]/foreclosure-calc/route.ts` | NEW — live preview endpoint |
| Action | `app/(dashboard)/loans/[id]/actions.ts` | Add `forecloseLoan()`, update `closeLoan()` |
| UI | `app/(dashboard)/loans/[id]/LoanDetailClient.tsx` | Add Early Settlement button + modal |
| PDF | `lib/settlementLetter.tsx` | NEW — settlement letter PDF component |
| API | `app/api/loans/[id]/settlement-letter/route.ts` | NEW — PDF download endpoint |
| Migration | — | `npx prisma migrate dev --name add_foreclosure` |

---

## TASK 1 — Schema changes

**File:** `prisma/schema.prisma`

### 1a — Add fields to `model Loan`

Add these four fields directly after the existing `closedAt` field (line ~248):

```prisma
closedAt          DateTime?         @map("closed_at")

// --- ADD THESE FOUR LINES ---
closureType       String?           @map("closure_type")
// Values: 'normal' | 'foreclosure' | 'written_off'
// null = loan not yet closed

foreclosureAmount Decimal?          @map("foreclosure_amount") @db.Decimal(12, 2)
// The exact settlement amount paid at foreclosure

foreclosureDiscount Decimal?        @map("foreclosure_discount") @db.Decimal(12, 2)
// Any discount the admin applied (reduces settlement amount)

foreclosureById   String?           @map("foreclosure_by_id")
// Admin who authorised the foreclosure
```

### 1b — Add relation to `model User`

Inside `model User`, after the existing named relations, add:

```prisma
foreclosedLoans   Loan[]            @relation("LoanForecloser")
```

### 1c — Add relation back on `Loan`

After the `createdBy` relation line in `model Loan`, add:

```prisma
foreclosedBy      User?             @relation("LoanForecloser", fields: [foreclosureById], references: [id])
```

### 1d — Run migration

```bash
npx prisma migrate dev --name add_foreclosure_fields
npx prisma generate
```

---

## TASK 2 — Create `lib/foreclosure.ts`

**Create new file:** `lib/foreclosure.ts`

```ts
import prisma from './db';
import { getPenaltySettings } from './tenant';

// ─── Return types ────────────────────────────────────────────────────────────

export interface ForeclosureLineItem {
  label: string;
  amount: number;
  sign: '+' | '-' | '=';
  highlight?: boolean;
}

export interface ForeclosureCalculation {
  loanId: string;
  loanCode: string;
  customerName: string;
  customerCode: string;
  customerPhone: string;
  // Principal
  originalPrincipal: number;
  totalCollected: number;
  principalOutstanding: number;
  // Instalments
  totalInstalments: number;
  paidInstalments: number;
  missedInstalments: number;
  remainingInstalments: number;
  // Penalty
  grossPenalty: number;
  settledPenalty: number;
  waivedPenalty: number;
  netPenaltyDue: number;
  // Foreclosure
  discount: number;
  totalSettlementAmount: number;
  // Display breakdown
  lineItems: ForeclosureLineItem[];
  // Meta
  canForeclose: boolean;
  reason?: string; // if canForeclose = false, why
  calculatedAt: string;
}

// ─── Core engine ─────────────────────────────────────────────────────────────

export async function calculateForeclosure(
  loanId: string,
  tenantId: string,
  discount: number = 0
): Promise<ForeclosureCalculation> {

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId },
    include: {
      customer: {
        select: { name: true, customerCode: true, phone: true },
      },
      instalments: {
        orderBy: { instalmentNo: 'asc' },
      },
      penalties: true,
    },
  });

  if (!loan) throw new Error('Loan not found');

  // Guard: already closed
  if (loan.status === 'closed') {
    return buildErrorResult(loanId, 'This loan is already closed.');
  }

  // Guard: pending (not yet disbursed)
  if (loan.status === 'pending') {
    return buildErrorResult(loanId, 'Cannot foreclose a loan that has not been disbursed yet.');
  }

  // ── Instalment counts ─────────────────────────────────────────────────────
  const paidInstalments    = loan.instalments.filter(i => i.status === 'paid').length;
  const partialInstalments = loan.instalments.filter(i => i.status === 'partial').length;
  const missedInstalments  = loan.instalments.filter(i => i.status === 'missed').length;
  const remainingInstalments = loan.instalments.filter(i => i.status === 'upcoming').length;

  // ── Principal outstanding ─────────────────────────────────────────────────
  const originalPrincipal   = Number(loan.principal);
  const totalCollected      = Number(loan.totalCollected);
  const principalOutstanding = Math.max(0, originalPrincipal - totalCollected);

  // ── Penalty calculation ───────────────────────────────────────────────────
  const grossPenalty   = loan.penalties.reduce((s, p) => s + Number(p.grossPenalty),  0);
  const settledPenalty = loan.penalties.reduce((s, p) => s + Number(p.settledAmount), 0);
  const waivedPenalty  = loan.penalties.reduce((s, p) => s + Number(p.waivedAmount),  0);
  const netPenaltyDue  = Math.max(0, grossPenalty - settledPenalty - waivedPenalty);

  // ── Settlement total ──────────────────────────────────────────────────────
  const safeDiscount = Math.min(Math.max(0, discount), principalOutstanding + netPenaltyDue);
  const totalSettlementAmount = Math.max(0, principalOutstanding + netPenaltyDue - safeDiscount);

  // ── Line items for display ────────────────────────────────────────────────
  const lineItems: ForeclosureLineItem[] = [
    { label: 'Original principal',        amount: originalPrincipal,    sign: '+' },
    { label: 'Total collected so far',    amount: -totalCollected,       sign: '-' },
    { label: 'Principal outstanding',     amount: principalOutstanding,  sign: '=', highlight: true },
    { label: `Net penalty due (${missedInstalments} missed days)`, amount: netPenaltyDue, sign: '+' },
    ...(safeDiscount > 0
      ? [{ label: 'Settlement discount applied', amount: -safeDiscount, sign: '-' as const }]
      : []),
    { label: 'Total settlement amount',   amount: totalSettlementAmount, sign: '=', highlight: true },
  ];

  return {
    loanId:              loan.id,
    loanCode:            loan.loanCode,
    customerName:        loan.customer.name,
    customerCode:        loan.customer.customerCode,
    customerPhone:       loan.customer.phone,
    originalPrincipal,
    totalCollected,
    principalOutstanding,
    totalInstalments:    loan.totalInstalments,
    paidInstalments:     paidInstalments + partialInstalments,
    missedInstalments,
    remainingInstalments,
    grossPenalty,
    settledPenalty,
    waivedPenalty,
    netPenaltyDue,
    discount:            safeDiscount,
    totalSettlementAmount,
    lineItems,
    canForeclose:        true,
    calculatedAt:        new Date().toISOString(),
  };
}

function buildErrorResult(loanId: string, reason: string): ForeclosureCalculation {
  const zero = { amount: 0, sign: '+' as const };
  return {
    loanId, loanCode: '', customerName: '', customerCode: '', customerPhone: '',
    originalPrincipal: 0, totalCollected: 0, principalOutstanding: 0,
    totalInstalments: 0, paidInstalments: 0, missedInstalments: 0, remainingInstalments: 0,
    grossPenalty: 0, settledPenalty: 0, waivedPenalty: 0, netPenaltyDue: 0,
    discount: 0, totalSettlementAmount: 0, lineItems: [],
    canForeclose: false, reason, calculatedAt: new Date().toISOString(),
  };
}
```

---

## TASK 3 — Create foreclosure preview API endpoint

**Create:** `app/api/loans/[id]/foreclosure-calc/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/apiAuth';
import { calculateForeclosure } from '@/lib/foreclosure';
import { corsHeaders } from '@/lib/cors';

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireApiContext(req);
  if (!ctx.success) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  // Only admin and above can calculate foreclosure
  if (ctx.role === 'agent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const discount = Math.max(0, Number(searchParams.get('discount') || '0'));

  try {
    const calc = await calculateForeclosure(params.id, ctx.tenantId, discount);
    return NextResponse.json({ success: true, data: calc });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
```

---

## TASK 4 — Add `forecloseLoan()` action to `loans/[id]/actions.ts`

Add this entire function to `app/(dashboard)/loans/[id]/actions.ts`. Also add the import at the top of that file:

```ts
// Add to imports at top:
import { calculateForeclosure } from '@/lib/foreclosure';
import { notifyLoanClosed } from '@/lib/sms';
```

```ts
export async function forecloseLoan(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;

  if (!userId || role === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const loanId   = formData.get('loanId')   as string;
  const discount = Number(formData.get('foreclosureDiscount') || '0');
  const notes    = (formData.get('foreclosureNotes') as string) || '';
  const markChequesReturned = formData.get('markChequesReturned') === '1';

  if (!loanId) return { success: false, error: 'Missing loanId' };

  // Run calculation engine (validates loan exists and is foreclosable)
  const calc = await calculateForeclosure(loanId, tenantId, discount);
  if (!calc.canForeclose) return { success: false, error: calc.reason || 'Cannot foreclose this loan' };

  await prisma.$transaction(async (tx) => {

    // 1. Close the loan with foreclosure metadata
    await tx.loan.update({
      where: { id: loanId },
      data: {
        status:               'closed',
        closedAt:             new Date(),
        closureType:          'foreclosure',
        foreclosureAmount:    calc.totalSettlementAmount,
        foreclosureDiscount:  calc.discount,
        foreclosureById:      userId,
      },
    });

    // 2. Mark all remaining 'upcoming' instalments as waived
    await tx.instalment.updateMany({
      where: { loanId, status: 'upcoming' },
      data:  { status: 'waived' },
    });

    // 3. Settle all pending penalties in one go
    if (calc.netPenaltyDue > 0) {
      await tx.penalty.updateMany({
        where: { loanId, status: 'pending' },
        data: {
          status:      'settled',
          settledAt:   new Date(),
          settledById: userId,
          notes:       `Foreclosure settlement. ${notes}`.trim(),
        },
      });
    }

    // 4. Mark security cheques as returned if admin confirmed
    if (markChequesReturned) {
      const loanWithCheques = await tx.loan.findUnique({
        where: { id: loanId },
        include: { customer: { include: { securityCheques: true } } },
      });
      const activeChequeIds = loanWithCheques?.customer?.securityCheques
        .filter(c => c.status === 'active')
        .map(c => c.id) ?? [];
      if (activeChequeIds.length > 0) {
        await tx.securityCheque.updateMany({
          where: { id: { in: activeChequeIds } },
          data:  { status: 'returned' },
        });
      }
    }

    // 5. Audit log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action:     'foreclosure',
        entityType: 'loan',
        entityId:   loanId,
        newValue:   JSON.stringify({
          loanCode:             calc.loanCode,
          principalOutstanding: calc.principalOutstanding,
          netPenaltyDue:        calc.netPenaltyDue,
          discount:             calc.discount,
          totalSettlementAmount:calc.totalSettlementAmount,
          remainingWaived:      calc.remainingInstalments,
          notes,
        }),
      },
    });
  });

  // Fire-and-forget: notify borrower
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { customer: true },
  });
  if (loan?.customer?.phone) {
    notifyLoanClosed({
      tenantId,
      phone:    loan.customer.phone,
      name:     loan.customer.name,
      loanCode: loan.loanCode,
      loanId,
    }).catch(() => {});
  }

  revalidatePath(`/loans/${loanId}`);
  revalidatePath('/loans');
  revalidatePath('/dashboard');
  revalidatePath('/penalties');

  return { success: true, calc };
}
```

---

## TASK 5 — Update `LoanDetailClient.tsx`

**File:** `app/(dashboard)/loans/[id]/LoanDetailClient.tsx`

### 5a — Add new state variables after the existing state block (around line 77)

```tsx
// After: const [closeModal, setCloseModal] = useState(false);
const [foreclosureModal, setForeclosureModal]     = useState(false);
const [foreclosureCalc, setForeclosureCalc]       = useState<any>(null);
const [foreclosureDiscount, setForeclosureDiscount] = useState(0);
const [foreclosureLoading, setForeclosureLoading] = useState(false);
const [foreclosureNotes, setForeclosureNotes]     = useState('');
const [foreclosureSubmitting, setForeclosureSubmitting] = useState(false);
```

### 5b — Add import at the top of the file

```tsx
import { forecloseLoan } from './actions';
```

### 5c — Add handler function after `handleCloseLoan`

```tsx
const handleOpenForeclosure = async () => {
  setForeclosureLoading(true);
  setForeclosureModal(true);
  setForeclosureCalc(null);
  try {
    const res = await fetch(`/api/loans/${loan.id}/foreclosure-calc?discount=${foreclosureDiscount}`);
    const data = await res.json();
    if (data.success) setForeclosureCalc(data.data);
  } finally {
    setForeclosureLoading(false);
  }
};

const handleDiscountChange = async (val: number) => {
  setForeclosureDiscount(val);
  if (!foreclosureModal) return;
  setForeclosureLoading(true);
  try {
    const res = await fetch(`/api/loans/${loan.id}/foreclosure-calc?discount=${val}`);
    const data = await res.json();
    if (data.success) setForeclosureCalc(data.data);
  } finally {
    setForeclosureLoading(false);
  }
};

const handleForeclosureSubmit = async () => {
  if (!foreclosureCalc) return;
  setForeclosureSubmitting(true);
  const fd = new FormData();
  fd.set('loanId', loan.id);
  fd.set('foreclosureDiscount', String(foreclosureDiscount));
  fd.set('foreclosureNotes', foreclosureNotes);
  fd.set('markChequesReturned', chequeReturned ? '1' : '0');
  const result = await forecloseLoan(fd);
  setForeclosureSubmitting(false);
  if (result.success) {
    setForeclosureModal(false);
    router.refresh();
  } else {
    alert(result.error || 'Foreclosure failed');
  }
};
```

### 5d — Add "Early Settlement" button next to the existing Close Loan button (around line 395)

```tsx
{/* Existing close button */}
<button className="btn btn-danger" onClick={() => setCloseModal(true)}>
  {d.closeLoan}
</button>

{/* ADD this Early Settlement button — visible for active/overdue loans, admin+ only */}
{(loan.status === 'active' || loan.status === 'overdue') && userRole !== 'agent' && (
  <button
    className="btn btn-secondary"
    onClick={handleOpenForeclosure}
    style={{ marginLeft: '8px' }}
  >
    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>cancel_schedule_send</span>
    Early Settlement
  </button>
)}
```

### 5e — Add the foreclosure modal (add before the closing `</>` of the component return)

```tsx
{/* ── Foreclosure / Early Settlement Modal ── */}
{foreclosureModal && (
  <div className="modal-overlay" onClick={() => !foreclosureSubmitting && setForeclosureModal(false)}>
    <div className="modal" style={{ maxWidth: '520px', width: '100%' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Early Settlement</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setForeclosureModal(false)}>
          <span className="material-icons-outlined">close</span>
        </button>
      </div>

      {foreclosureLoading && (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
          Calculating...
        </div>
      )}

      {!foreclosureLoading && foreclosureCalc && (
        <>
          {/* Borrower & loan info */}
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '14px', fontSize: '13px' }}>
            <strong>{foreclosureCalc.customerName}</strong> · {foreclosureCalc.customerCode}
            <br />
            Loan: <strong>{foreclosureCalc.loanCode}</strong> · {foreclosureCalc.paidInstalments}/{foreclosureCalc.totalInstalments} instalments paid
          </div>

          {/* Calculation breakdown */}
          <div style={{ border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '14px' }}>
            {foreclosureCalc.lineItems.map((item: any, i: number) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 14px',
                borderBottom: i < foreclosureCalc.lineItems.length - 1 ? '0.5px solid var(--border)' : 'none',
                background: item.highlight ? 'var(--primary-light)' : 'var(--surface)',
                fontWeight: item.highlight ? 700 : 400,
              }}>
                <span style={{ fontSize: '13px', color: item.highlight ? 'var(--primary-dark)' : 'var(--text)' }}>
                  {item.label}
                </span>
                <span style={{
                  fontSize: item.highlight ? '15px' : '13px',
                  color: item.amount < 0 ? 'var(--success)' : item.highlight ? 'var(--primary)' : 'var(--text)',
                  fontWeight: item.highlight ? 700 : 500,
                }}>
                  {item.amount < 0 ? '−' : ''}{currencySymbol}{Math.abs(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>

          {/* Discount input */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px' }}>
              Settlement Discount ({currencySymbol}) — optional
            </label>
            <input
              type="number"
              className="form-control"
              value={foreclosureDiscount || ''}
              min={0}
              max={foreclosureCalc.principalOutstanding + foreclosureCalc.netPenaltyDue}
              placeholder="0"
              onChange={e => handleDiscountChange(Number(e.target.value) || 0)}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Reduces the total settlement amount. Must be authorised by management.
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px' }}>Reason / Notes</label>
            <input
              type="text"
              className="form-control"
              value={foreclosureNotes}
              onChange={e => setForeclosureNotes(e.target.value)}
              placeholder="e.g. Customer requested early closure due to financial hardship"
            />
          </div>

          {/* Cheque return checkbox (only show if active cheques exist) */}
          {loan.customer?.securityCheques?.some((c: any) => c.status === 'active') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <input
                type="checkbox"
                id="foreclose-cheq"
                checked={chequeReturned}
                onChange={e => setChequeReturned(e.target.checked)}
              />
              <label htmlFor="foreclose-cheq" style={{ fontSize: '13px', cursor: 'pointer' }}>
                Confirm security cheques have been returned to customer
              </label>
            </div>
          )}

          {/* Summary box */}
          <div style={{
            background: 'var(--primary-light)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>Total settlement amount</span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>
              {currencySymbol}{foreclosureCalc.totalSettlementAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Warning */}
          <div style={{ fontSize: '12px', color: 'var(--warning)', marginBottom: '16px', display: 'flex', gap: '6px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>warning</span>
            <span>This action is irreversible. {foreclosureCalc.remainingInstalments} remaining instalments will be marked as waived.</span>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setForeclosureModal(false)}
              disabled={foreclosureSubmitting}
            >
              Cancel
            </button>
            <a
              href={`/api/loans/${loan.id}/settlement-letter?discount=${foreclosureDiscount}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ textDecoration: 'none' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>picture_as_pdf</span>
              Preview Letter
            </a>
            <button
              className="btn btn-danger"
              onClick={handleForeclosureSubmit}
              disabled={foreclosureSubmitting}
            >
              {foreclosureSubmitting
                ? 'Processing...'
                : `Confirm — ${currencySymbol}${foreclosureCalc.totalSettlementAmount.toLocaleString('en-IN')}`}
            </button>
          </div>
        </>
      )}

      {!foreclosureLoading && !foreclosureCalc && (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--danger)' }}>
          Failed to calculate. Please try again.
        </div>
      )}
    </div>
  </div>
)}
```

---

## TASK 6 — Settlement letter PDF

### 6a — Create `lib/settlementLetter.tsx`

```tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ForeclosureCalculation } from './foreclosure';

const S = StyleSheet.create({
  page:      { fontFamily: 'Helvetica', fontSize: 10, padding: 48, backgroundColor: '#fff' },
  header:    { borderBottom: '2 solid #F5A623', paddingBottom: 12, marginBottom: 20 },
  title:     { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#F5A623' },
  subtitle:  { fontSize: 8, color: '#6B7280', marginTop: 3 },
  docTitle:  { fontSize: 14, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: '#1A1A1A' },
  ref:       { fontSize: 9, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  section:   { marginBottom: 16 },
  sHead:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottom: '0.5 solid #E5E7EB' },
  label:     { fontSize: 9, color: '#6B7280', width: '55%' },
  value:     { fontSize: 9, color: '#1A1A1A', width: '43%', textAlign: 'right' },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, backgroundColor: '#FEF3C7', paddingHorizontal: 8, marginTop: 4, borderRadius: 4 },
  totalLbl:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#854F0B' },
  totalVal:  { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#F5A623' },
  para:      { fontSize: 9, color: '#374151', lineHeight: 1.6, marginBottom: 8 },
  sigBox:    { marginTop: 40, flexDirection: 'row', justifyContent: 'space-between' },
  sigLine:   { borderTop: '1 solid #9CA3AF', width: 140, paddingTop: 4 },
  sigLabel:  { fontSize: 8, color: '#6B7280' },
  footer:    { marginTop: 30, borderTop: '0.5 solid #E5E7EB', paddingTop: 8 },
  footerTxt: { fontSize: 8, color: '#9CA3AF', textAlign: 'center' },
});

function fmt(n: number, symbol = '₹') {
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export function SettlementLetterPDF({
  calc,
  appName,
  branchName,
  adminName,
  currencySymbol = '₹',
}: {
  calc: ForeclosureCalculation;
  appName: string;
  branchName: string;
  adminName: string;
  currencySymbol?: string;
}) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const refNo = `SETTLE/${calc.loanCode}/${new Date().getFullYear()}`;

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={[S.header, { flexDirection: 'row', justifyContent: 'space-between' }]}>
          <View>
            <Text style={S.title}>{appName}</Text>
            <Text style={S.subtitle}>{branchName}</Text>
          </View>
          <View>
            <Text style={S.docTitle}>LOAN SETTLEMENT LETTER</Text>
            <Text style={S.ref}>Ref: {refNo}</Text>
            <Text style={S.ref}>Date: {today}</Text>
          </View>
        </View>

        {/* Addressee */}
        <View style={S.section}>
          <Text style={S.para}>To,</Text>
          <Text style={{ ...S.para, fontFamily: 'Helvetica-Bold' }}>{calc.customerName}</Text>
          <Text style={S.para}>Customer ID: {calc.customerCode}</Text>
          <Text style={S.para}>Phone: {calc.customerPhone}</Text>
        </View>

        {/* Body */}
        <View style={S.section}>
          <Text style={S.para}>
            Dear {calc.customerName},
          </Text>
          <Text style={S.para}>
            This letter confirms that upon receipt of the settlement amount detailed below, your
            loan account <Text style={{ fontFamily: 'Helvetica-Bold' }}>{calc.loanCode}</Text> will
            be marked as fully settled and closed as on {today}.
          </Text>
          <Text style={S.para}>
            The following amounts have been calculated as of the date of this letter:
          </Text>
        </View>

        {/* Calculation table */}
        <View style={S.section}>
          <Text style={S.sHead}>Settlement Calculation</Text>
          <View style={S.row}>
            <Text style={S.label}>Original principal amount</Text>
            <Text style={S.value}>{fmt(calc.originalPrincipal, currencySymbol)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Amount collected to date ({calc.paidInstalments} instalments)</Text>
            <Text style={S.value}>{fmt(calc.totalCollected, currencySymbol)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Principal outstanding</Text>
            <Text style={{ ...S.value, fontFamily: 'Helvetica-Bold' }}>{fmt(calc.principalOutstanding, currencySymbol)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Penalty charges ({calc.missedInstalments} missed payments)</Text>
            <Text style={S.value}>{fmt(calc.netPenaltyDue, currencySymbol)}</Text>
          </View>
          {calc.discount > 0 && (
            <View style={S.row}>
              <Text style={S.label}>Settlement discount</Text>
              <Text style={{ ...S.value, color: '#27AE60' }}>− {fmt(calc.discount, currencySymbol)}</Text>
            </View>
          )}
          <View style={S.totalRow}>
            <Text style={S.totalLbl}>Total Settlement Amount</Text>
            <Text style={S.totalVal}>{fmt(calc.totalSettlementAmount, currencySymbol)}</Text>
          </View>
        </View>

        {/* Terms */}
        <View style={S.section}>
          <Text style={S.sHead}>Terms & Conditions</Text>
          <Text style={S.para}>
            1. This settlement offer is valid for 7 days from the date of this letter.
          </Text>
          <Text style={S.para}>
            2. Upon receipt of {fmt(calc.totalSettlementAmount, currencySymbol)}, all remaining
            {' '}{calc.remainingInstalments} instalment(s) will be waived and the account will be closed.
          </Text>
          <Text style={S.para}>
            3. Security cheques held against this loan will be returned upon confirmation of payment.
          </Text>
          <Text style={S.para}>
            4. This letter does not constitute a waiver of any legal rights until full payment is received.
          </Text>
        </View>

        {/* Signatures */}
        <View style={S.sigBox}>
          <View>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>Authorised Signatory</Text>
            <Text style={{ ...S.sigLabel, marginTop: 2 }}>{adminName}</Text>
            <Text style={{ ...S.sigLabel, marginTop: 1 }}>{appName}</Text>
          </View>
          <View>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>Borrower Acknowledgement</Text>
            <Text style={{ ...S.sigLabel, marginTop: 2 }}>{calc.customerName}</Text>
            <Text style={{ ...S.sigLabel, marginTop: 1 }}>Date: _______________</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={S.footer}>
          <Text style={S.footerTxt}>
            This is a computer-generated settlement letter issued by {appName}. Ref: {refNo}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
```

### 6b — Create `app/api/loans/[id]/settlement-letter/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import prisma from '@/lib/db';
import { requireApiContext } from '@/lib/apiAuth';
import { calculateForeclosure } from '@/lib/foreclosure';
import { SettlementLetterPDF } from '@/lib/settlementLetter';
import { getBranding } from '@/lib/tenant';
import { auth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireApiContext(req);
  if (!ctx.success) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.role === 'agent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const discount = Number(searchParams.get('discount') || '0');

  const calc = await calculateForeclosure(params.id, ctx.tenantId, discount);
  if (!calc.canForeclose) {
    return NextResponse.json({ error: calc.reason }, { status: 400 });
  }

  const branding = await getBranding(ctx.tenantId);
  const session  = await auth();
  const adminName = (session?.user as any)?.name || 'Authorised Signatory';

  const buffer = await renderToBuffer(createElement(SettlementLetterPDF, {
    calc,
    appName:       branding.appName,
    branchName:    branding.appTagline,
    adminName,
    currencySymbol:branding.currencySymbol,
  }));

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="settlement-${calc.loanCode}.pdf"`,
      'Cache-Control':       'private, no-cache',
    },
  });
}
```

---

## TASK 7 — Update i18n dictionaries

**File:** `i18n/en.ts` — add inside `loanDetail` section:

```ts
earlySettlement:     'Early Settlement',
foreclose:           'Confirm Early Settlement',
settlementDiscount:  'Settlement Discount',
settlementAmount:    'Total Settlement Amount',
remainingWaived:     'remaining instalments will be waived',
settlementNotes:     'Reason / Notes',
previewLetter:       'Preview Letter',
foreclosureWarning:  'This action is irreversible.',
```

Add the same keys to `i18n/ta.ts` and `i18n/hi.ts` with the correct translations.

---

## Migration command sequence

```bash
# 1. Apply schema changes
npx prisma migrate dev --name add_foreclosure_fields

# 2. Regenerate Prisma client
npx prisma generate

# 3. Build check
npm run build
```
