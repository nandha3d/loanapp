import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ── Mobile API routes must never leak pending_review loans (MONEY-8) ────────
// Rule MONEY-8 mandates that pending_review loans disburse nothing and take no
// collections. Their pre-generated instalments must be excluded from today's
// dues, overdue lists, and dashboard metrics.

const root = path.resolve(__dirname, '..');

function read(relPath: string): string {
  return readFileSync(path.join(root, relPath), 'utf8');
}

// 1. /api/v1/collection/today/route.ts
{
  const src = read('app/api/v1/collection/today/route.ts');
  assert.ok(
    src.includes('COLLECTIBLE_LOAN_STATUSES'),
    'collection/today must import and use COLLECTIBLE_LOAN_STATUSES',
  );
  assert.match(
    src,
    /status:\s*\{\s*in:\s*\[\.\.\.COLLECTIBLE_LOAN_STATUSES\]\s*\}/,
    'collection/today must restrict loanWhere to COLLECTIBLE_LOAN_STATUSES',
  );
}

// 2. /api/v1/dashboard/route.ts
{
  const src = read('app/api/v1/dashboard/route.ts');
  // todayInstalments
  assert.match(
    src,
    /where:\s*\{\s*loan:\s*\{\s*\.\.\.baseLoan,\s*status:\s*\{\s*in:\s*\['active',\s*'overdue'\]\s*\}\s*\},\s*dueDate:/,
    'dashboard route todayInstalments must filter loan status to active/overdue',
  );
  // pendingPenalties
  assert.match(
    src,
    /where:\s*\{\s*loan:\s*\{\s*\.\.\.baseLoan,\s*status:\s*\{\s*in:\s*\['active',\s*'overdue'\]\s*\}\s*\},\s*status:\s*'pending'/,
    'dashboard route pendingPenalties must filter loan status to active/overdue',
  );
  // overdueDefaulterRows
  assert.match(
    src,
    /where:\s*\{\s*loan:\s*\{\s*\.\.\.baseLoan,\s*status:\s*\{\s*in:\s*\['active',\s*'overdue'\]\s*\}\s*\},\s*dueDate:\s*\{\s*lt:\s*today\s*\}/,
    'dashboard route overdueDefaulterRows must filter loan status to active/overdue',
  );
  // totalLoansAgg
  assert.match(
    src,
    /where:\s*\{\s*\.\.\.baseLoan,\s*status:\s*\{\s*in:\s*\['active',\s*'overdue',\s*'closed',\s*'settled'\]\s*\}\s*\}/,
    'dashboard route totalLoansAgg must exclude pending_review loans',
  );
}

// 3. /api/v1/analytics/summary/route.ts
{
  const src = read('app/api/v1/analytics/summary/route.ts');
  assert.match(
    src,
    /where:\s*\{\s*loan:\s*\{\s*\.\.\.loanBase,\s*status:\s*\{\s*in:\s*\['active',\s*'overdue',\s*'closed'\]\s*\}\s*\},\s*dueDate:/,
    'analytics summary route instalments must filter loan status',
  );
}

console.log('✓ All mobile pending_review loan exclusion assertions passed.');
