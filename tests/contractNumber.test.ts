import assert from 'node:assert/strict';
import { formatContractCode, nextContractCode } from '../lib/origination/contractNumber';

assert.equal(formatContractCode('HP', 1), 'HP00001');
assert.equal(formatContractCode('GL', 42, 6), 'GL000042');
assert.throws(() => formatContractCode('../HP', 1), /prefix/i);
assert.throws(() => formatContractCode('HP', 0), /sequence/i);

/**
 * Fake transaction. `taken` is the set of loan codes that already exist, so a
 * test can reproduce a counter that has fallen behind the loans table.
 */
function fakeTx(startValue: number, taken: string[] = []) {
  const state = { value: startValue, updates: 0 };
  const tx = {
    contractSequence: {
      async upsert(args: any) {
        assert.deepEqual(
          args.where,
          { tenantId_prefix: { tenantId: 'tenant-1', prefix: 'HP' } },
          'counter must be keyed (tenantId, prefix) — no module axis (ORIG-1)',
        );
        assert.ok(
          !Object.prototype.hasOwnProperty.call(args.where.tenantId_prefix, 'appType'),
          'appType must never appear in the lookup key',
        );
        state.value = state.value === 0 ? args.create.currentValue : state.value + 1;
        return { currentValue: state.value };
      },
      async update(args: any) {
        state.value = args.data.currentValue;
        state.updates++;
        return { currentValue: state.value };
      },
    },
    loan: {
      async findFirst(args: any) {
        assert.equal(args.where.tenantId, 'tenant-1', 'collision check must be tenant-scoped');
        return taken.includes(args.where.loanCode) ? { id: 'existing' } : null;
      },
    },
  };
  return { tx, state };
}

async function main() {
  // Normal path: counter ahead of the data, codes come out sequentially.
  {
    const { tx } = fakeTx(0);
    assert.equal(await nextContractCode(tx as any, { tenantId: 'tenant-1', prefix: 'HP' }), 'HP00001');
    assert.equal(await nextContractCode(tx as any, { tenantId: 'tenant-1', prefix: 'HP' }), 'HP00002');
  }

  // appType is accepted but only ever stamped on creation, never keyed on.
  {
    const { tx } = fakeTx(0);
    assert.equal(
      await nextContractCode(tx as any, { tenantId: 'tenant-1', appType: 'autofinance', prefix: 'HP' }),
      'HP00001',
    );
  }

  // Self-healing (ORIG-2): the counter sits at 1 while HP00001..HP00003 already
  // exist — the exact production failure. It must step over them rather than
  // handing back a taken code, and park the counter at the truth.
  {
    const { tx, state } = fakeTx(0, ['HP00001', 'HP00002', 'HP00003']);
    assert.equal(await nextContractCode(tx as any, { tenantId: 'tenant-1', prefix: 'HP' }), 'HP00004');
    assert.equal(state.value, 4, 'counter must be parked past the drift, not left behind');
    assert.equal(state.updates, 1, 'catch-up should write the counter exactly once');
    // Next call continues cleanly from the repaired counter.
    assert.equal(await nextContractCode(tx as any, { tenantId: 'tenant-1', prefix: 'HP' }), 'HP00005');
  }

  // Runaway drift fails loudly instead of scanning a whole book of loans.
  {
    const everyCode = Array.from({ length: 1200 }, (_, i) => formatContractCode('HP', i + 1));
    const { tx } = fakeTx(0, everyCode);
    await assert.rejects(
      () => nextContractCode(tx as any, { tenantId: 'tenant-1', prefix: 'HP' }),
      /behind the loans already issued/,
    );
  }

  console.log('contract number tests passed');
}

void main();
