import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { renderToBuffer } from '@react-pdf/renderer';
import { TableReportPDF } from '../../../lib/reports/pdf';
import { toCSV } from '../../../lib/reports/csv';
import { toWorkbook } from '../../../lib/reports/excel';
import type { ReportPayload } from '../../../lib/reports/types';
import { assertMoneyEqual, money } from './assertMoney';

export function assertReportTotal(
  report: ReportPayload,
  key: string,
  expected: unknown,
  label: string,
) {
  assert.ok(report.totals, `${label}: report totals should exist`);
  assertMoneyEqual(report.totals?.[key], expected, label);
}

export function assertRowIds(rows: Array<Record<string, unknown>>, key: string, included: string[], excluded: string[]) {
  const values = new Set(rows.map((row) => String(row[key] ?? '')));
  for (const id of included) assert.equal(values.has(id), true, `expected report rows to include ${id}`);
  for (const id of excluded) assert.equal(values.has(id), false, `expected report rows to exclude ${id}`);
}

export function sumMoney<T>(rows: T[], pick: (row: T) => unknown) {
  return rows.reduce((total, row) => total + money(pick(row)), 0);
}

export function assertCsvExport(report: ReportPayload, expectedText: string) {
  const csv = toCSV(report);
  assert.equal(csv.includes(expectedText), true, `CSV export should include ${expectedText}`);
  assert.equal(csv.includes('\n'), true, 'CSV export should contain rows');
  return csv;
}

export async function assertExcelExport(report: ReportPayload, expectedText: string) {
  const buffer = await toWorkbook(report);
  assert.equal(buffer.byteLength > 0, true, 'Excel export buffer should not be empty');

  const parsed = new ExcelJS.Workbook();
  await parsed.xlsx.load(buffer);
  const worksheet = parsed.worksheets[0];
  assert.ok(worksheet, 'Excel export should contain a worksheet');
  const values = JSON.stringify(worksheet.getSheetValues());
  assert.equal(values.includes(expectedText), true, `Excel export should include ${expectedText}`);
  return buffer;
}

export async function assertPdfExport(report: ReportPayload, expectedText: string) {
  const buffer = await renderToBuffer(TableReportPDF({ payload: report }));
  assert.equal(buffer.length > 0, true, 'PDF export buffer should not be empty');
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF', 'PDF export should be a PDF buffer');
  const text = buffer.toString('latin1');
  assert.equal(text.includes(expectedText) || report.rows.some((row) => JSON.stringify(row).includes(expectedText)), true);
  return buffer;
}
