import assert from 'node:assert/strict';

// Unit testing pure transition & validation logic for PEN-01
function computeNextSettledState(gross: number, currentSettled: number, currentWaived: number, amount: number) {
  const remaining = gross - currentSettled - currentWaived;
  if (amount <= 0 || amount > remaining) {
    throw new Error(`Invalid settle amount: must be > 0 and <= ${remaining}`);
  }
  const nextSettled = currentSettled + amount;
  const isFullySettled = (nextSettled + currentWaived) >= gross;
  const status = isFullySettled ? 'settled' : 'partial';
  return { nextSettled, status };
}

function computeNextWaivedState(gross: number, currentSettled: number, currentWaived: number, amount?: number) {
  const remaining = gross - currentSettled - currentWaived;
  const waiveAmt = amount !== undefined ? amount : remaining;
  if (waiveAmt <= 0 || waiveAmt > remaining) {
    throw new Error(`Invalid waive amount: must be > 0 and <= ${remaining}`);
  }
  const nextWaived = currentWaived + waiveAmt;
  const isFullyWaived = (currentSettled + nextWaived) >= gross;
  const status = isFullyWaived ? 'waived' : 'partial';
  return { nextWaived, status };
}

// 1. Partial settle
{
  const res = computeNextSettledState(500, 0, 0, 200);
  assert.equal(res.nextSettled, 200);
  assert.equal(res.status, 'partial');
}

// 2. Second settle completes full penalty
{
  const res = computeNextSettledState(500, 200, 0, 300);
  assert.equal(res.nextSettled, 500);
  assert.equal(res.status, 'settled');
}

// 3. Settle with existing waiver transitions to settled
{
  const res = computeNextSettledState(500, 200, 100, 200);
  assert.equal(res.nextSettled, 400);
  assert.equal(res.status, 'settled');
}

// 4. Over-settle throws error
{
  assert.throws(
    () => computeNextSettledState(500, 200, 100, 250),
    /Invalid settle amount/,
  );
}

// 5. Zero or negative settle throws error
{
  assert.throws(
    () => computeNextSettledState(500, 0, 0, 0),
    /Invalid settle amount/,
  );
  assert.throws(
    () => computeNextSettledState(500, 0, 0, -50),
    /Invalid settle amount/,
  );
}

// 6. Partial waiver
{
  const res = computeNextWaivedState(500, 200, 0, 150);
  assert.equal(res.nextWaived, 150);
  assert.equal(res.status, 'partial');
}

// 7. Full waiver of remaining
{
  const res = computeNextWaivedState(500, 200, 150);
  assert.equal(res.nextWaived, 300);
  assert.equal(res.status, 'waived');
}

// 8. PEN-03: Agent waiver request validation: requires non-empty reason and remaining > 0
function validateWaiverRequest(gross: number, settled: number, waived: number, reason: string) {
  if (!reason || !reason.trim()) {
    throw new Error('Reason is required for penalty waiver request');
  }
  const remaining = gross - settled - waived;
  if (remaining <= 0) {
    throw new Error('Penalty is already fully settled or waived');
  }
  return true;
}

{
  // Valid request
  assert.equal(validateWaiverRequest(500, 100, 0, 'Customer hardship'), true);

  // Missing reason throws
  assert.throws(
    () => validateWaiverRequest(500, 100, 0, ''),
    /Reason is required for penalty waiver request/,
  );
  assert.throws(
    () => validateWaiverRequest(500, 100, 0, '   '),
    /Reason is required for penalty waiver request/,
  );

  // Fully settled/waived throws
  assert.throws(
    () => validateWaiverRequest(500, 500, 0, 'Hardship'),
    /Penalty is already fully settled or waived/,
  );
  assert.throws(
    () => validateWaiverRequest(500, 200, 300, 'Hardship'),
    /Penalty is already fully settled or waived/,
  );
}

// 9. PEN-03: Approval execution by admin updates waivedAmount and transitions status
{
  const remainingBefore = 500 - 100 - 0;
  const requestedWaiver = 250;
  const res = computeNextWaivedState(500, 100, 0, requestedWaiver);
  assert.equal(res.nextWaived, 250);
  assert.equal(res.status, 'partial');

  // Approving full remaining waiver transitions to waived
  const fullRes = computeNextWaivedState(500, 100, 250, 150);
  assert.equal(fullRes.nextWaived, 400);
  assert.equal(fullRes.status, 'waived');
}

console.log('Penalty settlement, waiver, and approval request unit tests passed.');
