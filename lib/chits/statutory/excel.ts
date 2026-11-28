import ExcelJS from 'exceljs';
import type { StatutoryRegisterDataset } from './builder';

export async function buildStatutoryRegisterExcel(data: StatutoryRegisterDataset): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ZoloFund';
  const sheet = wb.addWorksheet(data.meta.registerType.slice(0, 28));

  sheet.addRow([`${data.meta.stateName} · ${data.meta.statuteTitle} · ${data.meta.formCode}`]).font = {
    bold: true,
    size: 11,
  };
  sheet.addRow([data.meta.title]).font = { bold: true, size: 13 };
  sheet.addRow([
    `Group: ${data.groupSummary.groupName} (${data.groupSummary.groupCode})`,
    `Pot: ${data.groupSummary.chitValueFormatted}`,
    `Reg No: ${data.groupSummary.chitRegistrationNumber}`,
    `Foreman: ${data.groupSummary.foremanName}`,
  ]);
  sheet.addRow([]);

  const headerRow = sheet.addRow(data.columns.map((c) => c.label));
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  headerRow.height = 22;

  for (const row of data.rows) {
    sheet.addRow(data.columns.map((c) => row[c.key] ?? ''));
  }

  sheet.addRow([]);
  for (const t of data.totals) {
    sheet.addRow([t.label, t.value]).font = { bold: true };
  }

  sheet.addRow([]);
  sheet.addRow([data.disclaimer]).font = { italic: true, size: 9 };

  sheet.columns.forEach((col) => {
    col.width = 22;
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
