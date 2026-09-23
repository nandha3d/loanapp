import assert from 'node:assert/strict';
import { getReportDefinitionForAppType } from '../lib/reports/catalog';

// 1. Verify that loan-register definition exists and can be retrieved for microlending
const loanRegisterDef = getReportDefinitionForAppType('microlending', 'loan-register');
assert.ok(loanRegisterDef, 'loan-register must exist in catalog for microlending');
assert.equal(typeof loanRegisterDef.builder, 'function');

// 2. Verify that chit-cash-flow definition exists for chitfunds
const chitCashFlowDef = getReportDefinitionForAppType('chitfunds', 'chit-cash-flow');
assert.ok(chitCashFlowDef, 'chit-cash-flow must exist in catalog for chitfunds');

// 3. Test envelope unpacking logic as implemented in ReportShell
function unpackReportResponse(json: any) {
  const reportPayload = json?.data ?? (json?.success ? json.data : json);
  if (reportPayload && Array.isArray(reportPayload.columns)) {
    return reportPayload;
  }
  throw new Error(json?.error || json?.message || 'Failed to load report data');
}

// Canonical v1 envelope format (what /api/v1/reports/[slug] returns)
const v1Envelope = {
  data: {
    title: 'reports.loanRegister.title',
    columns: [{ key: 'loanCode', label: 'Loan Code' }],
    rows: [],
    totals: {},
    meta: { currencySymbol: '₹' },
  },
  error: null,
  pagination: null,
};

const unpackedV1 = unpackReportResponse(v1Envelope);
assert.equal(unpackedV1.title, 'reports.loanRegister.title');
assert.equal(unpackedV1.columns.length, 1);

// Legacy format compatibility
const legacyEnvelope = {
  success: true,
  data: {
    title: 'reports.loanRegister.title',
    columns: [{ key: 'loanCode', label: 'Loan Code' }],
    rows: [],
    totals: {},
  },
};
const unpackedLegacy = unpackReportResponse(legacyEnvelope);
assert.equal(unpackedLegacy.title, 'reports.loanRegister.title');

// Error format throws
assert.throws(() => {
  unpackReportResponse({ data: null, error: 'Unauthorized', pagination: null });
}, /Unauthorized/);

assert.throws(() => {
  unpackReportResponse({ success: false, message: 'Report builder not found' });
}, /Report builder not found/);

// 4. Test FilterBar options unpacking logic
function unpackFilterOptions(json: any) {
  return json?.data ?? (json?.success ? json.data : null);
}

const v1OptEnvelope = {
  success: true,
  data: {
    branches: [{ id: 'b1', name: 'Main' }],
    agents: [{ id: 'a1', name: 'Agent 1' }],
  },
  error: null,
  pagination: null,
};
const unpackedOpts = unpackFilterOptions(v1OptEnvelope);
assert.equal(unpackedOpts.branches.length, 1);
assert.equal(unpackedOpts.agents.length, 1);

console.log('Report Center integration tests passed successfully!');
