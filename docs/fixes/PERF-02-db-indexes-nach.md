# PERF-02 — Add DB Indexes on NACH + Collection Tables

**Priority:** 🟠 HIGH  
**Category:** Performance — Query speed  
**Effort:** 15 min (schema change + migrate)

---

## Problem

The new NACH tables (`NachMandate`, `NachPresentation`) and the existing `CollectionEntry` table are missing indexes on columns used in frequent `WHERE` and `JOIN` clauses:

| Table | Column | Used In |
|---|---|---|
| `nach_mandates` | `razorpay_order_id` | Webhook lookup: `findFirst({ where: { razorpayOrderId } })` |
| `nach_presentations` | `razorpay_payment_id` | Webhook lookup: `findFirst({ where: { razorpayPaymentId } })` |
| `collection_entries` | `idempotency_key` | Dedup check on every collection submit |
| `nach_presentations` | `status` | Cron query: `status: { in: ['pending','submitted','success'] }` |
| `nach_mandates` | `loan_id` | `findUnique` already uses `@unique` — OK |

Without indexes, each webhook event does a full table scan of potentially millions of rows.

---

## File to Modify

`prisma/schema.prisma`

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Open `prisma/schema.prisma`

Find the `NachMandate` model. It currently has:
```prisma
model NachMandate {
  ...
  razorpayOrderId    String?  @map("razorpay_order_id")
  razorpayTokenId    String?  @map("razorpay_token_id")
  razorpayCustomerId String?  @map("razorpay_customer_id")
  razorpayPaymentId  String?  @map("razorpay_payment_id")
  ...
}
```

Add `@@index` directives to the **bottom** of the `NachMandate` model (before the closing `}`):

```prisma
  @@index([razorpayOrderId])
  @@index([status])
```

### Step 2 — Find `NachPresentation` model. Add:

```prisma
  @@index([razorpayPaymentId])
  @@index([razorpayOrderId])
  @@index([status])
  @@index([mandateId, status])
  @@index([instalmentId])
```

### Step 3 — Find `CollectionEntry` model. Check if `idempotencyKey` already has an index.

If `idempotencyKey` is marked `@unique` → it already has an index; skip.  
If it only has `@@unique([tenantId, idempotencyKey])` → that covers the compound uniqueness but may not be used for single-column lookups. Add:

```prisma
  @@index([idempotencyKey])
```

### Step 4 — Apply migration

```
npx prisma db push
```

Or for production (creates a named migration file):
```
npx prisma migrate dev --name add_nach_indexes
```

Then commit the migration files:
```
git add prisma/migrations/ prisma/schema.prisma
git commit -m "perf: add indexes on nach_mandates, nach_presentations, collection_entries"
```

### Step 5 — Verify indexes in MySQL

```sql
SHOW INDEX FROM nach_mandates;
SHOW INDEX FROM nach_presentations;
SHOW INDEX FROM collection_entries;
```

---

## Verification

- `SHOW INDEX FROM nach_mandates` includes `razorpay_order_id`
- `SHOW INDEX FROM nach_presentations` includes `razorpay_payment_id`
- `npx tsc --noEmit` → 0 errors
- `npx prisma validate` → schema valid
