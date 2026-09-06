/**
 * Secured-lending collateral validation (property mortgage + product finance).
 *
 * `property` and `productfinance` reuse the loan lifecycle and only add a
 * collateral model (§16 "Adding a module"), so the register is the ONLY record
 * of what actually backs the advance. These routes previously wrote every field
 * through raw, which let a mortgage register claim a property supports more
 * than it does, and let the item register disagree with the ledger about the
 * same advance.
 *
 * Pure and dependency-free (no prisma, no next) so it is unit-testable and can
 * run before the origination transaction — a refusal must never leave a partial
 * write (X-6).
 */
import { HttpError } from '@/lib/httpError';

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

function reject(message: string): never {
  throw new HttpError(400, message);
}

/** Round money to 2dp the way the rest of the ledger does (MONEY-9). */
const money = (n: number) => Math.round(n * 100) / 100;

export type PropertyCollateralInput = Record<string, unknown>;

/**
 * Validate a mortgage register entry and DERIVE the figures that must never be
 * taken from the request.
 *
 * @param principal the loan principal being advanced against this property.
 */
export function normalisePropertyCollateral(
  input: PropertyCollateralInput,
  opts: { principal: number; now?: Date },
): Record<string, unknown> {
  const now = opts.now ?? new Date();

  const extentValue = num(input.extentValue);
  const marketValue = num(input.marketValue);
  const ltv = num(input.eligibleLtvPercent);

  // PPF-026 — a negative extent or valuation is not a measurement.
  if (extentValue != null && extentValue < 0) reject('extentValue cannot be negative');
  if (marketValue != null && marketValue < 0) reject('marketValue cannot be negative');

  // PPF-047 — lending "150% of value" is not a configuration, it is a mistake.
  if (ltv != null && (ltv < 0 || ltv > 100)) {
    reject('eligibleLtvPercent must be between 0 and 100');
  }

  // PPF-029 — a property cannot have been valued on a day that has not happened.
  let valuationDate: Date | null = null;
  if (input.valuationDate) {
    valuationDate = new Date(String(input.valuationDate));
    if (Number.isNaN(valuationDate.getTime())) reject('valuationDate is invalid');
    if (valuationDate.getTime() > now.getTime()) reject('valuationDate cannot be in the future');
  }

  // PPF-045 — the eligible amount is DERIVED from the valuation and the LTV.
  // A figure the client sends is never what the register says the asset covers.
  const eligibleAmount =
    marketValue != null && ltv != null ? money((marketValue * ltv) / 100) : null;

  // PPF-046 — the failure a mortgage register exists to prevent.
  if (eligibleAmount != null && opts.principal > eligibleAmount) {
    reject(
      `Principal ${opts.principal} exceeds the ${eligibleAmount} this property supports at ${ltv}% of ${marketValue}`,
    );
  }

  return {
    propertyType: input.propertyType ?? null,
    address: input.address ?? null,
    surveyNo: input.surveyNo ?? null,
    extentValue,
    extentUnit: input.extentUnit ?? null,
    marketValue,
    eligibleLtvPercent: ltv,
    eligibleAmount,
    encumbranceStatus: input.encumbranceStatus ?? null,
    registrationNo: input.registrationNo ?? null,
    valuerName: input.valuerName ?? null,
    valuationDate,
    titleDeedPath: input.titleDeedPath ?? null,
    ecPath: input.ecPath ?? null,
    taxReceiptPath: input.taxReceiptPath ?? null,
    photoPath: input.photoPath ?? null,
  };
}

export type ProductItemInput = Record<string, unknown>;

/**
 * Validate a financed-item register entry and DERIVE the financed amount.
 *
 * @param principal the loan principal; the ledger and the register cannot
 *                  disagree about the same advance.
 * @param tenure    the loan tenure in months; one contract, one term.
 */
export function normaliseProductItem(
  input: ProductItemInput,
  opts: { principal: number; tenure: number },
): Record<string, unknown> {
  const invoiceAmount = num(input.invoiceAmount);
  const downPayment = num(input.downPayment);
  const tenureMonths = num(input.tenureMonths);

  // PPF-123 — a negative invoice must not reach the item register.
  if (invoiceAmount != null && invoiceAmount < 0) reject('invoiceAmount cannot be negative');
  if (downPayment != null && downPayment < 0) reject('downPayment cannot be negative');

  // PPF-122 — a down payment at or above the invoice leaves nothing to finance.
  if (invoiceAmount != null && downPayment != null && downPayment >= invoiceAmount) {
    reject('downPayment must be less than invoiceAmount — there is nothing left to finance');
  }

  // PPF-120 — the financed amount IS the invoice less the down payment; it is
  // derived, never accepted from the request.
  const financedAmount =
    invoiceAmount != null ? money(invoiceAmount - (downPayment ?? 0)) : null;

  // PPF-121 — the item register and the ledger describe the same advance.
  if (financedAmount != null && money(opts.principal) !== financedAmount) {
    reject(
      `financedAmount ${financedAmount} (invoice ${invoiceAmount} less down payment ${downPayment ?? 0}) does not match the loan principal ${opts.principal}`,
    );
  }

  // PPF-124 — one contract, one term.
  if (tenureMonths != null && tenureMonths !== opts.tenure) {
    reject(`tenureMonths ${tenureMonths} does not match the loan tenure ${opts.tenure}`);
  }

  return {
    category: input.category ?? null,
    productName: input.productName ?? null,
    brand: input.brand ?? null,
    modelNo: input.modelNo ?? null,
    serialNo: input.serialNo ?? null,
    dealerName: input.dealerName ?? null,
    dealerId: input.dealerId ?? null,
    invoiceNo: input.invoiceNo ?? null,
    invoiceAmount,
    downPayment,
    financedAmount,
    tenureMonths: tenureMonths ?? opts.tenure,
    warrantyExpiry: input.warrantyExpiry ? new Date(String(input.warrantyExpiry)) : null,
    invoicePath: input.invoicePath ?? null,
    photoPath: input.photoPath ?? null,
  };
}
