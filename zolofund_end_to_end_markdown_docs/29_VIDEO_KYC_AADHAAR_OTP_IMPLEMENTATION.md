# Video KYC / Aadhaar OTP — Complete Implementation

> Two distinct KYC methods selectable per tenant:
>
> **Method A — Aadhaar OTP eKYC** via UIDAI sandbox / production API.
> Customer receives OTP on their Aadhaar-linked mobile. Agent enters it. System gets name,
> DOB, address and photo back from UIDAI. Instant, fully paperless.
>
> **Method B — Video KYC (VCIP)** using agent's phone camera.
> Agent records a short video of the customer holding their Aadhaar card, says the date aloud.
> Video stored securely. Admin reviews and marks verified.
>
> **Current state:** KYC is a file-upload only. `Customer.kycStatus` has values `pending /
> verified / rejected` set manually. `KycDocument` stores only `fileName + filePath`.
> No `kycMethod`, `kycVerifiedAt`, `kycVerifiedById`, or `aadhaarVerified` fields exist.

---

## Architecture decision

Aadhaar OTP eKYC requires a licensed AUA (Authentication User Agency) or KUA (KYC User Agency)
licence from UIDAI. Getting this licence takes 3–6 months and requires RBI/UIDAI approval.

**Practical path for immediate launch:**
Use a licensed intermediary. The best options for India:

| Provider | Product | Integration type | Cost |
|---|---|---|---|
| **Digio** | Aadhaar eKYC + Video KYC | REST API | Per-transaction |
| **IDfy** | Aadhaar OTP + Face match + VCIP | REST API | Per-transaction |
| **Signzy** | Video KYC + Aadhaar OTP | REST API + SDK | Per-transaction |
| **CAMS KRA** | KYC (for SEBI-regulated) | REST API | Subscription |

**Recommendation: Digio** — best documentation, sandbox available without KYC, supports both
Aadhaar OTP and Video KYC under one API key, widely used by MFI/NBFC tech teams.

This implementation uses **Digio**. Swap the `lib/kyc/digio.ts` file to switch providers.

---

## Overview of changes

| Layer | File | Change |
|---|---|---|
| Schema | `prisma/schema.prisma` | Add 8 fields to `Customer`, add `KycSession` model |
| Env | `.env` | Add Digio API credentials |
| Lib | `lib/kyc/digio.ts` | NEW — Digio API client |
| Lib | `lib/kyc/index.ts` | NEW — KYC orchestration layer |
| Action | `customers/actions.ts` | Add `initiateAadhaarOtp`, `verifyAadhaarOtp`, `initiateVideoKyc`, `markVideoKycReviewed` |
| API | `app/api/kyc/aadhaar-otp/route.ts` | NEW — OTP initiate + verify |
| API | `app/api/kyc/video/route.ts` | NEW — Video KYC session + upload |
| API | `app/api/webhooks/kyc/route.ts` | NEW — Digio webhook for async status |
| UI | `customers/[id]/CustomerProfileClient.tsx` | Add KYC verification panel |
| UI | `customers/new/CustomerForm.tsx` | Add KYC method selector |
| Migration | — | `npx prisma migrate dev --name add_kyc_sessions` |

---

## TASK 1 — Environment variables

Add to `.env` and Hostinger panel:

```bash
# Digio API (https://app.digio.in — create account, get sandbox keys first)
DIGIO_CLIENT_ID=your_digio_client_id
DIGIO_CLIENT_SECRET=your_digio_client_secret
DIGIO_BASE_URL=https://ext.digio.in:444   # sandbox; production: https://api.digio.in
DIGIO_WEBHOOK_SECRET=your_digio_webhook_secret

# KYC feature flags
ENABLE_AADHAAR_OTP_KYC=true
ENABLE_VIDEO_KYC=true

# File storage for video KYC recordings (local path or S3 prefix)
KYC_VIDEO_UPLOAD_DIR=public/kyc-videos
```

---

## TASK 2 — Schema changes

**File:** `prisma/schema.prisma`

### 2a — Add fields to `model Customer`

Add after the existing `kycStatus` field:

```prisma
kycStatus         String            @default("pending")
// Values: 'pending' | 'otp_initiated' | 'otp_verified' | 'video_submitted' |
//         'video_under_review' | 'verified' | 'rejected'

// ── ADD THESE FIELDS ──
kycMethod         String?           @map("kyc_method")
// 'manual_upload' | 'aadhaar_otp' | 'video_kyc'

kycVerifiedAt     DateTime?         @map("kyc_verified_at")
kycVerifiedById   String?           @map("kyc_verified_by_id")
kycRejectedReason String?           @map("kyc_rejected_reason") @db.Text

// Aadhaar OTP fields (populated by UIDAI response via Digio)
aadhaarVerified   Boolean           @default(false) @map("aadhaar_verified")
aadhaarName       String?           @map("aadhaar_name")
aadhaarDob        String?           @map("aadhaar_dob")
aadhaarAddress    String?           @map("aadhaar_address") @db.Text
aadhaarPhoto      String?           @map("aadhaar_photo")    // path to stored photo from UIDAI

kycVerifiedBy     User?             @relation("KycVerifier", fields: [kycVerifiedById], references: [id])
kycSessions       KycSession[]
```

Add named relation to `model User`:

```prisma
kycVerifications  Customer[]        @relation("KycVerifier")
```

### 2b — Add `model KycSession`

Add after `model KycDocument`:

```prisma
model KycSession {
  id              String    @id @default(cuid())
  tenantId        String    @map("tenant_id")
  customerId      String    @map("customer_id")
  method          String                         // 'aadhaar_otp' | 'video_kyc'
  status          String    @default("initiated")
  // 'initiated' | 'otp_sent' | 'otp_verified' | 'failed'
  // 'video_uploaded' | 'video_reviewing' | 'video_approved' | 'video_rejected'

  // Digio fields
  digioRequestId  String?   @map("digio_request_id")  // Digio session/request ID
  digioEntityId   String?   @map("digio_entity_id")

  // OTP fields
  otpReference    String?   @map("otp_reference")
  otpExpiresAt    DateTime? @map("otp_expires_at")

  // Video fields
  videoFilePath   String?   @map("video_file_path")
  videoFileName   String?   @map("video_file_name")
  videoUploadedAt DateTime? @map("video_uploaded_at")

  // Review fields
  reviewedById    String?   @map("reviewed_by_id")
  reviewedAt      DateTime? @map("reviewed_at")
  reviewNotes     String?   @map("review_notes") @db.Text

  // Response data (stored as JSON string)
  responseData    String?   @map("response_data") @db.Text

  initiatedById   String?   @map("initiated_by_id")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  customer        Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  initiatedBy     User?     @relation("KycSessionInitiator", fields: [initiatedById], references: [id])
  reviewedBy      User?     @relation("KycSessionReviewer", fields: [reviewedById], references: [id])

  @@index([tenantId, customerId])
  @@index([digioRequestId])
  @@map("kyc_sessions")
}
```

Add to `Tenant` model: `kycSessions KycSession[]`
Add to `User` model:
```prisma
kycSessionsInitiated KycSession[] @relation("KycSessionInitiator")
kycSessionsReviewed  KycSession[] @relation("KycSessionReviewer")
```

### 2c — Run migration

```bash
npx prisma migrate dev --name add_kyc_sessions
npx prisma generate
```

---

## TASK 3 — Create `lib/kyc/digio.ts`

**Create directory:** `lib/kyc/`
**Create file:** `lib/kyc/digio.ts`

```ts
const BASE_URL      = process.env.DIGIO_BASE_URL      || 'https://ext.digio.in:444';
const CLIENT_ID     = process.env.DIGIO_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.DIGIO_CLIENT_SECRET || '';

function authHeader() {
  const token = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' };
}

// ── Aadhaar OTP ──────────────────────────────────────────────────────────────

/**
 * Step 1: Initiate an Aadhaar OTP request for the given masked Aadhaar number.
 * Digio sends OTP to the Aadhaar-linked mobile number.
 */
export async function initiateAadhaarOtp(aadhaarNumber: string, customerName: string): Promise<{
  success: boolean;
  requestId?: string;
  message?: string;
  error?: string;
}> {
  if (!CLIENT_ID) return { success: false, error: 'Digio credentials not configured' };

  try {
    const res = await fetch(`${BASE_URL}/v2/client/kyc/aadhaar/initiate`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({
        aadhaar_number: aadhaarNumber.replace(/\s/g, ''),
        name:           customerName,
        channel:        'otp',
      }),
    });
    const data = await res.json();
    if (data.code === 200 && data.request_id) {
      return { success: true, requestId: data.request_id, message: data.message };
    }
    return { success: false, error: data.message || 'OTP initiation failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Step 2: Verify the OTP entered by the customer/agent.
 * Returns the UIDAI KYC data on success.
 */
export async function verifyAadhaarOtp(requestId: string, otp: string): Promise<{
  success: boolean;
  kycData?: {
    name: string;
    dob: string;
    gender: string;
    address: string;
    photo: string;    // base64 photo from UIDAI
    careOf: string;
  };
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/v2/client/kyc/aadhaar/verify`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ request_id: requestId, otp }),
    });
    const data = await res.json();
    if (data.code === 200 && data.entity) {
      const e = data.entity;
      return {
        success: true,
        kycData: {
          name:    e.name || '',
          dob:     e.dob  || '',
          gender:  e.gender || '',
          address: [e.house, e.street, e.loc, e.dist, e.state, e.pc].filter(Boolean).join(', '),
          photo:   e.photo_link || e.photo || '',
          careOf:  e.care_of || '',
        },
      };
    }
    return { success: false, error: data.message || 'OTP verification failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Video KYC ─────────────────────────────────────────────────────────────────

/**
 * Create a Video KYC session on Digio.
 * Returns a session URL that can be embedded or sent to the agent's device.
 */
export async function createVideoKycSession(params: {
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  referenceId: string;      // your internal customer ID
}): Promise<{
  success: boolean;
  sessionId?: string;
  sessionUrl?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/v2/client/kyc/video/create`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({
        customer_name:  params.customerName,
        customer_email: params.customerEmail || `${params.referenceId}@loantrack.in`,
        customer_phone: params.customerPhone,
        reference_id:   params.referenceId,
        notify:         false,
        expire_in_days: 3,
      }),
    });
    const data = await res.json();
    if (data.code === 200 && data.id) {
      return {
        success:    true,
        sessionId:  data.id,
        sessionUrl: data.signing_url || data.access_token_url,
      };
    }
    return { success: false, error: data.message || 'Video KYC session creation failed' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch the status of a Video KYC session.
 */
export async function getVideoKycStatus(sessionId: string): Promise<{
  status: 'pending' | 'completed' | 'expired' | 'failed';
  videoUrl?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/v2/client/kyc/video/${sessionId}`, {
      headers: authHeader(),
    });
    const data = await res.json();
    return {
      status:   data.status === 'completed' ? 'completed' : data.status || 'pending',
      videoUrl: data.video_url,
    };
  } catch (err: any) {
    return { status: 'failed', error: err.message };
  }
}

// ── Webhook signature verification ───────────────────────────────────────────

import crypto from 'node:crypto';

export function verifyDigioWebhook(payload: string, signature: string): boolean {
  const secret = process.env.DIGIO_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

---

## TASK 4 — Create `lib/kyc/index.ts` (orchestration layer)

```ts
import prisma from '../db';
import { encryptAadharNumber } from '../pii';
import {
  initiateAadhaarOtp,
  verifyAadhaarOtp,
  createVideoKycSession,
  getVideoKycStatus,
} from './digio';

// ── Aadhaar OTP flow ──────────────────────────────────────────────────────────

export async function startAadhaarOtpKyc(
  customerId: string,
  tenantId: string,
  aadhaarNumber: string,
  agentId: string
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
  });
  if (!customer) throw new Error('Customer not found');

  const result = await initiateAadhaarOtp(aadhaarNumber, customer.name);
  if (!result.success) throw new Error(result.error);

  // Store the KYC session
  const session = await prisma.kycSession.create({
    data: {
      tenantId,
      customerId,
      method:       'aadhaar_otp',
      status:       'otp_sent',
      digioRequestId: result.requestId,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      initiatedById: agentId,
    },
  });

  // Update customer KYC status
  await prisma.customer.update({
    where: { id: customerId },
    data: { kycStatus: 'otp_initiated', kycMethod: 'aadhaar_otp' },
  });

  return { sessionId: session.id, requestId: result.requestId };
}

export async function confirmAadhaarOtp(
  sessionId: string,
  tenantId: string,
  otp: string,
  agentId: string
) {
  const session = await prisma.kycSession.findFirst({
    where: { id: sessionId, tenantId, method: 'aadhaar_otp', status: 'otp_sent' },
  });
  if (!session) throw new Error('KYC session not found or already used');
  if (!session.digioRequestId) throw new Error('Invalid session state');

  // Check OTP expiry
  if (session.otpExpiresAt && new Date() > session.otpExpiresAt) {
    throw new Error('OTP has expired. Please initiate a new request.');
  }

  const result = await verifyAadhaarOtp(session.digioRequestId, otp);
  if (!result.success) {
    await prisma.kycSession.update({
      where: { id: sessionId },
      data:  { status: 'failed' },
    });
    throw new Error(result.error || 'OTP verification failed');
  }

  const kycData = result.kycData!;

  // Save photo to disk if returned as base64
  let photoPath: string | null = null;
  if (kycData.photo && kycData.photo.startsWith('data:')) {
    const base64Data = kycData.photo.split(',')[1];
    const fs = await import('fs/promises');
    const path = await import('path');
    const dir  = path.join(process.cwd(), 'public', 'kyc-photos');
    await fs.mkdir(dir, { recursive: true });
    const fileName = `${session.customerId}-aadhaar-photo.jpg`;
    await fs.writeFile(path.join(dir, fileName), Buffer.from(base64Data, 'base64'));
    photoPath = `/kyc-photos/${fileName}`;
  }

  await prisma.$transaction(async (tx) => {
    // Update customer with verified UIDAI data
    await tx.customer.update({
      where: { id: session.customerId },
      data: {
        kycStatus:       'verified',
        kycMethod:       'aadhaar_otp',
        kycVerifiedAt:   new Date(),
        kycVerifiedById: agentId,
        aadhaarVerified: true,
        aadhaarName:     kycData.name,
        aadhaarDob:      kycData.dob,
        aadhaarAddress:  kycData.address,
        ...(photoPath ? { aadhaarPhoto: photoPath } : {}),
        // Update name/address if customer consents
        name:            kycData.name || undefined,
      },
    });

    // Mark session as verified
    await tx.kycSession.update({
      where: { id: sessionId },
      data: {
        status:       'otp_verified',
        responseData: JSON.stringify(kycData),
        reviewedAt:   new Date(),
        reviewedById: agentId,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        tenantId,
        userId:     agentId,
        action:     'kyc_verified',
        entityType: 'customer',
        entityId:   session.customerId,
        newValue:   JSON.stringify({ method: 'aadhaar_otp', aadhaarName: kycData.name }),
      },
    });
  });

  return { verified: true, aadhaarName: kycData.name };
}

// ── Video KYC flow ────────────────────────────────────────────────────────────

export async function startVideoKyc(
  customerId: string,
  tenantId: string,
  agentId: string
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
  });
  if (!customer) throw new Error('Customer not found');

  const result = await createVideoKycSession({
    customerName:  customer.name,
    customerPhone: customer.phone,
    referenceId:   customer.customerCode,
  });

  if (!result.success) throw new Error(result.error);

  const session = await prisma.kycSession.create({
    data: {
      tenantId,
      customerId,
      method:        'video_kyc',
      status:        'initiated',
      digioRequestId: result.sessionId,
      initiatedById: agentId,
    },
  });

  await prisma.customer.update({
    where: { id: customerId },
    data: { kycStatus: 'video_submitted', kycMethod: 'video_kyc' },
  });

  return {
    sessionId:  session.id,
    sessionUrl: result.sessionUrl,
  };
}

export async function reviewVideoKyc(
  sessionId: string,
  tenantId: string,
  adminId: string,
  decision: 'approved' | 'rejected',
  notes: string = ''
) {
  const session = await prisma.kycSession.findFirst({
    where: { id: sessionId, tenantId, method: 'video_kyc' },
  });
  if (!session) throw new Error('Session not found');

  const newKycStatus = decision === 'approved' ? 'verified' : 'rejected';

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: session.customerId },
      data: {
        kycStatus:       newKycStatus,
        kycVerifiedAt:   decision === 'approved' ? new Date() : null,
        kycVerifiedById: decision === 'approved' ? adminId : null,
        kycRejectedReason: decision === 'rejected' ? notes : null,
      },
    });

    await tx.kycSession.update({
      where: { id: sessionId },
      data: {
        status:      decision === 'approved' ? 'video_approved' : 'video_rejected',
        reviewedById: adminId,
        reviewedAt:   new Date(),
        reviewNotes:  notes,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId:     adminId,
        action:     `kyc_${decision}`,
        entityType: 'customer',
        entityId:   session.customerId,
        newValue:   JSON.stringify({ method: 'video_kyc', decision, notes }),
      },
    });
  });
}
```

---

## TASK 5 — Create KYC API routes

### 5a — `app/api/kyc/aadhaar-otp/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/apiAuth';
import { startAadhaarOtpKyc, confirmAadhaarOtp } from '@/lib/kyc/index';
import { corsHeaders, handleOptions } from '@/lib/cors';

export function OPTIONS() { return handleOptions(); }

// POST /api/kyc/aadhaar-otp — initiate OTP
export async function POST(req: NextRequest) {
  const ctx = await requireApiContext(req);
  if (!ctx.success) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await req.json();
  const { customerId, aadhaarNumber, action, sessionId, otp } = body;

  try {
    if (action === 'initiate') {
      if (!customerId || !aadhaarNumber) {
        return NextResponse.json({ error: 'customerId and aadhaarNumber required' }, { status: 400 });
      }
      const result = await startAadhaarOtpKyc(customerId, ctx.tenantId, aadhaarNumber, ctx.userId);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'verify') {
      if (!sessionId || !otp) {
        return NextResponse.json({ error: 'sessionId and otp required' }, { status: 400 });
      }
      const result = await confirmAadhaarOtp(sessionId, ctx.tenantId, otp, ctx.userId);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ error: 'Invalid action. Use initiate or verify.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
```

### 5b — `app/api/kyc/video/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/apiAuth';
import { startVideoKyc, reviewVideoKyc } from '@/lib/kyc/index';
import { handleOptions } from '@/lib/cors';

export function OPTIONS() { return handleOptions(); }

// POST /api/kyc/video — start session or review
export async function POST(req: NextRequest) {
  const ctx = await requireApiContext(req);
  if (!ctx.success) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await req.json();
  const { action, customerId, sessionId, decision, notes } = body;

  try {
    if (action === 'start') {
      if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });
      const result = await startVideoKyc(customerId, ctx.tenantId, ctx.userId);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'review') {
      // Admin only
      if (ctx.role === 'agent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (!sessionId || !decision) return NextResponse.json({ error: 'sessionId and decision required' }, { status: 400 });
      await reviewVideoKyc(sessionId, ctx.tenantId, ctx.userId, decision, notes);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
```

### 5c — `app/api/webhooks/kyc/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyDigioWebhook } from '@/lib/kyc/digio';

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get('x-digio-signature') || '';

  if (!verifyDigioWebhook(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);
  const { event: eventType, entity } = event;

  // Handle video KYC completion from Digio callback
  if (eventType === 'kyc.completed' && entity?.id) {
    const session = await prisma.kycSession.findFirst({
      where: { digioRequestId: entity.id, method: 'video_kyc' },
    });
    if (session) {
      await prisma.kycSession.update({
        where: { id: session.id },
        data: {
          status:      'video_reviewing',
          responseData: JSON.stringify(entity),
        },
      });
      await prisma.customer.update({
        where: { id: session.customerId },
        data:  { kycStatus: 'video_under_review' },
      });
    }
  }

  return NextResponse.json({ received: true });
}
```

---

## TASK 6 — Update `CustomerProfileClient.tsx`

### 6a — Add KYC verification panel to the KYC tab

Add this section inside the KYC tab (`activeTab === 'kyc'`), before the existing document list:

```tsx
{/* KYC Verification Panel */}
<div className="card" style={{ marginBottom: '16px' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
    <div>
      <div style={{ fontWeight: 600 }}>Identity Verification</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Method: {customer.kycMethod?.replace('_', ' ') || 'Not started'}
      </div>
    </div>
    <span className={`badge ${customer.kycStatus === 'verified' ? 'badge-active' : customer.kycStatus === 'rejected' ? 'badge-overdue' : 'badge-pending'}`}>
      {customer.kycStatus.replace('_', ' ').toUpperCase()}
    </span>
  </div>

  {/* Aadhaar OTP flow */}
  {customer.kycStatus === 'pending' && userRole === 'agent' && (
    <AadhaarOtpPanel customerId={customer.id} customerName={customer.name} />
  )}

  {/* Aadhaar verified data */}
  {customer.aadhaarVerified && (
    <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', padding: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      {customer.aadhaarPhoto && (
        <img src={customer.aadhaarPhoto} alt="Aadhaar photo" style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover' }} />
      )}
      <div>
        <div style={{ fontWeight: 700, color: 'var(--success)' }}>✓ Aadhaar eKYC Verified</div>
        <div style={{ fontSize: '12px', marginTop: '4px' }}>Name: {customer.aadhaarName}</div>
        <div style={{ fontSize: '12px' }}>DOB: {customer.aadhaarDob}</div>
        <div style={{ fontSize: '12px' }}>Address: {customer.aadhaarAddress}</div>
      </div>
    </div>
  )}

  {/* Video KYC — admin review panel */}
  {(customer.kycStatus === 'video_under_review' || customer.kycStatus === 'video_submitted') && userRole === 'admin' && (
    <VideoKycReviewPanel customerId={customer.id} kycSessions={customer.kycSessions || []} />
  )}
</div>
```

### 6b — Create `AadhaarOtpPanel` sub-component (in same file or separate)

```tsx
function AadhaarOtpPanel({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [step, setStep]       = useState<'idle' | 'otp_sent' | 'verified' | 'error'>('idle');
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp]         = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleInitiate = async () => {
    const clean = aadhaar.replace(/\s/g, '');
    if (clean.length !== 12) { setError('Enter a valid 12-digit Aadhaar number'); return; }
    setLoading(true); setError('');
    const res  = await fetch('/api/kyc/aadhaar-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'initiate', customerId, aadhaarNumber: clean }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) { setSessionId(data.data.sessionId); setStep('otp_sent'); }
    else setError(data.error || 'Failed to send OTP');
  };

  const handleVerify = async () => {
    if (otp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setLoading(true); setError('');
    const res  = await fetch('/api/kyc/aadhaar-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'verify', sessionId, otp }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) { setStep('verified'); window.location.reload(); }
    else setError(data.error || 'OTP verification failed');
  };

  if (step === 'idle') return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <input
        className="form-control"
        style={{ flex: 1, minWidth: '180px' }}
        placeholder="Aadhaar number (12 digits)"
        value={aadhaar}
        maxLength={14}
        onChange={e => setAadhaar(e.target.value.replace(/[^\d\s]/g, ''))}
      />
      <button className="btn btn-primary btn-sm" onClick={handleInitiate} disabled={loading}>
        {loading ? 'Sending...' : 'Send OTP'}
      </button>
      <button
        className="btn btn-secondary btn-sm"
        onClick={async () => {
          setLoading(true);
          const res  = await fetch('/api/kyc/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action: 'start', customerId }),
          });
          const data = await res.json();
          setLoading(false);
          if (data.success && data.data.sessionUrl) {
            window.open(data.data.sessionUrl, '_blank');
            window.location.reload();
          }
        }}
        disabled={loading}
      >
        {loading ? '...' : 'Start Video KYC'}
      </button>
      {error && <div style={{ color: 'var(--danger)', fontSize: '12px', width: '100%' }}>{error}</div>}
    </div>
  );

  if (step === 'otp_sent') return (
    <div>
      <div style={{ fontSize: '13px', color: 'var(--success)', marginBottom: '10px' }}>
        ✓ OTP sent to the Aadhaar-linked mobile number
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          className="form-control"
          style={{ flex: 1, maxWidth: '160px' }}
          placeholder="6-digit OTP"
          value={otp}
          maxLength={6}
          onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
        />
        <button className="btn btn-primary btn-sm" onClick={handleVerify} disabled={loading}>
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setStep('idle'); setOtp(''); }}>
          Resend
        </button>
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '6px' }}>{error}</div>}
    </div>
  );

  return null;
}
```

### 6c — Create `VideoKycReviewPanel` sub-component

```tsx
function VideoKycReviewPanel({ customerId, kycSessions }: { customerId: string; kycSessions: any[] }) {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes]     = useState('');
  const session = kycSessions.find((s: any) => s.method === 'video_kyc' && ['video_reviewing', 'initiated'].includes(s.status));

  if (!session) return null;

  const handleReview = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !notes.trim()) { alert('Please add rejection notes'); return; }
    setLoading(true);
    await fetch('/api/kyc/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'review', sessionId: session.id, decision, notes }),
    });
    setLoading(false);
    window.location.reload();
  };

  return (
    <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-sm)', padding: '14px', marginTop: '12px' }}>
      <div style={{ fontWeight: 600, marginBottom: '8px' }}>Video KYC — Pending Review</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Session submitted. Review the video recording and approve or reject.
      </div>
      {session.digioRequestId && (
        <a
          href={`https://app.digio.in/#/session/${session.digioRequestId}`}
          target="_blank" rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: '12px' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>videocam</span>
          View Video Recording
        </a>
      )}
      <div className="form-group">
        <label className="form-label" style={{ fontSize: '12px' }}>Review Notes</label>
        <input className="form-control" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes (required for rejection)" />
      </div>
      <div className="form-actions">
        <button className="btn btn-danger btn-sm" onClick={() => handleReview('rejected')} disabled={loading}>Reject</button>
        <button className="btn btn-primary btn-sm" onClick={() => handleReview('approved')} disabled={loading}>
          {loading ? 'Saving...' : 'Approve KYC'}
        </button>
      </div>
    </div>
  );
}
```

---

## TASK 7 — Update `CustomerProfileClient.tsx` data fetch

**File:** `app/(dashboard)/customers/[id]/page.tsx`

Add `kycSessions` to the customer include:

```ts
const customer = await prisma.customer.findFirst({
  where: { id: params.id, tenantId },      // or customerCode lookup
  include: {
    route:          { select: { name: true } },
    agent:          { select: { name: true } },
    loans:          { ... },
    kycDocuments:   true,
    securityCheques:true,
    guarantors:     true,
    kycSessions: {                           // ← ADD THIS
      orderBy: { createdAt: 'desc' },
      take: 5,
    },
  },
});
```

Pass `kycSessions={customer.kycSessions}` to `<CustomerProfileClient>` and add it to the props interface.

---

## TASK 8 — Settings: enable/disable KYC methods per tenant

**File:** `app/(dashboard)/settings/SettingsClient.tsx`

In the System settings section, add a KYC configuration panel:

```tsx
{/* KYC Settings */}
<div className="form-group">
  <label className="form-label">KYC Method</label>
  <select name="kyc_method" className="form-control" defaultValue={settings.kycMethod || 'manual_upload'}>
    <option value="manual_upload">Manual Document Upload</option>
    <option value="aadhaar_otp">Aadhaar OTP eKYC (Digio)</option>
    <option value="video_kyc">Video KYC (VCIP)</option>
    <option value="both">Both Aadhaar OTP + Video KYC</option>
  </select>
  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
    Requires DIGIO_CLIENT_ID and DIGIO_CLIENT_SECRET to be configured.
  </div>
</div>
```

Add `kyc_method` to `saveSystemSettings` in `settings/actions.ts`.

---

## TASK 9 — Admin KYC review list page

**Create:** `app/(dashboard)/kyc-review/page.tsx`

Shows all customers with `kycStatus = 'video_under_review'` for admin to action:

```ts
export default async function KycReviewPage() {
  const session  = await auth();
  const role     = (session?.user as any)?.role;
  if (role === 'agent') redirect('/collection');

  const tenantId = await getDefaultTenantId();
  const appType  = await getUserAppType();

  const pending = await prisma.customer.findMany({
    where: { tenantId, appType, kycStatus: { in: ['video_under_review', 'video_submitted'] } },
    include: {
      kycSessions: { where: { method: 'video_kyc' }, orderBy: { createdAt: 'desc' }, take: 1 },
      route: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">KYC Review Queue</h1>
        <span className="badge badge-warning">{pending.length} pending</span>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Customer</th><th>Code</th><th>Route</th><th>Submitted</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {pending.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td><code>{c.customerCode}</code></td>
                <td>{c.route?.name || '-'}</td>
                <td>{c.kycSessions[0] ? new Date(c.kycSessions[0].createdAt).toLocaleDateString('en-IN') : '-'}</td>
                <td><span className="badge badge-pending">{c.kycStatus.replace('_', ' ')}</span></td>
                <td>
                  <a href={`/customers/${c.customerCode}`} className="btn btn-ghost btn-sm">
                    Review
                  </a>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No pending reviews</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Add to sidebar for `admin` and `superadmin` roles with a notification badge count.

---

## TASK 10 — i18n additions

**File:** `i18n/en.ts` — add inside `customerProfile` section:

```ts
kycVerification:        'Identity Verification',
sendOtp:                'Send OTP',
verifyOtp:              'Verify OTP',
startVideoKyc:          'Start Video KYC',
aadhaarOtpSent:         'OTP sent to Aadhaar-linked mobile',
aadhaarVerified:        'Aadhaar eKYC Verified',
videoKycPending:        'Video KYC Pending Review',
viewRecording:          'View Video Recording',
approveKyc:             'Approve KYC',
rejectKyc:              'Reject',
kycReviewNotes:         'Review Notes',
```

Add equivalent translations to `i18n/ta.ts` and `i18n/hi.ts`.

---

## Production checklist

```bash
# 1. Apply schema migration
npx prisma migrate dev --name add_kyc_sessions
npx prisma generate

# 2. Set Digio credentials in .env
DIGIO_CLIENT_ID=...
DIGIO_CLIENT_SECRET=...
DIGIO_WEBHOOK_SECRET=...

# 3. Test in Digio sandbox first (https://app.digio.in)
# Sandbox Aadhaar: 999999990019 (test number)
# Test OTP always: 123456

# 4. Register webhook in Digio dashboard
# URL: https://yourdomain.com/api/webhooks/kyc

# 5. Build check
npm run build
```
