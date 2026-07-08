# Step 1 — Database Migrations and Chit Schema Upgrade

## Goal

Make the chit-fund database production-ready and deployable.

Current issue found in the app:

- `prisma/migrations` only contains `migration_lock.toml`.
- A fresh production deployment using `prisma migrate deploy` will not create the tables.
- Existing chit models are too basic for real chit-fund operations.

This step creates proper Prisma migrations and adds required tables/fields for compliance, auction, receipts, surety, and reporting.

## Current files to update

```txt
prisma/schema.prisma
prisma/migrations/
package.json
```

## Existing chit models

Current models:

```txt
ChitGroup
ChitMember
ChitAuction
ChitSubscription
```

These should remain, but must be extended. Do not delete existing data fields.

## New models to add

Add these models to `prisma/schema.prisma`.

### 1. ChitDocument

Purpose: Store references to uploaded agreements, registration documents, KYC files, surety documents, minutes, notices, and receipts.

```prisma
model ChitDocument {
  id             String   @id @default(cuid())
  tenantId       String   @map("tenant_id")
  branchId       String?  @map("branch_id")
  appType        String   @default("chitfunds") @map("app_type")

  entityType     String   @map("entity_type") // group, member, auction, payout, receipt, security
  entityId       String   @map("entity_id")
  documentType   String   @map("document_type") // agreement, kyc, nominee, registration, minutes, surety, receipt
  fileName       String   @map("file_name")
  fileUrl        String   @map("file_url") @db.Text
  mimeType       String?  @map("mime_type")
  sizeBytes      Int?     @map("size_bytes")
  status         String   @default("active")

  uploadedById   String?  @map("uploaded_by_id")
  uploadedAt     DateTime @default(now()) @map("uploaded_at")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@index([tenantId, appType, entityType, entityId])
  @@index([branchId])
  @@map("chit_documents")
}
```

### 2. ChitBid

Purpose: Store all auction bids, not just final winner.

```prisma
model ChitBid {
  id              String   @id @default(cuid())
  tenantId        String   @map("tenant_id")
  branchId        String?  @map("branch_id")
  auctionId       String   @map("auction_id")
  chitGroupId     String   @map("chit_group_id")
  memberId        String   @map("member_id")

  bidAmount       Decimal  @map("bid_amount") @db.Decimal(14, 2) // prize amount accepted by bidder
  bidDiscount     Decimal  @map("bid_discount") @db.Decimal(14, 2)
  bidTime         DateTime @default(now()) @map("bid_time")
  status          String   @default("valid") // valid, withdrawn, rejected, winning
  remarks         String?  @db.Text
  createdById     String?  @map("created_by_id")
  createdAt       DateTime @default(now()) @map("created_at")

  auction         ChitAuction @relation(fields: [auctionId], references: [id], onDelete: Cascade)
  member          ChitMember  @relation(fields: [memberId], references: [id])

  @@index([tenantId, branchId, chitGroupId])
  @@index([auctionId, status])
  @@map("chit_bids")
}
```

### 3. ChitAuctionAttendance

Purpose: Track which subscribers attended the auction.

```prisma
model ChitAuctionAttendance {
  id           String   @id @default(cuid())
  tenantId     String   @map("tenant_id")
  branchId     String?  @map("branch_id")
  auctionId    String   @map("auction_id")
  memberId     String   @map("member_id")
  status       String   @default("present") // present, absent, proxy
  proxyName    String?  @map("proxy_name")
  remarks      String?  @db.Text
  markedById   String?  @map("marked_by_id")
  markedAt     DateTime @default(now()) @map("marked_at")

  auction      ChitAuction @relation(fields: [auctionId], references: [id], onDelete: Cascade)
  member       ChitMember  @relation(fields: [memberId], references: [id])

  @@unique([auctionId, memberId])
  @@index([tenantId, branchId])
  @@map("chit_auction_attendance")
}
```

### 4. ChitReceipt

Purpose: Create immutable receipt records for collections, reversals, and payouts.

```prisma
model ChitReceipt {
  id              String   @id @default(cuid())
  tenantId        String   @map("tenant_id")
  branchId        String?  @map("branch_id")
  appType         String   @default("chitfunds") @map("app_type")

  receiptNo       String   @map("receipt_no")
  receiptType     String   @map("receipt_type") // collection, penalty, payout, reversal
  entityType      String   @map("entity_type") // subscription, auction, payout
  entityId        String   @map("entity_id")

  amount          Decimal  @db.Decimal(14, 2)
  paymentMode     String   @default("cash") @map("payment_mode")
  referenceNo     String?  @map("reference_no")
  notes           String?  @db.Text
  status          String   @default("active") // active, reversed, cancelled

  issuedById      String?  @map("issued_by_id")
  issuedAt        DateTime @default(now()) @map("issued_at")
  reversedById    String?  @map("reversed_by_id")
  reversedAt      DateTime? @map("reversed_at")
  reversalReason  String?  @map("reversal_reason") @db.Text

  @@unique([tenantId, receiptNo])
  @@index([tenantId, branchId, receiptType])
  @@index([entityType, entityId])
  @@map("chit_receipts")
}
```

### 5. ChitSecurity

Purpose: Track surety/security before prize payout.

```prisma
model ChitSecurity {
  id               String   @id @default(cuid())
  tenantId         String   @map("tenant_id")
  branchId         String?  @map("branch_id")
  chitGroupId      String   @map("chit_group_id")
  auctionId        String   @map("auction_id")
  winnerMemberId   String   @map("winner_member_id")

  securityType     String   @map("security_type") // guarantor, property, gold, fd, salary, cheque, other
  securityValue    Decimal? @map("security_value") @db.Decimal(14, 2)
  guarantorName    String?  @map("guarantor_name")
  guarantorPhone   String?  @map("guarantor_phone")
  details          String?  @db.Text

  status           String   @default("pending") // pending, submitted, verified, approved, rejected
  submittedAt      DateTime? @map("submitted_at")
  verifiedById     String?  @map("verified_by_id")
  verifiedAt       DateTime? @map("verified_at")
  approvedById     String?  @map("approved_by_id")
  approvedAt       DateTime? @map("approved_at")
  rejectionReason  String?  @map("rejection_reason") @db.Text

  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@index([tenantId, branchId, chitGroupId])
  @@index([auctionId, status])
  @@map("chit_securities")
}
```

### 6. ChitPenalty

Purpose: Track penalties separately instead of mixing them with subscription due amount.

```prisma
model ChitPenalty {
  id              String   @id @default(cuid())
  tenantId        String   @map("tenant_id")
  branchId        String?  @map("branch_id")
  subscriptionId  String   @map("subscription_id")
  memberId        String   @map("member_id")

  penaltyType     String   @default("late_fee") @map("penalty_type")
  amount          Decimal  @db.Decimal(14, 2)
  paidAmount      Decimal  @default(0.00) @map("paid_amount") @db.Decimal(14, 2)
  status          String   @default("due") // due, partial, paid, waived
  reason          String?  @db.Text
  waivedById      String?  @map("waived_by_id")
  waivedAt        DateTime? @map("waived_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@index([tenantId, branchId, memberId])
  @@index([subscriptionId])
  @@map("chit_penalties")
}
```

## Existing models to extend

### ChitGroup additions

Add these fields to `ChitGroup`:

```prisma
registrationNo          String?   @map("registration_no")
registrationDate        DateTime? @map("registration_date") @db.Date
registrarOffice         String?   @map("registrar_office")
bylawNo                 String?   @map("bylaw_no")
commencementCertificate String?   @map("commencement_certificate")
approvedBankName        String?   @map("approved_bank_name")
approvedBankAccountNo   String?   @map("approved_bank_account_no")
foremanName             String?   @map("foreman_name")
foremanCommissionCapPct Decimal?  @map("foreman_commission_cap_pct") @db.Decimal(5, 2)
maxDiscountPct          Decimal?  @map("max_discount_pct") @db.Decimal(5, 2)
auctionFrequency        String    @default("monthly") @map("auction_frequency")
auctionMode             String    @default("offline") @map("auction_mode") // offline, online, hybrid
auctionDay              Int?      @map("auction_day")
complianceStatus        String    @default("draft") @map("compliance_status") // draft, registered, active, suspended, closed
remarks                 String?   @db.Text
```

### ChitMember additions

Add these fields:

```prisma
ticketNo          String?   @map("ticket_no")
fractionNo        String?   @map("fraction_no")
subscriberStatus  String    @default("active") @map("subscriber_status") // active, defaulted, substituted, removed, closed
agreementStatus   String    @default("pending") @map("agreement_status") // pending, signed, verified, rejected
agreementSignedAt DateTime? @map("agreement_signed_at")
nomineeName       String?   @map("nominee_name")
nomineeRelation   String?   @map("nominee_relation")
nomineePhone      String?   @map("nominee_phone")
introducedBy      String?   @map("introduced_by")
```

Add unique ticket index:

```prisma
@@unique([chitGroupId, ticketNo])
```

### ChitAuction additions

Add these fields:

```prisma
scheduledAt       DateTime? @map("scheduled_at")
startedAt         DateTime? @map("started_at")
completedAt       DateTime? @map("completed_at")
noticeStatus      String    @default("pending") @map("notice_status") // pending, sent, acknowledged
minutesText       String?   @map("minutes_text") @db.Text
confirmedById     String?   @map("confirmed_by_id")
confirmedAt       DateTime? @map("confirmed_at")
payoutStatus      String    @default("not_ready") @map("payout_status") // not_ready, security_pending, ready, paid
```

Add relations if needed:

```prisma
bids        ChitBid[]
attendance  ChitAuctionAttendance[]
```

### ChitSubscription additions

Add these fields:

```prisma
baseDueAmount     Decimal? @map("base_due_amount") @db.Decimal(14, 2)
dividendAmount    Decimal  @default(0.00) @map("dividend_amount") @db.Decimal(14, 2)
penaltyAmount     Decimal  @default(0.00) @map("penalty_amount") @db.Decimal(14, 2)
collectorId       String?  @map("collector_id")
paymentMode       String?  @map("payment_mode")
lastReceiptNo     String?  @map("last_receipt_no")
lastPaymentRefNo  String?  @map("last_payment_ref_no")
notes             String?  @db.Text
```

## Migration creation process

Because the repo currently has no real migration folders, create a baseline carefully.

### For development database

```bash
npm run db:validate
npx prisma migrate dev --name chitfund_production_schema
npm run db:generate
```

### For production/staging with existing DB

If production already has tables created through `db push`, do not blindly run a destructive migration. Use Prisma baseline approach:

```bash
mkdir -p prisma/migrations/00000000000000_baseline
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/00000000000000_baseline/migration.sql

npx prisma migrate resolve --applied 00000000000000_baseline
```

Then create the incremental migration:

```bash
npx prisma migrate dev --name chitfund_production_schema
```

## Backfill script

Create:

```txt
scripts/backfill-chit-schema.ts
```

Backfill logic:

1. Set `baseDueAmount = dueAmount` where null.
2. Set `complianceStatus = active` for existing active groups only if required compliance fields are intentionally optional during migration.
3. Set `ticketNo = memberNumber` as string for existing members where missing.
4. Set `agreementStatus = pending` for existing members.
5. Set `payoutStatus = paid` for completed auctions with existing `winnerMemberId` and account entry payout.
6. Set `payoutStatus = security_pending` for completed auctions without payout.

Example skeleton:

```ts
import prisma from '@/lib/db';

async function main() {
  await prisma.chitSubscription.updateMany({
    where: { baseDueAmount: null },
    data: {}, // Prisma cannot copy column directly; use raw SQL below
  });

  await prisma.$executeRawUnsafe(`
    UPDATE chit_subscriptions
    SET base_due_amount = due_amount
    WHERE base_due_amount IS NULL
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE chit_members
    SET ticket_no = CAST(member_number AS CHAR)
    WHERE ticket_no IS NULL
  `);
}

main().finally(() => prisma.$disconnect());
```

## Acceptance criteria

- `npm run db:validate` passes.
- `npm run db:generate` passes.
- `npm run db:deploy` works on a fresh database.
- Existing chit groups still load in web UI.
- Existing mobile chit APIs still return data.
- No existing chit data is deleted.
- Chit tables now support compliance, bid history, attendance, receipts, security, and penalties.

## Implementation prompt for coding agent

```txt
Implement Step 1 for the LoanTrack chit-fund module.

Update prisma/schema.prisma by extending the existing ChitGroup, ChitMember, ChitAuction, and ChitSubscription models and adding ChitDocument, ChitBid, ChitAuctionAttendance, ChitReceipt, ChitSecurity, and ChitPenalty models as described in 01_DATABASE_MIGRATIONS_AND_SCHEMA.md.

Create safe Prisma migrations. Preserve existing data. Do not remove any existing fields. Add indexes and unique constraints carefully. Add a backfill script under scripts/backfill-chit-schema.ts. Update package.json with a script named backfill:chits if needed.

Run prisma validate and generate. Ensure a fresh database can be created using prisma migrate deploy. Return a summary of changed files and any manual production baseline steps required.
```
