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

console.log('Penalty settlement and waiver state transition unit tests passed.');
