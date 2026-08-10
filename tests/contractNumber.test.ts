import assert from 'node:assert/strict';
import { formatContractCode, nextContractCode } from '../lib/origination/contractNumber';

assert.equal(formatContractCode('HP', 1), 'HP00001');
assert.equal(formatContractCode('GL', 42, 6), 'GL000042');
assert.throws(() => formatContractCode('../HP', 1), /prefix/i);
assert.throws(() => formatContractCode('HP', 0), /sequence/i);

async function main() {
  let current = 0;
  const fakeTransaction = {
    contractSequence: {
      async upsert(args: any) {
        assert.deepEqual(args.where, {
          tenantId_appType_prefix: {
            tenantId: 'tenant-1',
            appType: 'autofinance',
            prefix: 'HP',
          },
        });
        current = current === 0 ? args.create.currentValue : current + args.update.currentValue.increment;
        return { currentValue: current };
      },
    },
  };

  assert.equal(
    await nextContractCode(fakeTransaction as any, {
      tenantId: 'tenant-1',
      appType: 'autofinance',
      prefix: 'HP',
    }),
    'HP00001',
  );
  assert.equal(
    await nextContractCode(fakeTransaction as any, {
      tenantId: 'tenant-1',
      appType: 'autofinance',
      prefix: 'HP',
    }),
    'HP00002',
  );

  console.log('contract number tests passed');
}

void main();
