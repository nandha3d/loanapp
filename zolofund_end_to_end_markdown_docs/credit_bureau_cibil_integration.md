# Credit Bureau / CIBIL Pull — Add-on Implementation Guide

**For:** ZoloFund Micro Lending — Licensed Small MFIs & NBFCs  
**Type:** Add-on Module (Bureau Connect)  
**Regulatory basis:** RBI Master Direction on NBFC — Credit Information Reporting, 2022

---

## Table of Contents

1. [Why This Add-on Exists](#1-why-this-add-on-exists)
2. [How Credit Bureau APIs Work in India](#2-how-credit-bureau-apis-work-in-india)
3. [Which Bureau to Integrate First](#3-which-bureau-to-integrate-first)
4. [Architecture Overview](#4-architecture-overview)
5. [Database Schema Changes](#5-database-schema-changes)
6. [Backend Implementation](#6-backend-implementation)
7. [Frontend Implementation](#7-frontend-implementation)
8. [Prisma Schema Addition](#8-prisma-schema-addition)
9. [API Routes](#9-api-routes)
10. [Bureau Report Display — UI Spec](#10-bureau-report-display--ui-spec)
11. [Consent & Compliance Layer](#11-consent--compliance-layer)
12. [Soft Pull vs Hard Pull — When to Use Each](#12-soft-pull-vs-hard-pull--when-to-use-each)
13. [Error Handling & Fallback Logic](#13-error-handling--fallback-logic)
14. [Cost Management](#14-cost-management)
15. [RBI Reporting Obligation (Furnishing)](#15-rbi-reporting-obligation-furnishing)
16. [Testing Strategy](#16-testing-strategy)
17. [Rollout Plan](#17-rollout-plan)

---

## 1. Why This Add-on Exists

Small MFIs and NBFCs in India are legally required by RBI to:

- Check borrower credit history before disbursing loans above ₹50,000
- Report loan creation, repayment, and default events back to at least one Credit Information Company (CIC)
- Maintain evidence of bureau checks as part of KYC/loan file for audits

Without a bureau pull, regulated lenders are:
- Exposed to **regulatory penalty** during RBI inspection
- Blind to **serial borrowers** (customers simultaneously borrowing from 5 lenders)
- Unable to price risk correctly (over-lending to high-risk customers)

This add-on adds the "Bureau Connect" module that:
1. Pulls a credit report at loan origination (hard pull with borrower consent)
2. Displays a parsed, actionable summary in the loan form
3. Stores the raw bureau response for audit purposes
4. Optionally runs a soft pull during customer creation for early screening

---

## 2. How Credit Bureau APIs Work in India

India has four licensed CICs under the Credit Information Companies (Regulation) Act, 2005:

| Bureau | API Product Name | Best For |
|---|---|---|
| **TransUnion CIBIL** | CIBIL Consumer Credit Information Report (CCIR) | Most widely recognised; largest dataset |
| **Experian India** | Experian Credit Report | Strong on thin-file customers (new-to-credit) |
| **Equifax India** | Equifax Credit Report | Good rural/microfinance data |
| **CRIF High Mark** | CRIF MFI Report | **Best for MFI use case** — specialised MFI bureau |

> **Recommendation for MFIs**: Integrate **CRIF High Mark first** (MFI-specific bureau with JLG/SHG data), then **TransUnion CIBIL** second. CRIF has the deepest microfinance lending history in India.

### How a Pull Works (Simplified)

```
Your App → Bureau API → Bureau DB → Credit Report JSON/XML → Your App → Display
```

1. You send: borrower PAN / Aadhar / Name / DOB / Address
2. Bureau matches against their records (fuzzy match if no PAN)
3. Bureau returns: credit score + full trade line history + enquiry history
4. You parse and store the response
5. You display a summary to the loan officer
6. You store the raw response for audit (RBI requires 7-year retention)

### Authentication

All Indian bureau APIs use:
- **Mutual TLS (mTLS)** — you provide a client certificate they issue
- **API Key + Secret** — for request signing
- **IP Whitelisting** — your server IP must be pre-registered

This means bureau API calls **must always go server-to-server**. Never call bureau APIs from the browser/client.

---

## 3. Which Bureau to Integrate First

### Decision Matrix

| Factor | CRIF High Mark | CIBIL | Experian |
|---|---|---|---|
| MFI-specific data | ✅ Best | ❌ Limited | ❌ Limited |
| API documentation quality | Good | Excellent | Good |
| Sandbox availability | ✅ Yes | ✅ Yes | ✅ Yes |
| Onboarding time | 2–4 weeks | 4–6 weeks | 3–5 weeks |
| Cost per pull (approx) | ₹18–25 | ₹25–35 | ₹20–28 |
| Minimum volume commitment | Low | Medium | Low |

**Start with CRIF High Mark** for your MFI target customers. Add CIBIL as the second integration (larger NBFCs will require it).

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ZoloFund App                            │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │  Loan Form   │───▶│  Bureau Service │───▶│  Bureau Store │  │
│  │  (Frontend)  │    │  (Server-side)  │    │  (DB + S3)    │  │
│  └──────────────┘    └────────┬────────┘    └───────────────┘  │
│                               │                                 │
└───────────────────────────────┼─────────────────────────────────┘
                                │ mTLS + API Key
                                ▼
                  ┌─────────────────────────┐
                  │   Bureau API Gateway    │
                  │  (CRIF / CIBIL / etc.)  │
                  └─────────────────────────┘
```

### Key Design Decisions

- **All bureau calls are server-side only** — no credentials in the browser
- **Raw response is encrypted and stored** — never expose full bureau data to UI; parse and display summary only
- **Consent is recorded before every pull** — stored with timestamp and IP
- **Pull is cached per customer per 30 days** — avoid charging the lender twice for the same customer within a short window
- **Bureau module is feature-flagged** — only enabled for tenants on the Bureau Connect add-on plan

---

## 5. Database Schema Changes

### New Tables Required

```sql
-- Stores every bureau pull request and its result
BureauReport {
  id              String    @id @default(cuid())
  tenantId        String
  customerId      String
  loanId          String?   -- null for soft pulls during customer creation
  bureauProvider  String    -- 'CRIF' | 'CIBIL' | 'EXPERIAN' | 'EQUIFAX'
  pullType        String    -- 'hard' | 'soft'
  requestId       String    @unique  -- bureau's own reference ID
  status          String    -- 'pending' | 'success' | 'no_match' | 'error'
  
  -- Parsed summary (fast to query, shown in UI)
  creditScore     Int?      -- null if no match / no score
  scoreModel      String?   -- 'CIBIL V2' | 'CRIF MFI Score' etc.
  totalAccounts   Int?
  activeAccounts  Int?
  overdueAccounts Int?
  totalOverdueAmt Decimal?
  enquiryCount90d Int?      -- number of enquiries in last 90 days (serial borrower signal)
  
  -- Raw encrypted response (for audit, never shown in UI)
  rawResponsePath String?   -- path to encrypted file in S3/storage
  rawResponseHash String?   -- SHA-256 of raw response for integrity verification
  
  -- Consent tracking
  consentText     String    -- exact text shown to borrower
  consentObtained Boolean   @default(false)
  consentTimestamp DateTime?
  consentIp       String?
  consentMethod   String?   -- 'written' | 'verbal_recorded' | 'digital_otp'
  
  -- Validity window
  validUntil      DateTime  -- pull result valid for 30 days (configurable)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  customer        Customer  @relation(fields: [customerId], references: [id])
  loan            Loan?     @relation(fields: [loanId], references: [id])

  @@index([customerId, createdAt])
  @@index([tenantId, createdAt])
}

-- Stores bureau API credentials per tenant (encrypted)
BureauCredential {
  id              String    @id @default(cuid())
  tenantId        String    @unique
  provider        String    -- 'CRIF' | 'CIBIL'
  memberId        String    -- encrypted
  apiKey          String    -- encrypted
  apiSecret       String    -- encrypted
  certificatePath String    -- path to mTLS certificate in secure storage
  environment     String    -- 'sandbox' | 'production'
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

---

## 6. Backend Implementation

### 6.1 Bureau Service (`lib/bureau/bureauService.ts`)

```typescript
import { prisma } from '@/lib/prisma'
import { encryptField, decryptField } from '@/lib/pii'
import { CRIFClient } from './providers/crif'
import { CIBILClient } from './providers/cibil'
import { auditLog } from '@/lib/logger'

export type BureauProvider = 'CRIF' | 'CIBIL' | 'EXPERIAN'
export type PullType = 'hard' | 'soft'

export interface BureauPullInput {
  customerId: string
  tenantId: string
  loanId?: string
  pullType: PullType
  provider?: BureauProvider  // defaults to tenant's primary bureau
  consentObtained: boolean
  consentMethod: 'written' | 'verbal_recorded' | 'digital_otp'
  requestedByUserId: string
  requestIp: string
}

export interface BureauSummary {
  reportId: string
  status: 'success' | 'no_match' | 'error'
  creditScore: number | null
  scoreModel: string | null
  scoreLabel: string | null       // 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'NH' | 'NA'
  totalAccounts: number
  activeAccounts: number
  overdueAccounts: number
  totalOverdueAmt: number
  enquiryCount90d: number         // KEY: serial borrower detection
  activeMFILoans: number          // CRIF-specific: active MFI loan count
  activeMFILoanAmt: number        // CRIF-specific: total active MFI outstanding
  writtenOffAccounts: number
  suitFiledAccounts: number
  reportDate: Date
  validUntil: Date
  fromCache: boolean
}

/**
 * Main entry point — pull bureau report or return cached result.
 */
export async function pullBureauReport(
  input: BureauPullInput
): Promise<BureauSummary> {

  // 1. Check subscription — is bureau module enabled for this tenant?
  await assertBureauModuleEnabled(input.tenantId)

  // 2. Check consent — never pull without it
  if (!input.consentObtained) {
    throw new Error('CONSENT_REQUIRED: Bureau pull requires explicit borrower consent.')
  }

  // 3. Check cache — avoid double-charging for recent pulls
  const cached = await getValidCachedReport(input.customerId, input.tenantId)
  if (cached && input.pullType === 'soft') {
    return { ...cached, fromCache: true }
  }

  // 4. Get customer PII for bureau query
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: input.customerId },
    select: {
      name: true,
      phone: true,
      aadharNumber: true,  // encrypted — will decrypt below
      panNumber: true,     // encrypted
      dob: true,
      address: true,
      city: true,
      pincode: true,
    }
  })

  // 5. Get bureau credentials for tenant
  const credentials = await getBureauCredentials(
    input.tenantId,
    input.provider ?? 'CRIF'
  )

  // 6. Build the bureau query payload
  const queryPayload = {
    name: customer.name,
    dob: customer.dob,
    pan: customer.panNumber ? decryptField(customer.panNumber) : null,
    aadhar: customer.aadharNumber ? decryptField(customer.aadharNumber) : null,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    pincode: customer.pincode,
  }

  // 7. Create a pending record in DB before calling bureau
  const pendingReport = await prisma.bureauReport.create({
    data: {
      tenantId: input.tenantId,
      customerId: input.customerId,
      loanId: input.loanId ?? null,
      bureauProvider: credentials.provider,
      pullType: input.pullType,
      requestId: `PENDING-${Date.now()}`,
      status: 'pending',
      consentText: getConsentText(credentials.provider),
      consentObtained: true,
      consentTimestamp: new Date(),
      consentIp: input.requestIp,
      consentMethod: input.consentMethod,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }
  })

  try {
    // 8. Call the bureau API
    const client = getBureauClient(credentials)
    const rawResponse = await client.fetchReport(queryPayload)

    // 9. Parse the raw response into a summary
    const parsed = client.parseResponse(rawResponse)

    // 10. Encrypt and store the raw response
    const rawPath = await storeEncryptedRawResponse(
      pendingReport.id,
      input.tenantId,
      rawResponse
    )

    // 11. Update the DB record with results
    const updatedReport = await prisma.bureauReport.update({
      where: { id: pendingReport.id },
      data: {
        requestId: parsed.bureauRequestId,
        status: parsed.status,
        creditScore: parsed.creditScore,
        scoreModel: parsed.scoreModel,
        totalAccounts: parsed.totalAccounts,
        activeAccounts: parsed.activeAccounts,
        overdueAccounts: parsed.overdueAccounts,
        totalOverdueAmt: parsed.totalOverdueAmt,
        enquiryCount90d: parsed.enquiryCount90d,
        rawResponsePath: rawPath,
        rawResponseHash: parsed.responseHash,
      }
    })

    // 12. Audit log the pull
    await auditLog.create({
      tenantId: input.tenantId,
      userId: input.requestedByUserId,
      action: 'bureau_pull',
      entityType: 'customer',
      entityId: input.customerId,
      newValue: JSON.stringify({
        provider: credentials.provider,
        pullType: input.pullType,
        score: parsed.creditScore,
        status: parsed.status,
        reportId: updatedReport.id,
      })
    })

    return buildSummaryResponse(updatedReport, false)

  } catch (err) {
    // Update record to error state — don't leave it as pending
    await prisma.bureauReport.update({
      where: { id: pendingReport.id },
      data: { status: 'error' }
    })
    throw err
  }
}

/**
 * Returns cached report if it's within validity window (30 days).
 */
async function getValidCachedReport(
  customerId: string,
  tenantId: string
): Promise<BureauSummary | null> {
  const cached = await prisma.bureauReport.findFirst({
    where: {
      customerId,
      tenantId,
      status: 'success',
      validUntil: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!cached) return null
  return buildSummaryResponse(cached, true)
}

function getScoreLabel(score: number | null, provider: string): string | null {
  if (!score) return 'NH' // No History
  if (provider === 'CRIF') {
    if (score >= 750) return 'Excellent'
    if (score >= 650) return 'Good'
    if (score >= 500) return 'Fair'
    return 'Poor'
  }
  // CIBIL scale: 300-900
  if (score >= 750) return 'Excellent'
  if (score >= 650) return 'Good'
  if (score >= 550) return 'Fair'
  if (score >= 350) return 'Poor'
  return 'NA'
}
```

---

### 6.2 CRIF High Mark Provider (`lib/bureau/providers/crif.ts`)

```typescript
import https from 'https'
import fs from 'fs'
import { createHash } from 'crypto'

/**
 * CRIF High Mark uses REST/JSON API with mTLS.
 * Endpoint: https://api.crifhighmark.com/mfi/v2/report
 * Docs: Available after signing NDA + member agreement
 */
export class CRIFClient {

  private apiKey: string
  private memberId: string
  private agent: https.Agent

  constructor(credentials: { apiKey: string; memberId: string; certPath: string; keyPath: string }) {
    this.apiKey = credentials.apiKey
    this.memberId = credentials.memberId
    // mTLS: attach client certificate for every request
    this.agent = new https.Agent({
      cert: fs.readFileSync(credentials.certPath),
      key: fs.readFileSync(credentials.keyPath),
      rejectUnauthorized: true,
    })
  }

  async fetchReport(input: BureauQueryInput): Promise<string> {
    const payload = {
      InquiryRequestInfo: {
        InquiryPurpose: '35',             // 35 = Loan origination
        TransactionID: `TXN${Date.now()}`,
        InquiryMemberInfo: {
          MemberRefNo: this.memberId,
          MemberUserId: this.apiKey,
        },
        Applicant: {
          Names: [{ Name: input.name }],
          PhoneNumbers: input.phone ? [{ Number: input.phone, Type: '01' }] : [],
          IDs: [
            input.pan   ? { ID: input.pan,    IDType: '01' } : null,  // 01 = PAN
            input.aadhar ? { ID: input.aadhar, IDType: '07' } : null, // 07 = Aadhar
          ].filter(Boolean),
          Addresses: [{
            FirstLine: input.address,
            City: input.city,
            PIN: input.pincode,
            State: '',
            AddressType: '01',
          }],
          DateOfBirth: input.dob ? formatDate(input.dob) : undefined,
        }
      }
    }

    const response = await fetch('https://api.crifhighmark.com/mfi/v2/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'x-member-id': this.memberId,
      },
      // @ts-ignore — Node fetch with custom agent
      agent: this.agent,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(`CRIF API error ${response.status}: ${errBody}`)
    }

    return response.text() // Return raw JSON string for storage
  }

  parseResponse(rawJson: string): ParsedBureauResponse {
    const data = JSON.parse(rawJson)
    const report = data?.InquiryResponseInfo?.CreditProfileHeader

    // No match
    if (!report || data.InquiryResponseInfo?.Status === 'N') {
      return {
        bureauRequestId: data?.InquiryResponseInfo?.SubjectReturnCode ?? 'NOMATCH',
        status: 'no_match',
        creditScore: null,
        scoreModel: null,
        totalAccounts: 0,
        activeAccounts: 0,
        overdueAccounts: 0,
        totalOverdueAmt: 0,
        enquiryCount90d: 0,
        activeMFILoans: 0,
        activeMFILoanAmt: 0,
        writtenOffAccounts: 0,
        suitFiledAccounts: 0,
        responseHash: createHash('sha256').update(rawJson).digest('hex'),
      }
    }

    const scores = data.InquiryResponseInfo?.Scores?.Score ?? []
    const crifScore = scores.find((s: any) => s.Type === 'CRIF_HIGHMARK_PERSONAL_LOAN_SCORE')

    const accounts = data.InquiryResponseInfo?.Tradelines?.Tradeline ?? []
    const activeAccounts = accounts.filter((a: any) => a.AccountStatus === '11').length  // 11 = Active
    const overdueAccounts = accounts.filter((a: any) => Number(a.OverdueAmount ?? 0) > 0).length
    const mfiAccounts = accounts.filter((a: any) => a.AccountType === '10')  // 10 = MFI loan

    // Enquiries in last 90 days
    const enquiries = data.InquiryResponseInfo?.Enquiries?.Enquiry ?? []
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const recentEnquiries = enquiries.filter((e: any) =>
      new Date(e.Date) >= ninetyDaysAgo
    ).length

    return {
      bureauRequestId: data.InquiryResponseInfo?.UniqueResponseID ?? '',
      status: 'success',
      creditScore: crifScore ? parseInt(crifScore.Value) : null,
      scoreModel: crifScore?.Type ?? null,
      totalAccounts: accounts.length,
      activeAccounts,
      overdueAccounts,
      totalOverdueAmt: accounts.reduce(
        (s: number, a: any) => s + Number(a.OverdueAmount ?? 0), 0
      ),
      enquiryCount90d: recentEnquiries,
      activeMFILoans: mfiAccounts.filter((a: any) => a.AccountStatus === '11').length,
      activeMFILoanAmt: mfiAccounts
        .filter((a: any) => a.AccountStatus === '11')
        .reduce((s: number, a: any) => s + Number(a.CurrentBalance ?? 0), 0),
      writtenOffAccounts: accounts.filter((a: any) => a.AccountStatus === '13').length,
      suitFiledAccounts: accounts.filter((a: any) => a.SuitFiled === 'Y').length,
      responseHash: createHash('sha256').update(rawJson).digest('hex'),
    }
  }
}
```

---

### 6.3 Store Encrypted Raw Response (`lib/bureau/storage.ts`)

```typescript
import { encrypt } from '@/lib/pii'
import { writeFile } from 'fs/promises'
import path from 'path'

/**
 * Encrypts and stores the raw bureau response.
 * RBI requires 7-year retention of bureau data.
 * Store in private/bureau/{tenantId}/{reportId}.enc
 */
export async function storeEncryptedRawResponse(
  reportId: string,
  tenantId: string,
  rawResponse: string
): Promise<string> {
  const encrypted = encrypt(rawResponse)   // AES-256 using your existing PII encryption
  const filePath = path.join(
    'private', 'bureau', tenantId, `${reportId}.enc`
  )
  await writeFile(filePath, encrypted, 'utf-8')
  return filePath
}
```

---

## 7. Frontend Implementation

### 7.1 Bureau Pull Button in Loan Form (`LoanForm.tsx` addition)

```tsx
'use client'
import { useState } from 'react'
import { pullBureauReportAction } from '@/app/(dashboard)/loans/bureauActions'
import { BureauReportCard } from '@/components/bureau/BureauReportCard'

// Add this inside LoanForm, after customer selection
export function BureauSection({
  customerId,
  loanId,
}: {
  customerId: string | null
  loanId?: string
}) {
  const [report, setReport] = useState<BureauSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!customerId) return null

  async function handlePull() {
    if (!consentConfirmed) return
    setLoading(true)
    setError(null)
    try {
      const result = await pullBureauReportAction({ customerId: customerId!, loanId })
      setReport(result)
    } catch (err: any) {
      setError(err.message ?? 'Bureau pull failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bureau-section">
      <h3>Credit Bureau Check</h3>

      {!report && (
        <div className="consent-block">
          <label>
            <input
              type="checkbox"
              checked={consentConfirmed}
              onChange={(e) => setConsentConfirmed(e.target.checked)}
            />
            {' '}I confirm that the borrower has provided verbal/written consent for a
            credit bureau enquiry as per RBI guidelines.
          </label>
          <button
            onClick={handlePull}
            disabled={!consentConfirmed || loading}
          >
            {loading ? 'Fetching Report…' : 'Pull Bureau Report'}
          </button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {report && <BureauReportCard report={report} />}
    </div>
  )
}
```

---

### 7.2 Bureau Report Card Component (`components/bureau/BureauReportCard.tsx`)

```tsx
import type { BureauSummary } from '@/lib/bureau/bureauService'

const SCORE_COLOR = {
  Excellent: '#16a34a',
  Good:      '#65a30d',
  Fair:      '#d97706',
  Poor:      '#dc2626',
  NH:        '#6b7280',
  NA:        '#6b7280',
}

const RISK_FLAGS = (report: BureauSummary) => [
  {
    label: 'Active MFI Loans',
    value: report.activeMFILoans,
    warn: report.activeMFILoans >= 3,
    tooltip: 'RBI limits MFI borrowers to max 3 simultaneous MFI loans',
  },
  {
    label: 'Enquiries (90 days)',
    value: report.enquiryCount90d,
    warn: report.enquiryCount90d >= 5,
    tooltip: '5+ enquiries in 90 days suggests serial borrowing',
  },
  {
    label: 'Overdue Accounts',
    value: report.overdueAccounts,
    warn: report.overdueAccounts > 0,
    tooltip: 'Any active overdue amount across lenders',
  },
  {
    label: 'Written-off Accounts',
    value: report.writtenOffAccounts,
    warn: report.writtenOffAccounts > 0,
    tooltip: 'Accounts written off by previous lenders',
  },
  {
    label: 'Suit Filed',
    value: report.suitFiledAccounts,
    warn: report.suitFiledAccounts > 0,
    tooltip: 'Legal action filed by a previous lender',
  },
]

export function BureauReportCard({ report }: { report: BureauSummary }) {
  if (report.status === 'no_match') {
    return (
      <div className="bureau-card no-match">
        <span>No bureau record found. This may be a new-to-credit borrower.</span>
        <small>Report ID: {report.reportId} — NH (No History)</small>
      </div>
    )
  }

  const scoreColor = SCORE_COLOR[report.scoreLabel ?? 'NA']
  const flags = RISK_FLAGS(report)
  const hasRedFlags = flags.some(f => f.warn)

  return (
    <div className={`bureau-card ${hasRedFlags ? 'has-warning' : 'clear'}`}>

      {/* Score Block */}
      <div className="score-block">
        <div className="score-value" style={{ color: scoreColor }}>
          {report.creditScore ?? 'NH'}
        </div>
        <div className="score-label" style={{ color: scoreColor }}>
          {report.scoreLabel}
        </div>
        <div className="score-model">{report.scoreModel}</div>
        {report.fromCache && (
          <div className="cache-badge">Cached — valid until {report.validUntil.toLocaleDateString()}</div>
        )}
      </div>

      {/* Risk Flags */}
      <div className="risk-flags">
        <h4>Risk Indicators</h4>
        {flags.map(flag => (
          <div
            key={flag.label}
            className={`flag-row ${flag.warn ? 'flag-warn' : 'flag-ok'}`}
            title={flag.tooltip}
          >
            <span className="flag-label">{flag.label}</span>
            <span className="flag-value">{flag.value}</span>
            {flag.warn && <span className="flag-icon">⚠</span>}
          </div>
        ))}
      </div>

      {/* Account Summary */}
      <div className="account-summary">
        <div className="summary-row">
          <span>Total Accounts</span><span>{report.totalAccounts}</span>
        </div>
        <div className="summary-row">
          <span>Active</span><span>{report.activeAccounts}</span>
        </div>
        <div className="summary-row warn">
          <span>Total Overdue</span>
          <span>₹{report.totalOverdueAmt.toLocaleString('en-IN')}</span>
        </div>
        <div className="summary-row">
          <span>Active MFI Outstanding</span>
          <span>₹{report.activeMFILoanAmt.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="bureau-footer">
        <small>Report ID: {report.reportId} · Pulled: {new Date().toLocaleDateString('en-IN')}</small>
        <small>Full report stored securely for audit purposes.</small>
      </div>
    </div>
  )
}
```

---

## 8. Prisma Schema Addition

Add to your existing `prisma/schema.prisma`:

```prisma
model BureauReport {
  id               String    @id @default(cuid())
  tenantId         String
  customerId       String
  loanId           String?
  bureauProvider   String
  pullType         String
  requestId        String    @unique
  status           String    @default("pending")

  creditScore      Int?
  scoreModel       String?
  totalAccounts    Int?
  activeAccounts   Int?
  overdueAccounts  Int?
  totalOverdueAmt  Decimal?  @db.Decimal(12, 2)
  enquiryCount90d  Int?
  activeMFILoans   Int?
  activeMFILoanAmt Decimal?  @db.Decimal(12, 2)
  writtenOffAccounts Int?
  suitFiledAccounts  Int?

  rawResponsePath  String?
  rawResponseHash  String?

  consentText      String    @db.Text
  consentObtained  Boolean   @default(false)
  consentTimestamp DateTime?
  consentIp        String?
  consentMethod    String?

  validUntil       DateTime

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  customer         Customer  @relation(fields: [customerId], references: [id])
  loan             Loan?     @relation(fields: [loanId], references: [id])

  @@index([customerId, createdAt])
  @@index([tenantId, createdAt])
  @@map("bureau_reports")
}

model BureauCredential {
  id              String   @id @default(cuid())
  tenantId        String   @unique
  provider        String
  memberId        String   // encrypted at application layer
  apiKey          String   // encrypted
  apiSecret       String   // encrypted
  certPath        String
  environment     String   @default("sandbox")
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("bureau_credentials")
}
```

---

## 9. API Routes

### `app/api/bureau/pull/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pullBureauReport } from '@/lib/bureau/bureauService'
import { assertRole } from '@/lib/rbac'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  // Only Admin and above can initiate bureau pulls
  assertRole(session.user.role, ['ADMIN', 'SUPERADMIN'])

  const body = await req.json()
  const { customerId, loanId, pullType, consentObtained, consentMethod } = body

  if (!customerId) {
    return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 })
  }
  if (!consentObtained) {
    return NextResponse.json({ success: false, error: 'Borrower consent is required before bureau pull' }, { status: 400 })
  }

  const summary = await pullBureauReport({
    customerId,
    loanId,
    pullType: pullType ?? 'hard',
    tenantId: session.user.tenantId,
    consentObtained,
    consentMethod: consentMethod ?? 'verbal_recorded',
    requestedByUserId: session.user.id,
    requestIp: req.headers.get('x-forwarded-for') ?? 'unknown',
  })

  return NextResponse.json({ success: true, data: summary })
}
```

### `app/api/bureau/history/[customerId]/route.ts`

```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { customerId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const reports = await prisma.bureauReport.findMany({
    where: {
      customerId: params.customerId,
      tenantId: session.user.tenantId,   // tenant isolation enforced
    },
    select: {
      id: true,
      bureauProvider: true,
      pullType: true,
      status: true,
      creditScore: true,
      scoreModel: true,
      enquiryCount90d: true,
      overdueAccounts: true,
      activeMFILoans: true,
      consentTimestamp: true,
      consentMethod: true,
      createdAt: true,
      validUntil: true,
      // rawResponsePath intentionally excluded — never exposed via API
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json({ success: true, data: reports })
}
```

---

## 10. Bureau Report Display — UI Spec

### What to Show (Loan Officer View)

```
┌──────────────────────────────────────────────────────┐
│  CREDIT BUREAU REPORT          CRIF High Mark  [i]   │
│                                                      │
│         ┌─────────┐                                  │
│         │   712   │  ← Score (colour-coded)          │
│         │  GOOD   │                                  │
│         └─────────┘                                  │
│                                                      │
│  ⚠  RISK FLAGS                                       │
│  ┌─────────────────────────────────────────────┐     │
│  │ Active MFI Loans      2     ✓ Within limit  │     │
│  │ Enquiries (90 days)   7     ⚠ High activity │     │
│  │ Overdue Accounts      0     ✓ None           │     │
│  │ Written-off Accounts  0     ✓ None           │     │
│  │ Suit Filed            0     ✓ None           │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ACCOUNT SUMMARY                                     │
│  Total Accounts         8                            │
│  Active                 3                            │
│  Total Overdue Amount   ₹0                           │
│  Active MFI Outstanding ₹24,000                      │
│                                                      │
│  Report ID: RPT-2026-0023 · 23/05/2026              │
│  Valid until: 22/06/2026 · Stored for audit ✓        │
└──────────────────────────────────────────────────────┘
```

### What to NEVER Show in UI

- Raw bureau JSON or XML
- Full Aadhar or PAN numbers (already masked in your system)
- Individual trade line details (account numbers of other lenders)
- Any data that could be exported in bulk

---

## 11. Consent & Compliance Layer

### Required by RBI / CIC Regulations

Every bureau pull must have documented consent. For your app:

```typescript
// Consent text must be stored exactly as shown to borrower
export function getConsentText(provider: string): string {
  return `I, the applicant, hereby authorize ${
    provider === 'CRIF' ? 'CRIF High Mark Credit Information Services Pvt. Ltd.' :
    provider === 'CIBIL' ? 'TransUnion CIBIL Limited' : provider
  } to access my credit information for the purpose of loan processing by this institution. 
  I understand that this enquiry will be recorded in my credit history. 
  Consent Date: ${new Date().toLocaleDateString('en-IN')}.`
}
```

### Consent Methods to Support

| Method | When to Use | How to Capture |
|---|---|---|
| `digital_otp` | Online applications | OTP to registered mobile before pull |
| `written` | In-person applications | Scanned form uploaded to customer KYC |
| `verbal_recorded` | Field agent loans | Agent checks checkbox confirming verbal consent |

> For RBI inspection readiness, `digital_otp` is the strongest. Push your users towards it for loans above ₹50,000.

---

## 12. Soft Pull vs Hard Pull — When to Use Each

| | Soft Pull | Hard Pull |
|---|---|---|
| **Recorded in borrower credit history** | ❌ No | ✅ Yes |
| **When to trigger** | Customer creation / early screening | Loan origination (before disbursement) |
| **Cost** | Lower (bureau-dependent) | Standard rate |
| **Requires borrower consent** | Yes (lighter form) | Yes (full consent) |
| **Result cached for** | 30 days | 30 days |
| **Use case** | Agent pre-screening before involving admin | Final underwriting decision |

### Implementation Hook

```typescript
// Trigger soft pull automatically when customer is approved (status → active)
// in customers/actions.ts, after approval:
if (tenant.bureauModuleEnabled && customer.approvedAt) {
  await pullBureauReport({
    customerId: customer.id,
    pullType: 'soft',
    consentObtained: true,   // consent given during customer creation KYC
    consentMethod: 'written',
    ...
  })
}
```

---

## 13. Error Handling & Fallback Logic

```typescript
export type BureauErrorCode =
  | 'CONSENT_REQUIRED'
  | 'MODULE_NOT_ENABLED'
  | 'BUREAU_TIMEOUT'
  | 'BUREAU_MAINTENANCE'
  | 'NO_MATCH'
  | 'INSUFFICIENT_IDENTITY'  // not enough PAN/Aadhar to query
  | 'QUOTA_EXCEEDED'

// In your loan form, handle each case differently:
const ERROR_MESSAGES: Record<BureauErrorCode, string> = {
  CONSENT_REQUIRED:        'Please confirm borrower consent before pulling report.',
  MODULE_NOT_ENABLED:      'Bureau Connect add-on is not active for your account.',
  BUREAU_TIMEOUT:          'Bureau is taking too long. You can proceed and pull again before disbursement.',
  BUREAU_MAINTENANCE:      'Bureau API is under maintenance. Retry in 30 minutes.',
  NO_MATCH:                'No bureau record found. Borrower may be new-to-credit.',
  INSUFFICIENT_IDENTITY:   'Add PAN or Aadhar to get a bureau report for this customer.',
  QUOTA_EXCEEDED:          'Monthly bureau pull quota reached. Contact support to increase limit.',
}
```

### Fallback Policy

When a bureau pull fails at loan origination:
1. **Log the failure** with timestamp in `BureauReport.status = 'error'`
2. **Do not block the loan** — allow admin to proceed with manual underwriting
3. **Flag the loan** with `bureauStatus = 'pull_failed'` so it appears in an exceptions report
4. **Require admin sign-off** on the loan detail page before disbursement if bureau is unavailable

---

## 14. Cost Management

Bureau pulls cost real money. Build controls:

```typescript
// lib/bureau/quotaManager.ts

export async function checkAndDeductBureauQuota(
  tenantId: string
): Promise<void> {
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { bureauPullsIncluded: true, bureauPullsUsed: true }
  })

  if (!subscription) throw new Error('MODULE_NOT_ENABLED')

  // Check cache first — if valid cached result exists, no quota deducted
  if (subscription.bureauPullsUsed >= subscription.bureauPullsIncluded) {
    throw new Error('QUOTA_EXCEEDED')
  }

  await prisma.tenantSubscription.update({
    where: { tenantId },
    data: { bureauPullsUsed: { increment: 1 } }
  })
}
```

### Suggested Pricing Tiers for Your Add-on

| Plan | Bureau Pulls / Month | Price |
|---|---|---|
| Starter | 50 | ₹999/month |
| Growth | 200 | ₹2,999/month |
| Scale | 1000 | ₹9,999/month |
| Unlimited | Unlimited | ₹24,999/month |

> Pass-through bureau cost is ₹18–35 per pull depending on provider. Your margin comes from bundling, caching, and the platform value.

---

## 15. RBI Reporting Obligation (Furnishing)

Bureau integration is two-way. As a regulated lender you must also **report back** to the bureau:

| Event | What to Report | When |
|---|---|---|
| Loan disbursed | Loan amount, tenure, type | Within 30 days |
| Instalment paid | Received amount, date | Monthly |
| Instalment missed | Overdue amount | Monthly |
| Loan closed | Closure date, settlement status | Within 30 days |
| Written off | Amount written off | Immediately |

This is a separate integration — a **batch upload** (not real-time API). CRIF and CIBIL both accept monthly batch files in their prescribed format (typically a fixed-width text file or CSV with specific field codes).

Add this to your roadmap as Phase 2 of the Bureau Connect module. Without furnishing, your member agreement with the bureau can be revoked.

---

## 16. Testing Strategy

### Test Cases to Add (reference your existing ML-xxxx scheme)

| TC ID | What to Test |
|---|---|
| ML-1901 | Bureau pull with valid PAN returns parsed summary (sandbox) |
| ML-1902 | Bureau pull without consent throws CONSENT_REQUIRED error |
| ML-1903 | Second pull within 30 days returns cached result (no new API call) |
| ML-1904 | Bureau pull for unknown customer returns no_match status |
| ML-1905 | Raw response is encrypted in storage — not readable as plaintext |
| ML-1906 | Cross-tenant: tenant A cannot view tenant B's bureau reports |
| ML-1907 | Quota exceeded: 51st pull in a 50-pull plan returns QUOTA_EXCEEDED |
| ML-1908 | Bureau module disabled: pull returns MODULE_NOT_ENABLED |
| ML-1909 | Bureau API timeout: loan is not blocked, flagged as pull_failed |
| ML-1910 | AuditLog contains bureau_pull entry with provider, score, reportId |
| ML-1911 | Agent role cannot trigger bureau pull (Admin-only action) |
| ML-1912 | Consent text stored in BureauReport matches the text shown in UI |

---

## 17. Rollout Plan

### Phase 1 — Sandbox (4 weeks)
- [ ] Sign NDA and apply for CRIF High Mark sandbox access
- [ ] Implement `BureauReport` schema and migration
- [ ] Build `CRIFClient` with sandbox credentials
- [ ] Build `BureauSection` component in `LoanForm`
- [ ] Implement consent recording and storage
- [ ] Write test cases ML-1901 to ML-1912
- [ ] Enable for internal QA tenant only

### Phase 2 — Pilot (2 weeks)
- [ ] Enable for 2–3 pilot NBFC tenants in sandbox
- [ ] Collect feedback on report display and risk flag usefulness
- [ ] Tune score label thresholds based on MFI feedback
- [ ] Begin CIBIL onboarding in parallel (4–6 week process)

### Phase 3 — Production (2 weeks)
- [ ] Switch CRIF to production credentials
- [ ] Enable quota management and billing
- [ ] Add bureau history view to customer profile page
- [ ] Train pilot tenant loan officers on interpreting the report

### Phase 4 — Furnishing (separate roadmap)
- [ ] Build monthly batch report generator
- [ ] Implement CRIF data format spec for furnishing
- [ ] Schedule automated monthly upload job

---

*Document version 1.0 — ZoloFund Bureau Connect Add-on*  
*Regulatory reference: RBI Master Direction — Credit Information Companies, 2022*  
*CIC Act: Credit Information Companies (Regulation) Act, 2005*
