# Step 10 — Tests, Seed Data, QA Evidence, and Release Checklist

> **Implementation status (2026-07-08): PARTIAL.** Done: `chitCalculation` + `chitSecurity` suites, `seed-chit-demo.ts`, `backfill-chit-schema.ts`, `test:chits`/`seed:chits`/`backfill:chits` scripts, e2e group-creation coverage. Missing: compliance, collections, auction-workflow, payout, and reports suites (5 of 7), plus the QA evidence file and release-checklist execution. See `IMPLEMENTATION_STATUS_GAP_ANALYSIS.md`.

## Goal

Make the chit-fund module safe to release after Steps 1–9.

This step adds automated tests, realistic seed data, QA evidence, and production release checks.

## Files to create

```txt
tests/chits/chitCalculation.test.ts
tests/chits/chitGroupCompliance.test.ts
tests/chits/chitCollections.test.ts
tests/chits/chitAuctionWorkflow.test.ts
tests/chits/chitPrizePayout.test.ts
tests/chits/chitReports.test.ts
tests/chits/chitSecurity.test.ts
scripts/seed-chit-demo.ts
Testing/qa_evidence/chitfunds/chitfunds-qa-summary.md
```

## Files to update

```txt
package.json
prisma/seed.ts
README.md or docs/chitfunds.md if available
```

## Package scripts

Add to `package.json`:

```json
{
  "test:chits": "tsx tests/chits/chitCalculation.test.ts && tsx tests/chits/chitGroupCompliance.test.ts && tsx tests/chits/chitCollections.test.ts && tsx tests/chits/chitAuctionWorkflow.test.ts && tsx tests/chits/chitPrizePayout.test.ts && tsx tests/chits/chitReports.test.ts && tsx tests/chits/chitSecurity.test.ts",
  "test:chits:calculation": "tsx tests/chits/chitCalculation.test.ts",
  "test:chits:security": "tsx tests/chits/chitSecurity.test.ts",
  "seed:chits": "tsx scripts/seed-chit-demo.ts"
}
```

## Test 1 — Calculation tests

File:

```txt
tests/chits/chitCalculation.test.ts
```

Cover:

- bid discount
- commission
- dividend
- max discount validation
- commission cap validation
- payment add mode
- payment set-total mode
- rounding
- invalid values

Minimum scenarios:

```txt
100000 chit value, 75000 prize, 25000 discount, 5% commission = 1250
100000 chit value, 80000 prize, 20000 discount, 20 members = dividend calculation
Partial payment 2000 + 3000 against 5000 due = paid
Partial payment 2000 + 1000 against 5000 due = partial
```

## Test 2 — Group compliance tests

File:

```txt
tests/chits/chitGroupCompliance.test.ts
```

Cover:

1. Can create draft group with minimum fields.
2. Cannot activate without registration number.
3. Cannot activate without registrar office.
4. Cannot activate without by-law number.
5. Cannot activate without commencement certificate.
6. Cannot activate without approved bank.
7. Cannot activate without full member count.
8. Cannot activate with duplicate/missing ticket number.
9. Cannot activate if required agreements are pending.
10. Can activate when all required details are complete.
11. Activation generates subscriptions once.
12. Activation generates auction stubs once.

## Test 3 — Collection tests

File:

```txt
tests/chits/chitCollections.test.ts
```

Cover:

1. Collection creates receipt.
2. Collection creates account entry.
3. Collection credits branch wallet.
4. Partial payment keeps status partial.
5. Full payment changes status paid.
6. Duplicate collection does not double-count unless new amount is posted.
7. Payment mode and reference number are stored.
8. Mark missed blocks partially paid subscription.
9. Penalty can be applied.
10. Penalty can be paid.
11. Penalty can be waived with admin role.
12. Receipt reversal reduces paid amount.
13. Receipt reversal posts accounting/wallet reversal.

## Test 4 — Auction workflow tests

File:

```txt
tests/chits/chitAuctionWorkflow.test.ts
```

Cover:

1. Auction starts in pending status.
2. Notice can be marked sent.
3. Attendance can be marked.
4. Proxy attendance requires proxy name.
5. Bid can be added by eligible member.
6. Bid rejected if prize amount exceeds chit value.
7. Bid rejected if discount exceeds configured cap.
8. Member who already won cannot bid/win again.
9. Winner is selected from valid bids.
10. Tie uses earliest bid time or configured rule.
11. Confirm auction calculates values using shared engine.
12. Confirm auction stores minutes.
13. Confirm auction does not post payout.
14. Confirm auction sets payout status to security_pending.

## Test 5 — Prize payout tests

File:

```txt
tests/chits/chitPrizePayout.test.ts
```

Cover:

1. Cannot release payout before auction confirmation.
2. Cannot release payout without security submission.
3. Cannot release payout with rejected security.
4. Cannot release payout with only submitted security.
5. Cannot release payout with only verified security if approval required.
6. Can release payout after approved security.
7. Payout creates account entry.
8. Payout debits branch wallet.
9. Payout creates payout receipt/voucher.
10. Duplicate payout is blocked.
11. Payout updates auction payoutStatus to paid.

## Test 6 — Report tests

File:

```txt
tests/chits/chitReports.test.ts
```

Cover:

1. Every chit report slug exists in registry.
2. Group report returns active groups.
3. Group ledger returns period-wise records.
4. Subscriber ledger returns due/paid/balance.
5. Auction register returns confirmed auction.
6. Bid history returns all bids.
7. Payout report returns paid/pending payouts.
8. Agreement pending report returns pending members.
9. Security pending report returns pending securities.
10. Receipt register returns collection/payout/reversal receipts.
11. CSV export works.
12. Excel export works if supported.
13. Branch filter does not leak other branch data.

## Test 7 — Security tests

File:

```txt
tests/chits/chitSecurity.test.ts
```

Cover:

1. Tenant A cannot access Tenant B group.
2. Branch A cannot access Branch B group.
3. Agent cannot create group.
4. Agent cannot activate group.
5. Agent cannot confirm auction.
6. Agent cannot approve security.
7. Agent cannot release payout.
8. Guessed subscription ID from another branch is rejected.
9. Guessed auction ID from another branch is rejected.
10. Reports are branch scoped.

## Seed data

Create:

```txt
scripts/seed-chit-demo.ts
```

Seed scenario:

### Tenant and branch

- Tenant: Demo Chit Finance
- Branches: Erode, Chennai

### Customers

Create 20 active customers for Erode.

### Chit group

- Name: Erode 20 Month Chit
- Chit value: 100000
- Monthly contribution: 5000
- Total members: 20
- Duration: 20 months
- Commission: 5%
- Max discount: configurable sample value
- Compliance status: active
- Registration fields filled with demo values

### Members

- 20 members
- Ticket numbers 1–20
- Agreement status verified
- Nominee details present

### Subscriptions

- Period 1: paid for most, partial/missed for a few
- Period 2: upcoming

### Auction

- Period 1 confirmed
- Attendance records
- At least 3 bids
- Winner selected
- Security approved
- Payout paid

### Reports

Seed must produce data visible in all reports.

## QA evidence file

Create:

```txt
Testing/qa_evidence/chitfunds/chitfunds-qa-summary.md
```

Template:

```md
# Chit Funds QA Summary

## Build details

- Date:
- Branch:
- Commit:
- Tester:

## Test commands run

```bash
npm run db:validate
npm run db:generate
npm run typecheck
npm run lint
npm run test:chits
npm run test:e2e-ui-critical
```

## Manual QA coverage

| Area | Status | Notes |
|---|---|---|
| Group draft creation | Pass/Fail | |
| Group activation | Pass/Fail | |
| Member agreement | Pass/Fail | |
| Collection receipt | Pass/Fail | |
| Auction bid history | Pass/Fail | |
| Auction confirmation | Pass/Fail | |
| Security approval | Pass/Fail | |
| Prize payout | Pass/Fail | |
| Reports | Pass/Fail | |
| Mobile parity | Pass/Fail | |
| Branch security | Pass/Fail | |

## Known gaps

- 

## Release recommendation

- Ready / Not ready
```

## Manual QA checklist

### Web

- Login as superadmin.
- Create draft chit group.
- Fill compliance details.
- Add/select members.
- Add nominee/ticket/agreement details.
- Activate group.
- Collect subscription for member.
- Print/view receipt.
- Mark one subscription missed.
- Apply penalty.
- Start auction.
- Mark attendance.
- Add multiple bids.
- Confirm winning bid.
- Verify no payout happened yet.
- Submit security.
- Approve security.
- Release payout.
- Verify account entry and wallet balance.
- Open all chit reports.
- Export CSV/Excel/PDF.

### Mobile

- Login as agent.
- View only scoped branch groups.
- Collect subscription.
- View receipt number.
- Try restricted admin action and confirm blocked.
- Login as admin.
- View auction/security status.
- Confirm role-specific actions.

### Security

- Try changing URL IDs to another branch's group.
- Try changing subscription ID in API.
- Try report filter with another branch ID.
- Confirm data is blocked.

## Production release checklist

### Database

- [ ] Prisma schema validated.
- [ ] Migration SQL reviewed.
- [ ] Backup completed.
- [ ] Baseline migration handled if production used `db push` earlier.
- [ ] Migration applied to staging.
- [ ] Backfill script executed and verified.
- [ ] Migration applied to production.

### Application

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run test:chits` passes.
- [ ] Existing regression tests pass.
- [ ] UI build passes.
- [ ] Mobile API compatibility tested.

### Business

- [ ] Compliance fields reviewed.
- [ ] Agreement template reviewed.
- [ ] Auction calculation policy confirmed.
- [ ] Dividend distribution policy confirmed.
- [ ] Commission cap handling confirmed.
- [ ] Max discount handling confirmed.
- [ ] Surety/security approval process confirmed.
- [ ] Receipt format confirmed.
- [ ] Reports confirmed by business users.

### Rollback

- [ ] Database backup available.
- [ ] Feature flags available.
- [ ] Old direct payout flow disabled safely.
- [ ] Rollback steps documented.

## Final acceptance criteria

- New chit module works end-to-end in seeded demo.
- Web and mobile use the same backend logic.
- Reports and exports work.
- Security tests pass.
- No duplicate payout or duplicate receipt issue.
- Production migration path is known and tested.

## Implementation prompt for coding agent

```txt
Implement Step 10 for the ZoloFund chit-fund module.

Add the complete chit test suite under tests/chits, seed script scripts/seed-chit-demo.ts, QA evidence template under Testing/qa_evidence/chitfunds, and package.json scripts. Cover calculations, compliance activation, collections/receipts/reversals, auction workflow, security/payout approval, reports, and tenant/branch security.

Ensure npm run test:chits passes. Seed demo data should create a complete active chit group with members, subscriptions, auction bids, confirmed auction, approved security, payout, receipts, penalties, and reportable data.
```
