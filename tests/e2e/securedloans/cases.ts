/**
 * Property Loan & Product Finance — master test-case catalogue.
 *
 * These two modules share one suite because they share one shape: both reuse
 * the generic loan lifecycle already covered by the micro-lending suite, and
 * both add exactly one thing on top — a collateral row written inside the
 * origination transaction, plus one route that changes its custody state
 * (property-release, product-repossession).
 *
 * So this catalogue is a DELTA, not a copy. It does not re-test origination
 * arithmetic, schedules, collection or penalties; those have their own suite.
 * It tests what only exists here: what the collateral row is allowed to say,
 * who may change its custody, and whether the figures on it were validated or
 * merely accepted.
 *
 * Case ids use the PPF- prefix. Where a case applies to only one of the two
 * modules the title says which.
 */

export type Automation = 'auto' | 'manual';
export type Priority = 'P0' | 'P1' | 'P2';

export type SecuredCase = {
  id: string;
  area: string;
  title: string;
  priority: Priority;
  automation: Automation;
  rules?: string[];
  pre?: string;
  steps: string[];
  expected: string[];
};

export const AREAS = [
  'Module Access & Gating',
  'Property Collateral Capture',
  'Property Valuation & LTV',
  'Mortgage Release',
  'Property Documents',
  'Product Item Capture',
  'Product Amount Integrity',
  'Product Repossession',
  'Shared Lifecycle Delta',
  'Reports',
  'Isolation & RBAC',
  'Security & Negative',
] as const;

export const CASES: SecuredCase[] = [
  // ───────────────────── A. Module Access & Gating ─────────────────────
  {
    id: 'PPF-001', area: 'Module Access & Gating', priority: 'P0', automation: 'auto',
    title: 'Registering with property selected entitles the tenant to the module',
    rules: ['SCOPE-4'],
    steps: ['Register a tenant with selectedModules ["property"]'],
    expected: ['The subscription snapshot carries property', 'The owner is provisioned on that module'],
  },
  {
    id: 'PPF-002', area: 'Module Access & Gating', priority: 'P0', automation: 'auto',
    title: 'Registering with productfinance selected entitles the tenant to the module',
    rules: ['SCOPE-4'],
    steps: ['Register a tenant with selectedModules ["productfinance"]'],
    expected: ['The subscription snapshot carries productfinance'],
  },
  {
    id: 'PPF-003', area: 'Module Access & Gating', priority: 'P0', automation: 'auto',
    title: 'A tenant without the module is refused its pages',
    rules: ['SCOPE-4'],
    steps: ['Open the property loan list as a tenant that has only microlending'],
    expected: ['requireModule refuses', 'No loan from any tenant is rendered'],
  },
  {
    id: 'PPF-004', area: 'Module Access & Gating', priority: 'P1', automation: 'auto',
    title: 'Each module stamps its own appType on the loan and the collateral',
    rules: ['SCOPE-1'],
    steps: ['Originate one property loan and one product loan, then read both rows'],
    expected: ['The loans carry property and productfinance respectively', 'Neither appears under a micro-lending query'],
  },
  {
    id: 'PPF-005', area: 'Module Access & Gating', priority: 'P1', automation: 'auto',
    title: 'Both modules share the generic loan routes rather than having their own',
    rules: ['STRUCT-3'],
    steps: ['Originate through /api/v1/loans for each module'],
    expected: ['One origination path serves both', 'The collateral block is the only difference in the request'],
  },
  {
    id: 'PPF-006', area: 'Module Access & Gating', priority: 'P2', automation: 'auto',
    title: 'Every collateral endpoint refuses an unauthenticated caller',
    rules: ['ROLE-4', 'X-13'],
    steps: ['Call property-release and product-repossession with no token'],
    expected: ['HTTP 401 on both', 'No loan or collateral data in either body'],
  },
  {
    id: 'PPF-007', area: 'Module Access & Gating', priority: 'P0', automation: 'auto',
    title: 'The verification link activates the secured-lending owner',
    rules: ['AUTH-3'],
    steps: ['Open /api/auth/verify-email with a validly signed token for the owner'],
    expected: ['The owner moves from pending to active'],
  },
  {
    id: 'PPF-008', area: 'Module Access & Gating', priority: 'P1', automation: 'auto',
    title: 'A second branch, an admin and an agent are seeded for the journey',
    rules: ['SCOPE-13'],
    steps: ['Create the Erode branch, a branch admin and a field agent'],
    expected: ['Each staff row is stamped with its branch', 'Both accounts can authenticate'],
  },
  {
    id: 'PPF-009', area: 'Module Access & Gating', priority: 'P1', automation: 'auto',
    title: 'Customers are onboarded in both branches',
    rules: ['SCOPE-3'],
    steps: ['Create six HQ and two Erode customers'],
    expected: ['Each lands on the branch it was filed against'],
  },
  {
    id: 'PPF-010', area: 'Module Access & Gating', priority: 'P1', automation: 'auto',
    title: 'A product-finance customer is onboarded under its own module',
    rules: ['SCOPE-1'],
    steps: ['Create a customer with appType productfinance'],
    expected: ['The row carries productfinance', 'A customer belongs to the module they were filed under'],
  },

  // ────────────── B. Property Collateral Capture ──────────────
  {
    id: 'PPF-020', area: 'Property Collateral Capture', priority: 'P0', automation: 'auto',
    title: 'A property loan writes its collateral row in the same transaction',
    rules: ['DB-8'],
    steps: ['Originate a property loan with a property block'],
    expected: ['Loan, schedule and PropertyCollateral all exist', 'All three carry the same tenant and branch'],
  },
  {
    id: 'PPF-021', area: 'Property Collateral Capture', priority: 'P0', automation: 'auto',
    title: 'A failure part-way leaves no half-secured loan',
    rules: ['DB-8'],
    steps: ['Force the collateral insert to fail after the loan row is built'],
    expected: ['No loan, no schedule and no collateral survive'],
  },
  {
    id: 'PPF-022', area: 'Property Collateral Capture', priority: 'P0', automation: 'auto',
    title: 'One loan carries at most one property',
    steps: ['Attempt to attach a second PropertyCollateral to the same loan'],
    expected: ['Refused by the unique loanId', 'A loan secured twice over is not a state the ledger can express'],
  },
  {
    id: 'PPF-023', area: 'Property Collateral Capture', priority: 'P0', automation: 'auto',
    title: 'A property loan without a property block is refused',
    rules: ['GOLD-3'],
    pre: 'The gold module refuses an origination with no collateral; the property module has no equivalent guard',
    steps: ['Originate on the property module with no property block at all'],
    expected: ['Refused', 'A property loan with no property is an unsecured loan wearing the wrong label'],
  },
  {
    id: 'PPF-024', area: 'Property Collateral Capture', priority: 'P1', automation: 'auto',
    title: 'The essential identifying fields are required',
    steps: ['Originate with a property block carrying no address, survey number or property type'],
    expected: ['Refused, or the loan is held for review', 'A mortgage that cannot identify the asset cannot be enforced'],
  },
  {
    id: 'PPF-025', area: 'Property Collateral Capture', priority: 'P1', automation: 'auto',
    title: 'The extent is stored with its unit',
    steps: ['Originate with an extent of 2400 and a unit of sqft'],
    expected: ['Both persist', 'A bare number without its unit is not a measurement'],
  },
  {
    id: 'PPF-026', area: 'Property Collateral Capture', priority: 'P1', automation: 'auto',
    title: 'A negative extent or market value is refused',
    steps: ['Originate with an extent of −2400, then a market value of −5000000'],
    expected: ['Both refused', 'No negative measurement or valuation reaches the register'],
  },
  {
    id: 'PPF-027', area: 'Property Collateral Capture', priority: 'P1', automation: 'auto',
    title: 'The encumbrance status is recorded and constrained',
    steps: ['Originate with encumbranceStatus "clear", then with "banana"'],
    expected: ['The known value persists', 'An unknown one is refused rather than stored raw — every report groups on it'],
  },
  {
    id: 'PPF-028', area: 'Property Collateral Capture', priority: 'P1', automation: 'auto',
    title: 'The valuer and the valuation date are captured together',
    steps: ['Originate with a valuer name but no valuation date'],
    expected: ['Either both are required or both are optional', 'A valuation with no date cannot be aged'],
  },
  {
    id: 'PPF-029', area: 'Property Collateral Capture', priority: 'P2', automation: 'auto',
    title: 'A valuation date in the future is refused',
    steps: ['Originate with a valuation date of next month'],
    expected: ['Refused', 'A property cannot have been valued on a day that has not happened'],
  },
  {
    id: 'PPF-030', area: 'Property Collateral Capture', priority: 'P1', automation: 'auto',
    title: 'The collateral is stamped with the branch that owns the loan',
    rules: ['SCOPE-3'],
    steps: ['Originate in Erode and read the collateral row'],
    expected: ['branchId is Erode, matching the loan'],
  },
  {
    id: 'PPF-031', area: 'Property Collateral Capture', priority: 'P2', automation: 'auto',
    title: 'The mortgage status starts as mortgaged',
    steps: ['Originate and read the collateral'],
    expected: ['mortgageStatus is mortgaged with no releasedAt and no releasedBy'],
  },

  // ────────────── C. Property Valuation & LTV ──────────────
  {
    id: 'PPF-045', area: 'Property Valuation & LTV', priority: 'P0', automation: 'auto',
    title: 'The eligible amount is derived, not accepted from the request',
    rules: ['GOLD-1', 'AF-1'],
    pre: 'The origination route stores eligibleLtvPercent and eligibleAmount verbatim from the body',
    steps: ['Originate with a market value of 5000000, an eligible LTV of 60 and a claimed eligible amount of 5000000'],
    expected: ['The stored eligible amount is 3000000 — market value × the LTV', 'A figure a client claimed is never what the mortgage register says the property supports'],
  },
  {
    id: 'PPF-046', area: 'Property Valuation & LTV', priority: 'P0', automation: 'auto',
    title: 'A principal above the eligible amount is refused',
    rules: ['GOLD-1'],
    steps: ['Originate 4000000 against a property whose eligible amount is 3000000'],
    expected: ['Refused, naming both figures', 'Lending past the collateral is the failure this register exists to prevent'],
  },
  {
    id: 'PPF-047', area: 'Property Valuation & LTV', priority: 'P0', automation: 'auto',
    title: 'An eligible LTV above 100 is refused',
    steps: ['Originate with an eligible LTV of 150'],
    expected: ['Refused, or clamped to 100', 'No configuration lends more than the asset is worth'],
  },
  {
    id: 'PPF-048', area: 'Property Valuation & LTV', priority: 'P1', automation: 'auto',
    title: 'A zero or negative eligible LTV is refused',
    steps: ['Originate with an eligible LTV of 0, then −10'],
    expected: ['Both refused'],
  },
  {
    id: 'PPF-049', area: 'Property Valuation & LTV', priority: 'P1', automation: 'auto',
    title: 'The borrower’s existing secured exposure counts toward the ceiling',
    rules: ['GOLD-1'],
    steps: ['Originate a second property loan for a borrower already holding one'],
    expected: ['The combined exposure is measured against the combined collateral', 'One borrower cannot mortgage the same headroom twice'],
  },
  {
    id: 'PPF-050', area: 'Property Valuation & LTV', priority: 'P1', automation: 'auto',
    title: 'The applied LTV is snapshotted on the collateral row',
    rules: ['GOLD-4'],
    steps: ['Originate and read the collateral'],
    expected: ['eligibleLtvPercent and eligibleAmount are stored', 'A later policy change never restates an originated mortgage'],
  },
  {
    id: 'PPF-051', area: 'Property Valuation & LTV', priority: 'P2', automation: 'auto',
    title: 'The eligible amount rounds down',
    steps: ['Originate where market value × LTV carries a fraction'],
    expected: ['The eligible amount never rounds up'],
  },

  // ───────────────────── D. Mortgage Release ─────────────────────
  {
    id: 'PPF-065', area: 'Mortgage Release', priority: 'P0', automation: 'auto',
    title: 'Releasing a mortgage records the status, the moment and the officer',
    steps: ['Release the property on a settled loan'],
    expected: ['mortgageStatus released, releasedAt stamped, releasedBy set', 'The release is audited'],
  },
  {
    id: 'PPF-066', area: 'Mortgage Release', priority: 'P0', automation: 'auto',
    title: 'A mortgage cannot be released while the loan is still outstanding',
    pre: 'The release route reads the loan only to confirm it exists — it never looks at the loan status or balance',
    steps: ['Release the property on a loan with instalments still owing'],
    expected: ['Refused', 'A title deed handed back on an unpaid loan leaves the debt unsecured, and no later step can undo it'],
  },
  {
    id: 'PPF-067', area: 'Mortgage Release', priority: 'P0', automation: 'auto',
    title: 'Who may release a mortgage is enforced server-side',
    rules: ['ROLE-4'],
    pre: 'The route requires only that some token authenticates',
    steps: ['Release as an agent, then as a branch admin, then as the owner'],
    expected: ['The roles allowed to hand back a title deed are decided deliberately and enforced by the handler'],
  },
  {
    id: 'PPF-068', area: 'Mortgage Release', priority: 'P0', automation: 'auto',
    title: 'A release is scoped to the branch that owns the loan',
    rules: ['SCOPE-3'],
    pre: 'The route resolves the loan by id and tenantId alone — no appType, no branch',
    steps: ['Release the Erode property while HQ is the active branch'],
    expected: ['Refused with 404', 'The Erode collateral is untouched'],
  },
  {
    id: 'PPF-069', area: 'Mortgage Release', priority: 'P0', automation: 'auto',
    title: 'Releasing twice does not rewrite who released it',
    steps: ['Release once as user A, then again as user B'],
    expected: ['The second call is refused, or leaves the original releasedAt and releasedBy intact', 'The record of who handed back the deed is not overwritten by whoever clicked last'],
  },
  {
    id: 'PPF-070', area: 'Mortgage Release', priority: 'P1', automation: 'auto',
    title: 'A release on a loan with no property is refused cleanly',
    steps: ['Call property-release on a micro-lending loan'],
    expected: ['HTTP 404 "Property collateral not found for this loan"', 'Not a 500'],
  },
  {
    id: 'PPF-071', area: 'Mortgage Release', priority: 'P1', automation: 'auto',
    title: 'A released property does not appear as held in the register',
    steps: ['Release, then run the mortgage-status report'],
    expected: ['The property moves out of the mortgaged total', 'The register is one a records clerk could reconcile against the deed cupboard'],
  },
  {
    id: 'PPF-072', area: 'Mortgage Release', priority: 'P1', automation: 'auto',
    title: 'A loan from another tenant cannot be released',
    rules: ['API-5'],
    steps: ['Release a tenant-B loan with a tenant-A token'],
    expected: ['HTTP 404 — existence is not confirmed'],
  },
  {
    id: 'PPF-073', area: 'Mortgage Release', priority: 'P2', automation: 'auto',
    title: 'The release reason is recorded where it can be read back',
    steps: ['Release with a reason and re-read the collateral'],
    expected: ['The reason is retrievable from the record, not only from an audit blob'],
  },

  // ───────────────────── E. Property Documents ─────────────────────
  {
    id: 'PPF-085', area: 'Property Documents', priority: 'P1', automation: 'auto',
    title: 'Title deed, encumbrance certificate and tax receipt paths are stored',
    steps: ['Originate with all three document paths'],
    expected: ['Each persists on its own field', 'A single documents blob would make the register unsearchable'],
  },
  {
    id: 'PPF-086', area: 'Property Documents', priority: 'P1', automation: 'auto',
    title: 'A document path is not a world-readable URL',
    rules: ['X-13'],
    steps: ['Fetch a stored title-deed path while logged out'],
    expected: ['Refused, or the URL is short-lived', 'A title deed is never readable by guessing a path'],
  },
  {
    id: 'PPF-087', area: 'Property Documents', priority: 'P2', automation: 'manual',
    title: 'An upload rejects a disallowed file type',
    steps: ['Upload an .exe as a title deed'],
    expected: ['Refused', 'No document row is created'],
  },
  {
    id: 'PPF-088', area: 'Property Documents', priority: 'P2', automation: 'auto',
    title: 'Documents survive a release',
    steps: ['Release the property and re-read the collateral'],
    expected: ['The document paths are still present', 'A released mortgage still has to be evidenced years later'],
  },

  // ────────────────── F. Product Item Capture ──────────────────
  {
    id: 'PPF-100', area: 'Product Item Capture', priority: 'P0', automation: 'auto',
    title: 'A product loan writes its item row in the same transaction',
    rules: ['DB-8'],
    steps: ['Originate a product-finance loan with an item block'],
    expected: ['Loan, schedule and ProductFinanceItem all exist', 'All three carry the same tenant and branch'],
  },
  {
    id: 'PPF-101', area: 'Product Item Capture', priority: 'P0', automation: 'auto',
    title: 'One loan finances at most one item row',
    steps: ['Attempt to attach a second ProductFinanceItem to the same loan'],
    expected: ['Refused by the unique loanId'],
  },
  {
    id: 'PPF-102', area: 'Product Item Capture', priority: 'P0', automation: 'auto',
    title: 'A product loan without an item block is refused',
    steps: ['Originate on the product module with no item block'],
    expected: ['Refused', 'A consumer-durable loan with no durable is an unsecured personal loan'],
  },
  {
    id: 'PPF-103', area: 'Product Item Capture', priority: 'P1', automation: 'auto',
    title: 'The item is identified by more than a free-text name',
    steps: ['Originate with only a product name and no brand, model or serial'],
    expected: ['Refused, or flagged', 'An item that cannot be identified cannot be repossessed'],
  },
  {
    id: 'PPF-104', area: 'Product Item Capture', priority: 'P1', automation: 'auto',
    title: 'A serial number is unique within the tenant',
    steps: ['Finance two loans against the same serial number'],
    expected: ['The second is refused', 'One physical appliance is not collateral for two loans'],
  },
  {
    id: 'PPF-105', area: 'Product Item Capture', priority: 'P1', automation: 'auto',
    title: 'The dealer is validated when one is named',
    rules: ['SCOPE-1'],
    steps: ['Originate naming a dealerId from another tenant'],
    expected: ['HTTP 404 — a crafted id cannot link a loan across tenants'],
  },
  {
    id: 'PPF-106', area: 'Product Item Capture', priority: 'P1', automation: 'auto',
    title: 'The invoice number and date are captured together',
    steps: ['Originate with an invoice number and no invoice amount'],
    expected: ['Either both are required or neither', 'An invoice reference with no amount cannot be reconciled against the dealer'],
  },
  {
    id: 'PPF-107', area: 'Product Item Capture', priority: 'P2', automation: 'auto',
    title: 'A warranty expiry in the past is accepted but visible',
    steps: ['Originate with a warranty expiry of last year'],
    expected: ['Stored', 'The item reads as out of warranty wherever that matters'],
  },
  {
    id: 'PPF-108', area: 'Product Item Capture', priority: 'P2', automation: 'auto',
    title: 'The repossession status starts as active',
    steps: ['Originate and read the item'],
    expected: ['repossessionStatus is active with no repossessedAt'],
  },

  // ────────────── G. Product Amount Integrity ──────────────
  {
    id: 'PPF-120', area: 'Product Amount Integrity', priority: 'P0', automation: 'auto',
    title: 'The financed amount is the invoice less the down payment',
    pre: 'invoiceAmount, downPayment and financedAmount are each stored verbatim from the request',
    steps: ['Originate with invoice 60000, down payment 10000 and a claimed financed amount of 60000'],
    expected: ['The stored financed amount is 50000', 'Three figures that must reconcile cannot each be accepted independently'],
  },
  {
    id: 'PPF-121', area: 'Product Amount Integrity', priority: 'P0', automation: 'auto',
    title: 'The financed amount matches the loan principal',
    steps: ['Originate with a financed amount that disagrees with the loan principal'],
    expected: ['Refused', 'The item register and the ledger cannot disagree about what was lent'],
  },
  {
    id: 'PPF-122', area: 'Product Amount Integrity', priority: 'P0', automation: 'auto',
    title: 'A down payment at or above the invoice is refused',
    steps: ['Originate with a down payment equal to the invoice, then above it'],
    expected: ['Both refused', 'There is nothing left to finance'],
  },
  {
    id: 'PPF-123', area: 'Product Amount Integrity', priority: 'P1', automation: 'auto',
    title: 'A negative invoice, down payment or financed amount is refused',
    steps: ['Originate with each of the three negative in turn'],
    expected: ['All three refused by name'],
  },
  {
    id: 'PPF-124', area: 'Product Amount Integrity', priority: 'P1', automation: 'auto',
    title: 'The item tenure matches the loan tenure',
    steps: ['Originate with an item tenure of 12 against a 24-month loan'],
    expected: ['Refused, or the item tenure is derived from the schedule', 'One contract, one term'],
  },
  {
    id: 'PPF-125', area: 'Product Amount Integrity', priority: 'P2', automation: 'auto',
    title: 'Money fields keep their precision',
    rules: ['DB-13'],
    steps: ['Originate with an invoice of 59999.99 and a down payment of 9999.99'],
    expected: ['The financed amount is exactly 50000', 'No floating-point residue'],
  },

  // ────────────── H. Product Repossession ──────────────
  {
    id: 'PPF-140', area: 'Product Repossession', priority: 'P0', automation: 'auto',
    title: 'Repossessing an item records the status and the moment',
    steps: ['Repossess the financed item'],
    expected: ['repossessionStatus repossessed with repossessedAt stamped', 'The action is audited'],
  },
  {
    id: 'PPF-141', area: 'Product Repossession', priority: 'P0', automation: 'auto',
    title: 'The repossession reason is stored on the record, not only in the audit',
    pre: 'The route reads body.reason and writes it into the audit newValue, but never onto the item row',
    steps: ['Repossess with a reason and re-read the item'],
    expected: ['The reason is readable from the item', 'A recovery clerk should not have to read the audit log to learn why an appliance was taken'],
  },
  {
    id: 'PPF-142', area: 'Product Repossession', priority: 'P0', automation: 'auto',
    title: 'An unrecognised status does not silently un-repossess the item',
    pre: 'Anything that is not the literal "repossessed" is coerced to "active"',
    steps: ['Repossess the item, then POST again with a status of "reposessed" (misspelled)'],
    expected: ['The typo is refused', 'A misspelling must not quietly release an asset the office is holding'],
  },
  {
    id: 'PPF-143', area: 'Product Repossession', priority: 'P0', automation: 'auto',
    title: 'Who may repossess is enforced server-side',
    rules: ['ROLE-4'],
    pre: 'The route requires only that some token authenticates',
    steps: ['Repossess as an agent, then as a branch admin'],
    expected: ['The allowed roles are decided deliberately and enforced by the handler'],
  },
  {
    id: 'PPF-144', area: 'Product Repossession', priority: 'P0', automation: 'auto',
    title: 'Repossession is scoped to the branch that owns the loan',
    rules: ['SCOPE-3'],
    pre: 'The route resolves the loan by id and tenantId alone',
    steps: ['Repossess the Erode item while HQ is the active branch'],
    expected: ['Refused with 404', 'The Erode item is untouched'],
  },
  {
    id: 'PPF-145', area: 'Product Repossession', priority: 'P1', automation: 'auto',
    title: 'Repossession on a settled loan is refused',
    steps: ['Repossess an item whose loan is closed'],
    expected: ['Refused', 'Nothing is owed, so nothing is recoverable'],
  },
  {
    id: 'PPF-146', area: 'Product Repossession', priority: 'P1', automation: 'auto',
    title: 'Reactivating a repossessed item clears its repossession date',
    steps: ['Repossess, then POST with status active'],
    expected: ['repossessionStatus active and repossessedAt cleared', 'The reversal is audited with its own actor'],
  },
  {
    id: 'PPF-147', area: 'Product Repossession', priority: 'P1', automation: 'auto',
    title: 'A repossession on a loan with no item is refused cleanly',
    steps: ['Call product-repossession on a micro-lending loan'],
    expected: ['HTTP 404 "Product item not found for this loan"', 'Not a 500'],
  },
  {
    id: 'PPF-148', area: 'Product Repossession', priority: 'P1', automation: 'auto',
    title: 'Repossession charges land on a charges ledger, not the principal',
    steps: ['Record a recovery charge against the loan'],
    expected: ['It is an outstanding charge on the account', 'The principal is unchanged'],
  },
  {
    id: 'PPF-149', area: 'Product Repossession', priority: 'P2', automation: 'auto',
    title: 'A repossessed item is filterable from the loan list',
    steps: ['Filter the loan list by repossession status'],
    expected: ['Each value returns exactly its matching set'],
  },

  // ────────────── I. Shared Lifecycle Delta ──────────────
  {
    id: 'PPF-165', area: 'Shared Lifecycle Delta', priority: 'P0', automation: 'auto',
    title: 'Both modules originate through the one origination path',
    rules: ['STRUCT-3'],
    steps: ['Originate on each module and compare the loan rows'],
    expected: ['Same schedule generation, same code sequence, same posting behaviour', 'Only the collateral block differs'],
  },
  {
    id: 'PPF-166', area: 'Shared Lifecycle Delta', priority: 'P0', automation: 'auto',
    title: 'Collection behaves identically to micro-lending',
    steps: ['Collect on a property loan and a product loan'],
    expected: ['The same allocation, receipt and float behaviour the micro-lending suite already covers', 'No module-specific collection path exists'],
  },
  {
    id: 'PPF-167', area: 'Shared Lifecycle Delta', priority: 'P1', automation: 'auto',
    title: 'Closing the loan does not itself release the collateral',
    steps: ['Repay a property loan in full and read the collateral'],
    expected: ['The mortgage is still recorded as held until it is explicitly released', 'Handing back a deed is a physical act with its own record'],
  },
  {
    id: 'PPF-168', area: 'Shared Lifecycle Delta', priority: 'P1', automation: 'auto',
    title: 'Penalties and NPA classification apply unchanged',
    steps: ['Age a property loan past the classification thresholds'],
    expected: ['The same stages and provisioning as any other secured loan'],
  },
  {
    id: 'PPF-169', area: 'Shared Lifecycle Delta', priority: 'P1', automation: 'auto',
    title: 'Foreclosure quotes include the collateral release step',
    steps: ['Quote a foreclosure on a property loan'],
    expected: ['The quote settles the debt and names the release that follows', 'A borrower is told what they get back, not only what they owe'],
  },

  // ──────────────────────── J. Reports ────────────────────────
  {
    id: 'PPF-185', area: 'Reports', priority: 'P1', automation: 'auto',
    title: 'The property collateral register lists every held property',
    steps: ['Run the register after three originations and one release'],
    expected: ['Two held properties are listed', 'The released one is shown as released, not omitted'],
  },
  {
    id: 'PPF-186', area: 'Reports', priority: 'P1', automation: 'auto',
    title: 'The mortgage-status report totals reconcile with the rows',
    steps: ['Run the mortgage-status report'],
    expected: ['Held and released totals sum to every collateral row', 'None is counted twice or dropped'],
  },
  {
    id: 'PPF-187', area: 'Reports', priority: 'P1', automation: 'auto',
    title: 'The product finance register lists items with their dealers',
    steps: ['Run the product register'],
    expected: ['Each item shows its dealer, invoice and financed amount'],
  },
  {
    id: 'PPF-188', area: 'Reports', priority: 'P1', automation: 'auto',
    title: 'The repossession report lists only repossessed items',
    steps: ['Repossess one of three items and run the report'],
    expected: ['Exactly one row', 'With its repossession date'],
  },
  {
    id: 'PPF-189', area: 'Reports', priority: 'P1', automation: 'auto',
    title: 'Reports are branch-scoped',
    rules: ['SCOPE-3'],
    steps: ['Run each report under HQ and under Erode'],
    expected: ['Neither branch sees the other’s collateral'],
  },
  {
    id: 'PPF-190', area: 'Reports', priority: 'P2', automation: 'auto',
    title: 'An empty branch reports zeroes, not errors',
    steps: ['Run every report on a branch with no secured loans'],
    expected: ['Zero totals render', 'No NaN and no exception'],
  },

  // ────────────────── K. Isolation & RBAC ──────────────────
  {
    id: 'PPF-205', area: 'Isolation & RBAC', priority: 'P0', automation: 'auto',
    title: 'A collateral row from another tenant returns 404, not 403',
    rules: ['API-5', 'X-12'],
    steps: ['Read a tenant-B property loan with a tenant-A token'],
    expected: ['HTTP 404'],
  },
  {
    id: 'PPF-206', area: 'Isolation & RBAC', priority: 'P0', automation: 'auto',
    title: 'Switching branch switches the whole secured surface',
    rules: ['SCOPE-3'],
    steps: ['Switch to Erode and reload the loan list and both registers'],
    expected: ['Every list shows Erode rows only'],
  },
  {
    id: 'PPF-207', area: 'Isolation & RBAC', priority: 'P0', automation: 'auto',
    title: 'An agent cannot release a mortgage or repossess an item',
    rules: ['ROLE-4'],
    steps: ['Attempt both as an agent'],
    expected: ['Both refused by the handler', 'Custody of security is not a field decision'],
  },
  {
    id: 'PPF-208', area: 'Isolation & RBAC', priority: 'P1', automation: 'auto',
    title: 'An agent cannot originate a secured loan without the bypass flag',
    rules: ['ROLE-5'],
    steps: ['Originate as an agent with bypassLoanApproval false'],
    expected: ['Held for approval rather than going live'],
  },
  {
    id: 'PPF-209', area: 'Isolation & RBAC', priority: 'P1', automation: 'auto',
    title: 'Collateral postings carry their own module appType',
    rules: ['SCOPE-1'],
    steps: ['Read the account entries both modules created'],
    expected: ['Each is stamped with its own module', 'Neither appears in the other’s ledger'],
  },
  {
    id: 'PPF-210', area: 'Isolation & RBAC', priority: 'P1', automation: 'auto',
    title: 'A soft-deleted loan hides its collateral from the registers',
    rules: ['DB-4'],
    steps: ['Soft-delete a property loan and re-run the register'],
    expected: ['The property is gone from the register', 'Its receipts survive in the ledger'],
  },

  // ────────────── L. Security & Negative ──────────────
  {
    id: 'PPF-225', area: 'Security & Negative', priority: 'P0', automation: 'auto',
    title: 'SQL-shaped payloads in collateral text fields are inert',
    steps: ['Store a drop-table string as a property address and a product name'],
    expected: ['Stored literally', 'The tables still exist'],
  },
  {
    id: 'PPF-226', area: 'Security & Negative', priority: 'P0', automation: 'auto',
    title: 'Script payloads in collateral fields do not execute',
    steps: ['Store a script tag in a valuer name and open the register'],
    expected: ['Rendered as text'],
  },
  {
    id: 'PPF-227', area: 'Security & Negative', priority: 'P0', automation: 'auto',
    title: 'No collateral response carries a password hash, token or secret',
    rules: ['X-13'],
    steps: ['Read the loan, collateral and report payloads for both modules'],
    expected: ['None carries a hash, token or secret'],
  },
  {
    id: 'PPF-228', area: 'Security & Negative', priority: 'P1', automation: 'auto',
    title: 'A loan id from another branch cannot be smuggled into a custody route',
    rules: ['SCOPE-3'],
    steps: ['Send the Erode loan id to property-release and product-repossession while HQ is active'],
    expected: ['Both refuse with 404', 'Neither writes a row'],
  },
  {
    id: 'PPF-229', area: 'Security & Negative', priority: 'P1', automation: 'auto',
    title: 'Malformed JSON is refused cleanly',
    steps: ['POST a broken body to each custody route'],
    expected: ['A 4xx with a validation message', 'No stack trace and no 500'],
  },
  {
    id: 'PPF-230', area: 'Security & Negative', priority: 'P1', automation: 'auto',
    title: 'Extremely large valuations do not overflow the money columns',
    steps: ['Originate with a market value of 1e308'],
    expected: ['Refused by validation', 'No Infinity is persisted'],
  },
  {
    id: 'PPF-231', area: 'Security & Negative', priority: 'P2', automation: 'auto',
    title: 'Error messages do not disclose internals',
    steps: ['Trigger a failure on each custody route'],
    expected: ['No Prisma code, table name or file path in any response'],
  },
  {
    id: 'PPF-232', area: 'Security & Negative', priority: 'P2', automation: 'auto',
    title: 'Two simultaneous releases release once',
    steps: ['Fire two property-release calls at once'],
    expected: ['One succeeds and one is refused', 'One releasedAt, one releasing officer'],
  },
];

/** Convenience counts used by the report builder and the coverage assertion. */
export const CASE_COUNT = CASES.length;
export const AUTOMATED_CASES = CASES.filter((c) => c.automation === 'auto');
export const MANUAL_CASES = CASES.filter((c) => c.automation === 'manual');
