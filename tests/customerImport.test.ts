import assert from 'node:assert/strict';
import { assertCustomerImportScope, validateCustomerImportRow } from '../lib/imports/customers';

const actor = { tenantId: 'tenant-a', appType: 'microlending', branchId: 'branch-a',
  userId: 'admin-a', role: 'admin' };
assert.doesNotThrow(() => assertCustomerImportScope(actor));
assert.throws(() => assertCustomerImportScope({ ...actor, branchId: null }), /active branch/);
assert.throws(() => assertCustomerImportScope({ ...actor, role: 'agent' }), /Forbidden/);
assert.deepEqual(validateCustomerImportRow({ customerCode: 'C1', name: ' A ', phone: ' 9876543210 ',
  aadhaar: '123456789012' }), {
  customerCode: 'C1', name: 'A', phone: '9876543210', aadharNumber: '123456789012', pan: null,
});
for (const row of [null, [], {}, { name: 'A' }, { name: 'A', phone: 42 },
  { name: 'A', phone: '123', aadhaar: '123' }]) {
  assert.throws(() => validateCustomerImportRow(row));
}
console.log('Customer import scope and row validation passed');
