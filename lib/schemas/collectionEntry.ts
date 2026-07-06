import { z } from 'zod';

/**
 * Shared body schema for collection submissions (web `/api/collection` POST
 * and mobile `/api/v1/collection/entry` POST).
 *
 * `.passthrough()` keeps unvalidated extra keys (GPS lat/lng/accuracy etc.)
 * so `normalizeGpsBody()` can read them from the parsed object; GPS fields
 * that are present are still range-checked below.
 */
export const CollectionEntrySchema = z
  .object({
    instalmentId: z.string().min(1, 'instalmentId required'),
    receivedAmount: z
      .number({ error: 'receivedAmount must be a number' })
      .positive('receivedAmount must be > 0')
      .max(10_000_000, 'receivedAmount exceeds limit'),
    paymentMode: z.string().min(1).max(40).default('cash'),
    remarks: z.string().max(500).nullable().optional(),
    collectionDate: z.string().nullable().optional(),
    idempotencyKey: z.string().max(128).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    gpsAccuracy: z.number().nonnegative().nullable().optional(),
  })
  .passthrough();

export type CollectionEntryInput = z.infer<typeof CollectionEntrySchema>;

/**
 * Body schema for loan-level collection (`/api/v1/collection/collect` POST).
 * One payment spread across the loan's open instalments today-first
 * (today's due → overdue oldest-first → future).
 */
export const CollectLoanSchema = z
  .object({
    loanId: z.string().min(1, 'loanId required'),
    amount: z
      .number({ error: 'amount must be a number' })
      .positive('amount must be > 0')
      .max(10_000_000, 'amount exceeds limit'),
    paymentMode: z.string().min(1).max(40).default('cash'),
    remarks: z.string().max(500).nullable().optional(),
    collectionDate: z.string().nullable().optional(),
    idempotencyKey: z.string().max(128).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    gpsAccuracy: z.number().nonnegative().nullable().optional(),
  })
  .passthrough();

export type CollectLoanInput = z.infer<typeof CollectLoanSchema>;
