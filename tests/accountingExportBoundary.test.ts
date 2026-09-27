import assert from 'node:assert/strict';
import { assertTallyVoucherLimit, TallyExportLimitError } from '../lib/accounting/tallyExport';
import { dateRange, parseTallyConnectorUrl } from '../lib/accounting/exportService';

assert.doesNotThrow(() => assertTallyVoucherLimit(50000, 50000));
assert.throws(() => assertTallyVoucherLimit(50001, 50000), TallyExportLimitError);
assert.equal(parseTallyConnectorUrl('http://localhost:9000'), 'http://localhost:9000/');
for (const url of ['bad url', 'ftp://example.com', 'http://user:pass@example.com']) {
  assert.throws(() => parseTallyConnectorUrl(url), /Invalid Tally connector URL/);
}
assert.equal(dateRange('2026-02-01', '2026-02-28').start.getDate(), 1);
for (const [from, to] of [['2026-02-31', '2026-03-01'], ['2026-03-10', '2026-03-09']]) {
  assert.throws(() => dateRange(from, to), /Invalid date range/);
}
console.log('Accounting export boundaries passed');
