# QUAL-01 — Unit Tests for `loanCalculator.ts` and `repayments.ts`

**Priority:** 🟡 MEDIUM  
**Category:** Code Quality — Test Coverage  
**Effort:** 2–3 hours

---

## Problem

`lib/loanCalculator.ts` and `lib/repayments.ts` contain the core financial math:
- EMI calculation (flat rate vs reducing balance)
- Amortization schedule generation
- Foreclosure amount calculation
- Penalty calculation

These are the highest-risk functions in the system — a 1% error in EMI calculation compounds across thousands of loans. They currently have **zero test coverage**. RBI audit inspections will check that these calculations match regulatory requirements.

---

## Test Framework

The project uses Jest (check `package.json` for `jest` or `vitest`). If no test framework is configured, add `jest` + `ts-jest`:

```
npm install --save-dev jest ts-jest @types/jest
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "jest --testPathPattern=lib/__tests__"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/$1"
    }
  }
}
```

---

## Test Cases to Cover

### `loanCalculator.ts` — EMI Calculation

Standard reducing-balance formula: `EMI = P * r * (1+r)^n / ((1+r)^n - 1)`

| Case | P | Annual Rate | Months | Expected EMI |
|------|---|-------------|--------|-------------|
| Basic 12-month | 100,000 | 12% | 12 | ₹8,884.88 |
| 24-month | 100,000 | 18% | 24 | ₹4,992.41 |
| Short 6-month | 50,000 | 24% | 6 | ₹9,234.40 |
| Flat rate | 100,000 | 12% flat | 12 | ₹9,333.33 (P/n + P*r/12) |
| Zero interest | 60,000 | 0% | 12 | ₹5,000.00 |

### `repayments.ts` — Amortization Schedule

For a loan of ₹100,000 at 12% p.a. for 12 months:
- Sum of all `principal` = ₹100,000 (±₹1 rounding)
- Sum of all `interest` = expected total interest
- Each instalment: `opening_balance - principal = closing_balance`
- First instalment: `principal < EMI`, `interest > 0`
- Last instalment: `closing_balance ≈ 0` (±₹1)

### `repayments.ts` — Foreclosure Amount

At month 6 of a 12-month loan:
- Foreclosure amount = remaining principal + prepayment penalty (if any)
- Must be less than remaining EMI sum (interest savings)
- Zero penalty case: foreclosure = exact remaining principal

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Check existing test setup

```
ls __tests__/ || ls lib/__tests__/ || ls *.test.ts
cat package.json | grep -A 10 '"jest"'
```

### Step 2 — Create test file for loanCalculator

Create `lib/__tests__/loanCalculator.test.ts`:

```typescript
import { calculateEmi, calculateAmortization } from '@/lib/loanCalculator';
// Adjust import path based on actual exports

describe('calculateEmi — reducing balance', () => {
  it('12 months at 12% p.a.', () => {
    const emi = calculateEmi({ principal: 100_000, annualRate: 12, tenureMonths: 12, method: 'reducing' });
    expect(emi).toBeCloseTo(8884.88, 0);
  });

  it('24 months at 18% p.a.', () => {
    const emi = calculateEmi({ principal: 100_000, annualRate: 18, tenureMonths: 24, method: 'reducing' });
    expect(emi).toBeCloseTo(4992.41, 0);
  });

  it('0% interest — equal principal', () => {
    const emi = calculateEmi({ principal: 60_000, annualRate: 0, tenureMonths: 12, method: 'reducing' });
    expect(emi).toBeCloseTo(5000, 0);
  });
});

describe('calculateEmi — flat rate', () => {
  it('12 months at 12% flat', () => {
    const emi = calculateEmi({ principal: 100_000, annualRate: 12, tenureMonths: 12, method: 'flat' });
    // Flat: EMI = (P + P*r*n/12) / n
    expect(emi).toBeCloseTo(9333.33, 0);
  });
});
```

### Step 3 — Create test file for repayments

Create `lib/__tests__/repayments.test.ts`:

```typescript
import { generateAmortizationSchedule } from '@/lib/repayments';
// Adjust import path

describe('generateAmortizationSchedule', () => {
  const schedule = generateAmortizationSchedule({
    principal:     100_000,
    annualRate:    12,
    tenureMonths:  12,
    startDate:     new Date('2026-01-01'),
    method:        'reducing',
  });

  it('produces 12 instalments', () => {
    expect(schedule).toHaveLength(12);
  });

  it('sum of principal equals loan amount (±1 rupee rounding)', () => {
    const total = schedule.reduce((s, i) => s + i.principal, 0);
    expect(total).toBeCloseTo(100_000, -1);
  });

  it('opening balance of first = principal', () => {
    expect(schedule[0].openingBalance).toBeCloseTo(100_000, 0);
  });

  it('closing balance of last ≈ 0', () => {
    expect(schedule[schedule.length - 1].closingBalance).toBeCloseTo(0, -1);
  });

  it('each row: opening - principal = closing', () => {
    for (const row of schedule) {
      expect(row.openingBalance - row.principal).toBeCloseTo(row.closingBalance, -1);
    }
  });
});
```

### Step 4 — Check actual function signatures

Before writing tests, read the actual functions to match parameter names and return shapes:

```
cat lib/loanCalculator.ts
cat lib/repayments.ts
```

Adjust test assertions to match actual field names (e.g., `dueAmount` vs `emi`, `principalComponent` vs `principal`).

### Step 5 — Run tests

```
npm test
```

All tests must pass.

---

## Verification

- `npm test` → all tests pass
- Coverage: `npx jest --coverage` → `lib/loanCalculator.ts` and `lib/repayments.ts` show >80% line coverage
