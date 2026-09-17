import {
  assertAnyContains,
  assertContains,
  assertRoute,
  printSummary,
  runLiveChecks,
} from './newModulesApiHarness';

const chitsRoute = assertRoute('app/api/v1/chits/route.ts');
assertContains(chitsRoute, ['tenantId', 'appType'], 'chits list/create scope');
assertAnyContains(chitsRoute, ['POST', 'export async function POST'], 'chits create support');

const detailRoute = assertRoute('app/api/v1/chits/[id]/route.ts');
assertContains(detailRoute, ['tenantId', 'id'], 'chit detail tenant scope');

const membersRoute = assertRoute('app/api/v1/chits/[id]/members/route.ts');
assertAnyContains(membersRoute, ['member', 'members'], 'chit members route');

const auctionsRoute = assertRoute('app/api/v1/chits/[id]/auctions/route.ts');
assertAnyContains(auctionsRoute, ['auction', 'winner', 'bid'], 'chit auction route');

async function main() {
  const live = await runLiveChecks([{ name: 'chits', path: '/api/v1/chits' }]);

  printSummary('chitsApi', {
    checked: 4,
    live,
    status: 'Passed static chits API checks',
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
