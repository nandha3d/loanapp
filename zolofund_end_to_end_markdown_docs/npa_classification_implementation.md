# NPA Classification — Automated Engine Implementation Guide

**For:** ZoloFund Micro Lending — Licensed NBFCs & MFIs  
**Type:** Core Compliance Module (NPA Engine)  
**Regulatory basis:** RBI Master Circular — Prudential Norms on Income Recognition, Asset Classification and Provisioning (IRACP), 2023

---

## Table of Contents

1. [What NPA Means and Why Automation Is Non-Negotiable](#1-what-npa-means-and-why-automation-is-non-negotiable)
2. [RBI Asset Classification Rules](#2-rbi-asset-classification-rules)
3. [What Already Exists vs What Needs Building](#3-what-already-exists-vs-what-needs-building)
4. [Architecture Overview](#4-architecture-overview)
5. [Database Schema Changes](#5-database-schema-changes)
6. [Core NPA Classification Engine](#6-core-npa-classification-engine)
7. [Provisioning Calculation Engine](#7-provisioning-calculation-engine)
8. [Automated Cron Job](#8-automated-cron-job)
9. [NPA Upgrade Path (NPA → Standard)](#9-npa-upgrade-path-npa--standard)
10. [API Routes](#10-api-routes)
11. [NPA Dashboard & Reports UI](#11-npa-dashboard--reports-ui)
12. [Prisma Schema Changes](#12-prisma-schema-changes)
13. [Audit Trail & RBI Inspection Readiness](#13-audit-trail--rbi-inspection-readiness)
14. [Testing Strategy](#14-testing-strategy)
15. [Rollout Plan](#15-rollout-plan)

---

## 1. What NPA Means and Why Automation Is Non-Negotiable

**NPA = Non-Performing Asset.** Under RBI rules, a loan becomes an NPA when the borrower has not paid any instalment for **90 or more consecutive days** past the due date.

### Why You Cannot Leave `npaStatus` as a Manual Field

If an RBI inspector opens your system during an inspection and sees:

- `npaStatus` fields that are blank or manually updated
- Loans that are clearly 90+ days overdue but still marked as Standard
- No provisioning amount calculated against NPAs
- No NPA report that matches your loan register

...your institution receives a **compliance deficiency finding**, which can escalate to a penalty, a directive to stop lending, or in serious cases, cancellation of your NBFC registration.

Beyond compliance, manually tracking NPA is operationally impossible at scale. With 500 active loans and daily collections, no admin can manually check each loan's overdue status every day. The classification must run automatically, every day, without human intervention.

### Business Impact of Getting NPA Right

- **Provisioning** tells you how much money to set aside against bad loans — this directly affects your P&L and balance sheet
- **NPA ratio** (gross NPA / total loan book) is the single most watched metric by RBI, SIDBI, and any investor or lender looking at your institution
- **Early NPA detection** enables recovery action before a 90-day NPA becomes a write-off
- **Upgrade tracking** (NPA back to Standard) is required when a borrower resumes payments — you must have evidence of 3 consecutive standard payments before upgrading

---

## 2. RBI Asset Classification Rules

### The Four Asset Categories

| Category | Definition | Minimum Provisioning |
|---|---|---|
| **Standard** | No overdue, or overdue < 30 days | 0.40% of outstanding |
| **Sub-Standard** | NPA for up to 12 months (90–365 days overdue) | 15% of outstanding |
| **Doubtful — D1** | NPA for 12–24 months | 25% of outstanding (secured) / 100% (unsecured) |
| **Doubtful — D2** | NPA for 24–36 months | 40% of outstanding (secured) / 100% (unsecured) |
| **Doubtful — D3** | NPA for more than 36 months | 100% of outstanding |
| **Loss** | Identified as loss by auditor / RBI inspector | 100% of outstanding |

> **For MFIs specifically:** Nearly all microfinance loans are unsecured. This means Doubtful D1, D2, D3 all require **100% provisioning** of the outstanding amount. There is no secured/unsecured split for you — provision 100% from the day a loan enters Doubtful status.

### The 90-Day Rule in Detail

The clock starts from the **day after the instalment was due**:

```
Instalment due:         01 May 2026
Day 1 overdue:          02 May 2026
Day 30 (SMA-1):         31 May 2026   ← Special Mention Account — early warning
Day 60 (SMA-2):         30 Jun 2026   ← Heightened monitoring
Day 90 (NPA trigger):   30 Jul 2026   ← Classification as Sub-Standard
Day 365 (Doubtful D1):  30 Jul 2027
Day 730 (Doubtful D2):  30 Jul 2028
Day 1095 (Doubtful D3): 30 Jul 2029
```

### Special Mention Accounts (SMA)

RBI introduced SMA categories as **early warning signals** before NPA. Your engine should track these too:

| Category | Overdue Days | Action |
|---|---|---|
| SMA-0 | 1–30 days | Monitor; send payment reminder |
| SMA-1 | 31–60 days | Escalate to branch manager; increase collection frequency |
| SMA-2 | 61–90 days | Final recovery attempt before NPA classification |
| NPA | 90+ days | Classify; begin formal recovery process |

---

## 3. What Already Exists vs What Needs Building

### Already in Your Schema

```prisma
// These fields exist but are never automatically populated:
model Loan {
  npaStatus        String?   // 'standard' | 'npa' — too simple
  npaClassifiedAt  DateTime? // never set automatically
}
```

### What Is Missing

```
❌ No SMA tracking (SMA-0, SMA-1, SMA-2)
❌ No sub-classification (Sub-Standard, Doubtful D1/D2/D3, Loss)
❌ No NPA classification date automation
❌ No overdue days calculation
❌ No provisioning amount calculation
❌ No provisioning table in schema
❌ No NPA upgrade path (NPA → Standard after 3 clean instalments)
❌ No NPA history log (when did it change, who triggered it)
❌ No NPA report for RBI inspection
❌ No daily cron job running the classification
❌ No NPA dashboard for admin
```

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Daily Cron (2:00 AM)                        │
│                    POST /api/cron/classify-npa                      │
│                      (secured with CRON_SECRET)                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NPA Classification Engine                      │
│                    lib/npa/npaClassifier.ts                         │
│                                                                     │
│  1. Fetch all active/NPA loans for tenant                           │
│  2. Calculate maxOverdueDays per loan                               │
│  3. Determine new asset category (Standard/SMA/Sub-Std/Doubtful)   │
│  4. Compare with current category                                   │
│  5. If changed: update Loan + create NpaHistory + recalc provision  │
│  6. Write audit log for every classification change                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
┌────────────────────┐         ┌────────────────────────┐
│   Loan Table       │         │   Provisioning Table   │
│   (updated daily)  │         │   (recalculated daily) │
└────────────────────┘         └────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         NPA Dashboard                               │
│   Admin sees: NPA ratio, SMA counts, provisioning requirement,      │
│   aging bucket report, individual loan NPA detail                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Database Schema Changes

### Extend the Loan Model

```prisma
model Loan {
  // ── existing fields (unchanged) ──
  id              String    @id @default(cuid())
  tenantId        String
  customerId      String
  totalPayable    Decimal
  totalCollected  Decimal   @default(0)
  outstandingAmount Decimal
  status          String    // active | closed | npa | written_off

  // ── NPA fields (currently exist, need extension) ──
  npaStatus         String    @default("standard")
  // EXTEND: 'standard' | 'sma_0' | 'sma_1' | 'sma_2'
  //         | 'sub_standard' | 'doubtful_d1' | 'doubtful_d2'
  //         | 'doubtful_d3' | 'loss' | 'written_off'

  npaClassifiedAt   DateTime?   // first date classified as NPA
  npaDaysOverdue    Int         @default(0)  // max consecutive overdue days — updated daily
  npaSubCategory    String?     // 'sub_standard' | 'd1' | 'd2' | 'd3' | 'loss'
  npaUpgradeEligible Boolean    @default(false) // true when 3 consecutive clean instalments paid
  lastNpaReviewDate  DateTime?  // last date the cron evaluated this loan

  // ── Provisioning ──
  provisioningRate     Decimal   @default(0)    // % applied (e.g., 0.40, 15, 25, 100)
  provisioningAmount   Decimal   @default(0)    // actual ₹ amount to provision
  provisioningCategory String    @default("standard")

  // ── Relations ──
  npaHistory      NpaHistory[]
  provisioning    LoanProvisioning[]
}
```

### New Table: NpaHistory

```prisma
model NpaHistory {
  id              String    @id @default(cuid())
  tenantId        String
  loanId          String
  customerId      String

  // Transition recorded
  fromCategory    String    // what it was before
  toCategory      String    // what it changed to
  daysOverdue     Int       // overdue days at time of classification
  outstandingAmt  Decimal   // outstanding at time of classification

  // Trigger information
  triggeredBy     String    // 'cron_auto' | 'manual_admin' | 'rbi_inspection'
  triggeredById   String?   // userId if manual
  notes           String?   // admin notes for manual reclassification

  // Provisioning at time of change
  provisioningRate    Decimal
  provisioningAmount  Decimal

  createdAt       DateTime  @default(now())

  loan            Loan      @relation(fields: [loanId], references: [id])

  @@index([loanId, createdAt])
  @@index([tenantId, toCategory, createdAt])
  @@map("npa_history")
}
```

### New Table: LoanProvisioning

```prisma
// Daily snapshot of provisioning requirement per loan.
// Enables point-in-time provisioning reports for RBI.
model LoanProvisioning {
  id              String    @id @default(cuid())
  tenantId        String
  loanId          String
  snapshotDate    DateTime  // date this snapshot was taken (daily)

  category        String    // asset category at snapshot
  outstandingAmt  Decimal
  provisioningRate Decimal  // as %
  provisioningAmt  Decimal  // ₹ amount
  isSecured       Boolean   @default(false) // for NBFC — affects D1/D2 rate

  createdAt       DateTime  @default(now())

  loan            Loan      @relation(fields: [loanId], references: [id])

  @@unique([loanId, snapshotDate])  // one snapshot per loan per day
  @@index([tenantId, snapshotDate])
  @@map("loan_provisioning")
}
```

---

## 6. Core NPA Classification Engine

### `lib/npa/npaClassifier.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/lib/logger'
import { calculateProvisioning } from './provisioningCalculator'

// ─── Asset Category Types ────────────────────────────────────────────────────

export type AssetCategory =
  | 'standard'
  | 'sma_0'
  | 'sma_1'
  | 'sma_2'
  | 'sub_standard'
  | 'doubtful_d1'
  | 'doubtful_d2'
  | 'doubtful_d3'
  | 'loss'
  | 'written_off'

export interface ClassificationResult {
  loanId: string
  previousCategory: AssetCategory
  newCategory: AssetCategory
  daysOverdue: number
  changed: boolean
}

// ─── Main Engine Entry Point ─────────────────────────────────────────────────

export async function runNpaClassification(
  tenantId: string,
  triggeredBy: string = 'cron_auto',
  triggeredById?: string
): Promise<{ processed: number; changed: number; errors: number }> {

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch all active or already-NPA loans for this tenant
  // Exclude: closed, written_off (already terminal)
  const loans = await prisma.loan.findMany({
    where: {
      tenantId,
      status: { in: ['active', 'npa'] },
    },
    select: {
      id: true,
      customerId: true,
      npaStatus: true,
      npaClassifiedAt: true,
      npaDaysOverdue: true,
      outstandingAmount: true,
      isSecured: true,
      instalments: {
        where: { status: { not: 'paid' } },
        select: { dueDate: true, dueAmount: true, receivedAmount: true, status: true },
        orderBy: { dueDate: 'asc' },
      }
    }
  })

  let processed = 0
  let changed = 0
  let errors = 0

  for (const loan of loans) {
    try {
      const result = await classifyLoan(loan, today, triggeredBy, triggeredById, tenantId)
      processed++
      if (result.changed) changed++
    } catch (err) {
      errors++
      console.error(`NPA classification failed for loan ${loan.id}:`, err)
      // Continue processing other loans — never crash the whole batch
    }
  }

  return { processed, changed, errors }
}

// ─── Per-Loan Classification ─────────────────────────────────────────────────

async function classifyLoan(
  loan: LoanWithInstalments,
  today: Date,
  triggeredBy: string,
  triggeredById: string | undefined,
  tenantId: string
): Promise<ClassificationResult> {

  // 1. Find the oldest unpaid overdue instalment
  const maxOverdueDays = calculateMaxOverdueDays(loan.instalments, today)

  // 2. Determine the new asset category
  const newCategory = determineCategory(
    maxOverdueDays,
    loan.npaClassifiedAt,
    today
  )

  const previousCategory = (loan.npaStatus ?? 'standard') as AssetCategory
  const changed = newCategory !== previousCategory

  // 3. Calculate provisioning for the new category
  const provisioning = calculateProvisioning(
    newCategory,
    Number(loan.outstandingAmount),
    loan.isSecured ?? false
  )

  // 4. Only write to DB if something changed
  if (changed) {
    await prisma.$transaction(async (tx) => {

      // Update the loan record
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          npaStatus: newCategory,
          npaSubCategory: getNpaSubCategory(newCategory),
          npaDaysOverdue: maxOverdueDays,
          npaClassifiedAt: newCategory !== 'standard' && !loan.npaClassifiedAt
            ? today     // first time entering NPA
            : loan.npaClassifiedAt,  // preserve original classification date
          lastNpaReviewDate: today,
          provisioningRate: provisioning.rate,
          provisioningAmount: provisioning.amount,
          provisioningCategory: newCategory,
          // Update loan status if it becomes NPA
          status: newCategory !== 'standard' && newCategory !== 'sma_0'
            && newCategory !== 'sma_1' && newCategory !== 'sma_2'
            ? 'npa'
            : 'active',
        }
      })

      // Create history record
      await tx.npaHistory.create({
        data: {
          tenantId,
          loanId: loan.id,
          customerId: loan.customerId,
          fromCategory: previousCategory,
          toCategory: newCategory,
          daysOverdue: maxOverdueDays,
          outstandingAmt: loan.outstandingAmount,
          triggeredBy,
          triggeredById: triggeredById ?? null,
          provisioningRate: provisioning.rate,
          provisioningAmount: provisioning.amount,
        }
      })

      // Daily provisioning snapshot
      await tx.loanProvisioning.upsert({
        where: { loanId_snapshotDate: { loanId: loan.id, snapshotDate: today } },
        update: {
          category: newCategory,
          outstandingAmt: loan.outstandingAmount,
          provisioningRate: provisioning.rate,
          provisioningAmt: provisioning.amount,
        },
        create: {
          tenantId,
          loanId: loan.id,
          snapshotDate: today,
          category: newCategory,
          outstandingAmt: loan.outstandingAmount,
          provisioningRate: provisioning.rate,
          provisioningAmt: provisioning.amount,
          isSecured: loan.isSecured ?? false,
        }
      })
    })

    // Audit log the change
    await auditLog.create({
      tenantId,
      action: 'npa_classification_change',
      entityType: 'loan',
      entityId: loan.id,
      oldValue: JSON.stringify({ category: previousCategory }),
      newValue: JSON.stringify({
        category: newCategory,
        daysOverdue: maxOverdueDays,
        provisioningAmount: provisioning.amount,
        triggeredBy,
      })
    })
  } else {
    // Even if not changed, update the daily review date and overdue days
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        npaDaysOverdue: maxOverdueDays,
        lastNpaReviewDate: today,
      }
    })

    // Always write today's provisioning snapshot
    await prisma.loanProvisioning.upsert({
      where: { loanId_snapshotDate: { loanId: loan.id, snapshotDate: today } },
      update: { outstandingAmt: loan.outstandingAmount, provisioningAmt: provisioning.amount },
      create: {
        tenantId,
        loanId: loan.id,
        snapshotDate: today,
        category: newCategory,
        outstandingAmt: loan.outstandingAmount,
        provisioningRate: provisioning.rate,
        provisioningAmt: provisioning.amount,
        isSecured: loan.isSecured ?? false,
      }
    })
  }

  return { loanId: loan.id, previousCategory, newCategory, daysOverdue: maxOverdueDays, changed }
}

// ─── Overdue Days Calculation ────────────────────────────────────────────────

/**
 * Finds the oldest unpaid instalment and counts days since it was due.
 * RBI rule: the clock starts from the FIRST unpaid due date.
 * If any instalment is partially paid, it still counts as overdue
 * unless receivedAmount >= dueAmount.
 */
export function calculateMaxOverdueDays(
  instalments: Instalment[],
  today: Date
): number {
  const overdueInstalments = instalments.filter(inst => {
    const dueDate = new Date(inst.dueDate)
    dueDate.setHours(0, 0, 0, 0)
    const isPastDue = dueDate < today
    const isUnpaid = Number(inst.receivedAmount ?? 0) < Number(inst.dueAmount)
    return isPastDue && isUnpaid
  })

  if (overdueInstalments.length === 0) return 0

  // Find the oldest overdue instalment
  const oldestDue = overdueInstalments.reduce((oldest, inst) =>
    new Date(inst.dueDate) < new Date(oldest.dueDate) ? inst : oldest
  )

  const dueDate = new Date(oldestDue.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  const diffMs = today.getTime() - dueDate.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

// ─── Category Determination ──────────────────────────────────────────────────

/**
 * Determines asset category from overdue days.
 * For Doubtful sub-categories, we need the original NPA classification
 * date to measure how long it has been in NPA status.
 */
export function determineCategory(
  daysOverdue: number,
  npaClassifiedAt: Date | null,
  today: Date
): AssetCategory {

  if (daysOverdue === 0) return 'standard'
  if (daysOverdue <= 30)  return 'sma_0'
  if (daysOverdue <= 60)  return 'sma_1'
  if (daysOverdue <= 90)  return 'sma_2'

  // 90+ days = NPA. Now determine sub-category by
  // how long it has been in NPA (from npaClassifiedAt)
  const npaDate = npaClassifiedAt ?? today
  const daysInNpa = Math.floor(
    (today.getTime() - npaDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysInNpa <= 365)  return 'sub_standard'   // 0–12 months in NPA
  if (daysInNpa <= 730)  return 'doubtful_d1'    // 12–24 months in NPA
  if (daysInNpa <= 1095) return 'doubtful_d2'    // 24–36 months in NPA
  return 'doubtful_d3'                            // 36+ months in NPA
}

function getNpaSubCategory(category: AssetCategory): string | null {
  const map: Partial<Record<AssetCategory, string>> = {
    sub_standard: 'sub_standard',
    doubtful_d1:  'd1',
    doubtful_d2:  'd2',
    doubtful_d3:  'd3',
    loss:         'loss',
  }
  return map[category] ?? null
}
```

---

## 7. Provisioning Calculation Engine

### `lib/npa/provisioningCalculator.ts`

```typescript
import type { AssetCategory } from './npaClassifier'

interface ProvisioningResult {
  rate: number      // percentage (e.g., 15 for 15%)
  amount: number    // ₹ amount
  basis: string     // human-readable explanation
}

/**
 * RBI IRACP provisioning rates.
 * For MFIs: all loans are unsecured.
 * isSecured flag retained for NBFC clients who have secured loans.
 */
export function calculateProvisioning(
  category: AssetCategory,
  outstandingAmount: number,
  isSecured: boolean = false
): ProvisioningResult {

  const RATES: Record<AssetCategory, { secured: number; unsecured: number; basis: string }> = {
    standard:     { secured: 0.40, unsecured: 0.40,  basis: 'Standard asset: 0.40% of outstanding' },
    sma_0:        { secured: 0.40, unsecured: 0.40,  basis: 'SMA-0: Standard provisioning maintained' },
    sma_1:        { secured: 0.40, unsecured: 0.40,  basis: 'SMA-1: Standard provisioning maintained' },
    sma_2:        { secured: 0.40, unsecured: 0.40,  basis: 'SMA-2: Standard provisioning maintained' },
    sub_standard: { secured: 15,   unsecured: 15,    basis: 'Sub-Standard: 15% of outstanding' },
    doubtful_d1:  { secured: 25,   unsecured: 100,   basis: 'Doubtful D1: 25% (secured) / 100% (unsecured)' },
    doubtful_d2:  { secured: 40,   unsecured: 100,   basis: 'Doubtful D2: 40% (secured) / 100% (unsecured)' },
    doubtful_d3:  { secured: 100,  unsecured: 100,   basis: 'Doubtful D3: 100% of outstanding' },
    loss:         { secured: 100,  unsecured: 100,   basis: 'Loss: 100% of outstanding' },
    written_off:  { secured: 100,  unsecured: 100,   basis: 'Written-off: 100% provisioned' },
  }

  const rateEntry = RATES[category]
  const rate = isSecured ? rateEntry.secured : rateEntry.unsecured
  const amount = (outstandingAmount * rate) / 100

  return {
    rate,
    amount: Math.round(amount * 100) / 100,  // round to 2 decimal places
    basis: rateEntry.basis,
  }
}

/**
 * Aggregate provisioning across all loans in a tenant.
 * Used for the NPA Report and balance sheet provisioning line item.
 */
export async function getTenantProvisioningSummary(
  tenantId: string,
  asOfDate: Date = new Date()
): Promise<ProvisioningSummary> {
  const snapshots = await prisma.loanProvisioning.findMany({
    where: {
      tenantId,
      snapshotDate: {
        gte: startOfDay(asOfDate),
        lte: endOfDay(asOfDate),
      }
    }
  })

  const summary = {
    standard:     { count: 0, outstanding: 0, provisioning: 0 },
    sma:          { count: 0, outstanding: 0, provisioning: 0 },
    sub_standard: { count: 0, outstanding: 0, provisioning: 0 },
    doubtful:     { count: 0, outstanding: 0, provisioning: 0 },
    loss:         { count: 0, outstanding: 0, provisioning: 0 },
    total:        { count: 0, outstanding: 0, provisioning: 0 },
  }

  for (const s of snapshots) {
    const bucket = getCategoryBucket(s.category as AssetCategory)
    summary[bucket].count++
    summary[bucket].outstanding += Number(s.outstandingAmt)
    summary[bucket].provisioning += Number(s.provisioningAmt)
    summary.total.count++
    summary.total.outstanding += Number(s.outstandingAmt)
    summary.total.provisioning += Number(s.provisioningAmt)
  }

  return summary
}

function getCategoryBucket(category: AssetCategory): keyof ProvisioningSummary {
  if (category === 'standard') return 'standard'
  if (['sma_0', 'sma_1', 'sma_2'].includes(category)) return 'sma'
  if (category === 'sub_standard') return 'sub_standard'
  if (['doubtful_d1', 'doubtful_d2', 'doubtful_d3'].includes(category)) return 'doubtful'
  return 'loss'
}
```

---

## 8. Automated Cron Job

### `app/api/cron/classify-npa/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { runNpaClassification } from '@/lib/npa/npaClassifier'
import { prisma } from '@/lib/prisma'

/**
 * Secured cron endpoint.
 * Schedule: 2:00 AM daily (after penalty accrual which runs at 1:00 AM)
 * On Hostinger VPS with PM2: use node-cron or a system crontab entry.
 */
export async function POST(req: NextRequest) {

  // Verify CRON_SECRET — same pattern as your existing penalty cron
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown>[] = []

  // Get all tenants that have bureau module or NPA module enabled
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true, name: true }
  })

  for (const tenant of tenants) {
    try {
      const result = await runNpaClassification(tenant.id, 'cron_auto')
      results.push({ tenantId: tenant.id, tenantName: tenant.name, ...result })
    } catch (err) {
      results.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        error: (err as Error).message
      })
    }
  }

  return NextResponse.json({
    success: true,
    runDate: new Date().toISOString(),
    results,
  })
}
```

### Hostinger VPS Cron Setup (System Crontab)

```bash
# On your Hostinger VPS — add to system crontab (crontab -e)
# Run NPA classification at 2:00 AM daily (after penalty accrual at 1:00 AM)

0 2 * * * curl -s -X POST \
  -H "x-cron-secret: your_cron_secret_here" \
  https://yourdomain.com/api/cron/classify-npa \
  >> /var/log/zolofund/npa-cron.log 2>&1

# Penalty accrual (existing) at 1:00 AM
0 1 * * * curl -s -X POST \
  -H "x-cron-secret: your_cron_secret_here" \
  https://yourdomain.com/api/cron/accrue-penalties \
  >> /var/log/zolofund/penalty-cron.log 2>&1
```

```bash
# Create log directory on VPS
mkdir -p /var/log/zolofund
touch /var/log/zolofund/npa-cron.log
touch /var/log/zolofund/penalty-cron.log

# Rotate logs weekly (add to /etc/logrotate.d/zolofund)
/var/log/zolofund/*.log {
  weekly
  rotate 52
  compress
  missingok
  notifempty
}
```

---

## 9. NPA Upgrade Path (NPA → Standard)

When a borrower who was classified as NPA resumes regular payments, RBI requires **3 consecutive standard instalments** before upgrading the loan back to Standard (or to SMA if still partially behind). This cannot be automatic — it requires admin review and explicit approval.

### `lib/npa/npaUpgrade.ts`

```typescript
/**
 * Checks if an NPA loan is eligible for upgrade.
 * Eligibility: 3 consecutive instalments paid on time after NPA classification.
 */
export async function checkUpgradeEligibility(loanId: string): Promise<{
  eligible: boolean
  reason: string
  consecutiveCleanInstalments: number
}> {
  const loan = await prisma.loan.findUniqueOrThrow({
    where: { id: loanId },
    include: {
      instalments: {
        orderBy: { dueDate: 'desc' },
        take: 6,   // check last 6 instalments
      }
    }
  })

  // Only NPA loans can be upgraded
  if (!['sub_standard', 'doubtful_d1', 'doubtful_d2', 'doubtful_d3'].includes(
    loan.npaStatus ?? ''
  )) {
    return { eligible: false, reason: 'Loan is not in NPA status', consecutiveCleanInstalments: 0 }
  }

  // Count consecutive paid instalments from most recent backwards
  let consecutive = 0
  for (const inst of loan.instalments) {
    if (inst.status === 'paid' && Number(inst.receivedAmount) >= Number(inst.dueAmount)) {
      consecutive++
    } else {
      break   // stop at first non-clean instalment
    }
  }

  const eligible = consecutive >= 3
  return {
    eligible,
    consecutiveCleanInstalments: consecutive,
    reason: eligible
      ? '3 consecutive clean instalments paid. Eligible for upgrade to Standard.'
      : `Only ${consecutive} consecutive clean instalments. 3 required for upgrade.`
  }
}

/**
 * Admin-triggered upgrade. Requires explicit approval — not automatic.
 */
export async function upgradeNpaToStandard(
  loanId: string,
  adminUserId: string,
  tenantId: string,
  notes: string
): Promise<void> {
  const { eligible, reason } = await checkUpgradeEligibility(loanId)

  if (!eligible) {
    throw new Error(`UPGRADE_NOT_ELIGIBLE: ${reason}`)
  }

  const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId } })
  const provisioning = calculateProvisioning('standard', Number(loan.outstandingAmount), false)

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: loanId },
      data: {
        npaStatus: 'standard',
        npaSubCategory: null,
        npaClassifiedAt: null,  // clear — no longer NPA
        npaDaysOverdue: 0,
        npaUpgradeEligible: false,
        provisioningRate: provisioning.rate,
        provisioningAmount: provisioning.amount,
        status: 'active',
      }
    })

    await tx.npaHistory.create({
      data: {
        tenantId,
        loanId,
        customerId: loan.customerId,
        fromCategory: loan.npaStatus ?? 'sub_standard',
        toCategory: 'standard',
        daysOverdue: 0,
        outstandingAmt: loan.outstandingAmount,
        triggeredBy: 'manual_admin',
        triggeredById: adminUserId,
        notes,
        provisioningRate: provisioning.rate,
        provisioningAmount: provisioning.amount,
      }
    })
  })

  await auditLog.create({
    tenantId,
    userId: adminUserId,
    action: 'npa_upgrade',
    entityType: 'loan',
    entityId: loanId,
    newValue: JSON.stringify({ upgradedTo: 'standard', notes }),
  })
}
```

---

## 10. API Routes

### `app/api/npa/summary/route.ts` — Tenant NPA Summary

```typescript
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  assertRole(session.user.role, ['ADMIN', 'SUPERADMIN'])

  const { searchParams } = new URL(req.url)
  const asOfDate = searchParams.get('date')
    ? new Date(searchParams.get('date')!)
    : new Date()

  const summary = await getTenantProvisioningSummary(session.user.tenantId, asOfDate)

  // Gross NPA ratio = (sub_standard + doubtful + loss outstanding)
  //                   / total loan book outstanding × 100
  const npaOutstanding = summary.sub_standard.outstanding
    + summary.doubtful.outstanding
    + summary.loss.outstanding
  const grossNpaRatio = summary.total.outstanding > 0
    ? (npaOutstanding / summary.total.outstanding) * 100
    : 0

  return NextResponse.json({
    success: true,
    data: {
      ...summary,
      grossNpaRatio: Math.round(grossNpaRatio * 100) / 100,
      asOfDate: asOfDate.toISOString(),
    }
  })
}
```

### `app/api/npa/loans/route.ts` — NPA Loan List

```typescript
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')  // filter by specific category
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = 20

  const where = {
    tenantId: session.user.tenantId,
    npaStatus: category
      ? category
      : { in: ['sma_0', 'sma_1', 'sma_2', 'sub_standard', 'doubtful_d1', 'doubtful_d2', 'doubtful_d3', 'loss'] }
  }

  const [loans, total] = await prisma.$transaction([
    prisma.loan.findMany({
      where,
      select: {
        id: true,
        loanCode: true,
        npaStatus: true,
        npaDaysOverdue: true,
        npaClassifiedAt: true,
        outstandingAmount: true,
        provisioningAmount: true,
        provisioningRate: true,
        npaUpgradeEligible: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { npaDaysOverdue: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.loan.count({ where })
  ])

  return NextResponse.json({ success: true, data: loans, total, page, pageSize })
}
```

### `app/api/npa/upgrade/route.ts` — Admin-Triggered Upgrade

```typescript
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  assertRole(session.user.role, ['ADMIN', 'SUPERADMIN'])

  const { loanId, notes } = await req.json()
  if (!loanId) return NextResponse.json({ success: false, error: 'loanId required' }, { status: 400 })

  await upgradeNpaToStandard(loanId, session.user.id, session.user.tenantId, notes ?? '')

  return NextResponse.json({ success: true })
}
```

---

## 11. NPA Dashboard & Reports UI

### Dashboard Widget Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  NPA OVERVIEW                              As of 23 May 2026  [↻]   │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Gross NPA   │  │  Net NPA     │  │  Provision   │              │
│  │    4.32%     │  │    3.18%     │  │  ₹2,34,500   │              │
│  │  ₹8,90,000   │  │              │  │  Required    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ASSET CLASSIFICATION BUCKETS                                        │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Standard        │ 486 loans │ ₹1,82,40,000 │  ₹72,960 prov│     │
│  │ SMA-0 (1-30d)   │   8 loans │   ₹2,40,000  │   ₹960 prov  │     │
│  │ SMA-1 (31-60d)  │   4 loans │   ₹1,20,000  │   ₹480 prov  │     │
│  │ SMA-2 (61-90d)  │   3 loans │     ₹90,000  │   ₹360 prov  │     │
│  ├────────────────────────────────────────────────────────────┤     │
│  │ Sub-Standard    │  12 loans │   ₹4,80,000  │ ₹72,000 prov │     │
│  │ Doubtful D1     │   3 loans │   ₹2,10,000  │ ₹2,10,000    │     │
│  │ Doubtful D2     │   1 loan  │   ₹1,00,000  │ ₹1,00,000    │     │
│  │ Loss            │   0 loans │        —     │       —      │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  [ View NPA Loan List ]  [ Download NPA Report ]  [ Run Now ]       │
└──────────────────────────────────────────────────────────────────────┘
```

### NPA Loan Detail View (on Loan Profile)

```
┌──────────────────────────────────────────────────────────────────────┐
│  NPA STATUS                                                          │
│                                                                      │
│  Category:    SUB-STANDARD           ← colour-coded badge            │
│  Overdue:     127 days                                               │
│  Since:       15 Jan 2026                                            │
│  Outstanding: ₹18,500                                                │
│  Provision:   ₹2,775  (15%)                                          │
│                                                                      │
│  UPGRADE ELIGIBILITY                                                 │
│  ✗ Not eligible — 1 of 3 required clean instalments paid            │
│                                                                      │
│  NPA HISTORY                                                         │
│  23 May 2026  Sub-Standard → Sub-Standard  (no change, reviewed)    │
│  15 Jan 2026  SMA-2 → Sub-Standard  ← 92 days overdue               │
│  04 Jan 2026  SMA-1 → SMA-2         ← 63 days overdue               │
│  05 Dec 2025  Standard → SMA-1      ← 35 days overdue               │
│                                                                      │
│  [ Upgrade to Standard ]  ← disabled until 3 clean payments         │
└──────────────────────────────────────────────────────────────────────┘
```

### NPA Report for RBI Inspection (CSV/PDF Export)

The report must include these columns to satisfy RBI inspection requirements:

```typescript
const NPA_REPORT_COLUMNS = [
  'Loan Account Number',
  'Borrower Name',
  'Borrower PAN / Aadhar (masked)',
  'Loan Disbursement Date',
  'Loan Amount',
  'Outstanding Amount',
  'Date of Last Payment',
  'Days Past Due (DPD)',
  'Asset Classification',
  'Date of NPA Classification',
  'Provisioning Rate (%)',
  'Provisioning Amount (₹)',
  'Recovery Action Taken',   // admin notes
  'Written Off (Y/N)',
]
```

---

## 12. Prisma Schema Changes

Full migration additions — run as a new Prisma migration:

```prisma
// Add to model Loan:
npaStatus           String   @default("standard")
npaSubCategory      String?
npaDaysOverdue      Int      @default(0)
npaClassifiedAt     DateTime?
npaUpgradeEligible  Boolean  @default(false)
lastNpaReviewDate   DateTime?
provisioningRate    Decimal  @default(0) @db.Decimal(6, 2)
provisioningAmount  Decimal  @default(0) @db.Decimal(12, 2)
provisioningCategory String  @default("standard")
isSecured           Boolean  @default(false)
npaHistory          NpaHistory[]
provisioning        LoanProvisioning[]

@@index([tenantId, npaStatus])       // fast NPA dashboard queries
@@index([tenantId, npaDaysOverdue])  // aging bucket queries

// New models (full definitions in Section 5):
model NpaHistory    { ... }
model LoanProvisioning { ... }
```

```bash
# Run migration on Hostinger VPS
npx prisma migrate dev --name add_npa_classification_engine
npx prisma generate

# Backfill existing loans — run once after migration
# This calculates npaStatus for all currently active loans
curl -X POST https://yourdomain.com/api/cron/classify-npa \
  -H "x-cron-secret: $CRON_SECRET"
```

---

## 13. Audit Trail & RBI Inspection Readiness

### What RBI Inspectors Will Ask For

| Inspector Request | Where It Lives in Your System |
|---|---|
| "Show me your NPA as of 31 March 2026" | `LoanProvisioning` snapshots by `snapshotDate` |
| "How many loans became NPA this quarter?" | `NpaHistory` where `toCategory IN (sub_standard...)` and `createdAt` in range |
| "Show provisioning calculation for loan XYZ" | `LoanProvisioning` + `NpaHistory` for that loan |
| "Were any NPAs manually reclassified?" | `NpaHistory` where `triggeredBy = 'manual_admin'` |
| "Show me the NPA upgrade trail for this borrower" | `NpaHistory` where `toCategory = 'standard'` for that loan |
| "What is your Gross NPA ratio at quarter end?" | Aggregate query on `LoanProvisioning` for quarter-end date |

### Immutability Guarantee

`NpaHistory` and `LoanProvisioning` records must never be editable or deletable by any user role, including Superadmin. Enforce this at the API layer:

```typescript
// In your Prisma middleware or API layer
// Block any DELETE or UPDATE on these tables from application code
prisma.$use(async (params, next) => {
  if (
    ['NpaHistory', 'LoanProvisioning'].includes(params.model ?? '') &&
    ['delete', 'deleteMany', 'update', 'updateMany'].includes(params.action)
  ) {
    throw new Error('IMMUTABLE_RECORD: NPA history and provisioning records cannot be modified.')
  }
  return next(params)
})
```

---

## 14. Testing Strategy

New test cases to add (continuing your ML-xxxx scheme):

| TC ID | What to Test |
|---|---|
| ML-2001 | Loan with 0 overdue days classified as Standard |
| ML-2002 | Loan with 25 days overdue classified as SMA-0 |
| ML-2003 | Loan with 45 days overdue classified as SMA-1 |
| ML-2004 | Loan with 75 days overdue classified as SMA-2 |
| ML-2005 | Loan with 91 days overdue classified as Sub-Standard |
| ML-2006 | Loan in NPA for 366 days upgrades to Doubtful D1 |
| ML-2007 | Loan in NPA for 731 days upgrades to Doubtful D2 |
| ML-2008 | Loan in NPA for 1096 days upgrades to Doubtful D3 |
| ML-2009 | Provisioning = 15% of outstanding for Sub-Standard |
| ML-2010 | Provisioning = 100% for Doubtful D1 (unsecured MFI loan) |
| ML-2011 | Cron runs twice same day: no duplicate NpaHistory records created |
| ML-2012 | Partial payment that still leaves amount outstanding keeps loan in overdue |
| ML-2013 | Fully paid instalment resets overdue counter for that instalment |
| ML-2014 | NPA upgrade blocked when only 2 clean instalments paid |
| ML-2015 | NPA upgrade succeeds after 3 consecutive clean instalments; NpaHistory created |
| ML-2016 | Cron endpoint without CRON_SECRET returns 401 |
| ML-2017 | NpaHistory records cannot be deleted or updated via API |
| ML-2018 | LoanProvisioning snapshot exists for every active loan after cron run |
| ML-2019 | Gross NPA ratio calculation matches manual SQL verification |
| ML-2020 | RBI report export contains all 14 required columns |

---

## 15. Rollout Plan

### Phase 1 — Schema & Engine (2 weeks)

- [ ] Run Prisma migration to extend Loan model and add NpaHistory, LoanProvisioning
- [ ] Implement `npaClassifier.ts` and `provisioningCalculator.ts`
- [ ] Write unit tests for `calculateMaxOverdueDays` and `determineCategory` (ML-2001 to ML-2012)
- [ ] Set up cron job on Hostinger VPS (system crontab at 2:00 AM)
- [ ] Run backfill on existing loan data — classify all active loans immediately
- [ ] Add Prisma middleware to block mutations on NpaHistory and LoanProvisioning

### Phase 2 — UI & Reports (1 week)

- [ ] Build NPA dashboard widget in admin dashboard
- [ ] Add NPA status badge and history timeline to loan detail page
- [ ] Build NPA loan list with category filter and aging buckets
- [ ] Add NPA upgrade eligibility check and admin upgrade button
- [ ] Build RBI-ready NPA report export (CSV + PDF)

### Phase 3 — Hardening (1 week)

- [ ] Add cron monitoring — alert admin if cron hasn't run in 25 hours
- [ ] Verify log rotation on VPS
- [ ] Run full test suite ML-2001 to ML-2020
- [ ] Dry-run RBI inspection scenario with a pilot tenant's data

---

## Quick Reference — NPA Category Cheatsheet

| Days Overdue | Category | RBI Code | Provisioning (Unsecured) |
|---|---|---|---|
| 0 | Standard | STD | 0.40% |
| 1–30 | SMA-0 | SMA-0 | 0.40% |
| 31–60 | SMA-1 | SMA-1 | 0.40% |
| 61–90 | SMA-2 | SMA-2 | 0.40% |
| 91–365 days overdue | Sub-Standard | SS | 15% |
| NPA 12–24 months | Doubtful D1 | D1 | 100% |
| NPA 24–36 months | Doubtful D2 | D2 | 100% |
| NPA 36+ months | Doubtful D3 | D3 | 100% |
| Identified as loss | Loss | LA | 100% |

---

*Document version 1.0 — ZoloFund NPA Classification Engine*  
*Regulatory reference: RBI Master Circular IRACP 2023; RBI/2023-24/18 DOR.STR.REC.10/21.04.048/2023-24*
