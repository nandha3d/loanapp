import assert from 'node:assert/strict';
import path from 'node:path';
import {
  buildUploadFileName,
  resolveTenantUploadPath,
  uploadExtensionForMime,
} from '../lib/fileUpload';

assert.equal(uploadExtensionForMime('image/jpeg'), '.jpg');
assert.equal(uploadExtensionForMime('application/pdf'), '.pdf');
assert.equal(uploadExtensionForMime('audio/webm'), '.webm');
assert.throws(() => uploadExtensionForMime('application/javascript'), /not allowed/i);

assert.equal(
  buildUploadFileName('application/pdf', { id: 'fixed-id', prefix: 'assay' }),
  'assay_fixed-id.pdf',
);
assert.throws(
  () => buildUploadFileName('image/png', { id: '../escape' }),
  /invalid upload/i,
);

const baseDir = path.resolve('private-test-uploads');
const resolved = resolveTenantUploadPath({
  baseDir,
  tenantId: 'tenant_123',
  scopes: ['gold', 'packets'],
  fileName: 'assay_fixed-id.pdf',
});
assert.equal(
  resolved,
  path.join(baseDir, 'tenant_123', 'gold', 'packets', 'assay_fixed-id.pdf'),
);
assert.throws(
  () => resolveTenantUploadPath({ baseDir, tenantId: '../other', fileName: 'proof.pdf' }),
  /invalid upload/i,
);
assert.throws(
  () => resolveTenantUploadPath({ baseDir, tenantId: 'tenant_123', fileName: '../proof.pdf' }),
  /invalid upload/i,
);
assert.throws(
  () => resolveTenantUploadPath({ baseDir, tenantId: 'tenant_123', scopes: ['gold/../../other'], fileName: 'proof.pdf' }),
  /invalid upload/i,
);

console.log('file upload safety tests passed');
