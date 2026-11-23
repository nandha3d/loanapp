import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveChitTypeSettingsFromRaw,
  validateAndNormalizeChitTypeSettingsInput,
} from '../../lib/chits/settings';
import { DEFAULT_ENABLED_CHIT_ENGINE_TYPES, CHIT_ENGINE_TYPES } from '../../lib/chits/engineTypes';
import { getSettingsTabsForAppType } from '../../lib/moduleCapabilities';

// 1. STABLE-2: untouched tenant defaults strictly to the 3 legacy shipped types
{
  const untouched = resolveChitTypeSettingsFromRaw('', '');
  assert.deepEqual(untouched.enabledTypes, ['AUCTION_STANDARD', 'PURE_LOTTERY', 'FIXED_ROTATION']);
  assert.deepEqual(untouched.enabledTypes, [...DEFAULT_ENABLED_CHIT_ENGINE_TYPES]);
  assert.equal(Object.keys(untouched.typeDefaults).length, CHIT_ENGINE_TYPES.length);

  // Malformed or empty JSON safely falls back to STABLE-2 defaults
  const malformed = resolveChitTypeSettingsFromRaw('{bad-json', '{bad');
  assert.deepEqual(malformed.enabledTypes, ['AUCTION_STANDARD', 'PURE_LOTTERY', 'FIXED_ROTATION']);
  const emptyList = resolveChitTypeSettingsFromRaw('[]', '{}');
  assert.deepEqual(emptyList.enabledTypes, ['AUCTION_STANDARD', 'PURE_LOTTERY', 'FIXED_ROTATION']);
}

// 2. Enabling subsets + filtering unknown codes + per-type rule overrides
{
  const parsed = resolveChitTypeSettingsFromRaw(
    JSON.stringify(['AUCTION_STANDARD', 'AUCTION_MULTI_DIVISION', 'NON_EXISTENT', 'AUCTION_MULTI_DIVISION']),
    JSON.stringify({
      AUCTION_MULTI_DIVISION: {
        multiDivision: { enabled: true, lotteryWinnersPerCycle: 2, auctionWinnersPerCycle: 4 },
      },
    }),
  );
  assert.deepEqual(parsed.enabledTypes, ['AUCTION_STANDARD', 'AUCTION_MULTI_DIVISION']);
  assert.equal(parsed.typeDefaults.AUCTION_MULTI_DIVISION.multiDivision.lotteryWinnersPerCycle, 2);
  assert.equal(parsed.typeDefaults.AUCTION_MULTI_DIVISION.multiDivision.auctionWinnersPerCycle, 4);
}

// 3. Input validator rejects invalid configurations and empty enabled list
{
  assert.throws(() => validateAndNormalizeChitTypeSettingsInput({ enabledTypes: [] }));
  assert.throws(() => validateAndNormalizeChitTypeSettingsInput({ enabledTypes: ['UNKNOWN_ENGINE'] }));
  assert.throws(() =>
    validateAndNormalizeChitTypeSettingsInput({
      enabledTypes: ['AUCTION_STANDARD'],
      typeDefaults: {
        AUCTION_STANDARD: { discountRules: { minDiscountPct: 40, maxDiscountPct: 10, uncapped: false } },
      },
    }),
  );

  const valid = validateAndNormalizeChitTypeSettingsInput({
    enabledTypes: ['AUCTION_STANDARD', 'GOLD_WEIGHT_ACCUMULATION', 'ASCA_SHG_REVOLVING'],
    typeDefaults: {
      GOLD_WEIGHT_ACCUMULATION: { goldScheme: { defaultGoldRatePerGram: 8200, bonusMonths: 0, bonusPct: 0, makingChargeWaiverPct: 100, wastageWaiverPct: 100 } },
    },
  });
  assert.deepEqual(valid.enabledTypes, ['AUCTION_STANDARD', 'GOLD_WEIGHT_ACCUMULATION', 'ASCA_SHG_REVOLVING']);
  assert.equal(valid.typeDefaults.GOLD_WEIGHT_ACCUMULATION?.goldScheme?.defaultGoldRatePerGram, 8200);
}

// 4. Module capability tab scoping: chittypes visible ONLY for chitfunds
{
  const chitTabs = getSettingsTabsForAppType('chitfunds');
  assert.equal(chitTabs.includes('chittypes'), true, 'chitfunds must expose chittypes settings tab');
  for (const lendingApp of ['microlending', 'goldloan', 'autofinance', 'property', 'productfinance'] as const) {
    const tabs = getSettingsTabsForAppType(lendingApp);
    assert.equal(tabs.includes('chittypes'), false, `${lendingApp} must not expose chittypes settings tab`);
  }
}

// 5. Static contracts: assertChitEngineTypeEnabled enforced & SCOPE-17 preserved (no cross-module Loan access)
{
  const root = process.cwd();
  const actionsSrc = fs.readFileSync(
    path.join(root, 'app/(dashboard)/[module]/chits/actions.ts'),
    'utf8',
  );
  assert.equal(
    actionsSrc.includes('assertChitEngineTypeEnabled'),
    true,
    'createChitGroup server action must enforce assertChitEngineTypeEnabled',
  );

  const v1RouteSrc = fs.readFileSync(
    path.join(root, 'app/api/v1/chits/route.ts'),
    'utf8',
  );
  assert.equal(
    v1RouteSrc.includes('assertChitEngineTypeEnabled'),
    true,
    'POST /api/v1/chits must enforce assertChitEngineTypeEnabled',
  );

  const collectTsFiles = (dir: string): string[] => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return collectTsFiles(p);
      return p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : [];
    });
  };

  const chitFiles = [
    ...collectTsFiles(path.join(root, 'lib/chits')),
    ...collectTsFiles(path.join(root, 'app/api/v1/chits')),
  ];
  for (const file of chitFiles) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(
      /\bprisma\.loan\b|\btx\.loan\b/.test(text),
      false,
      `SCOPE-17 violation: cross-module loan query found in ${path.relative(root, file)}`,
    );
  }
}

console.log('chitSettingsAndLedger tests passed');
