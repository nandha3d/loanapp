import ExcelJS from 'exceljs';
import { type ReportPayload, getReportLabel } from './types';

export async function toWorkbook(p: ReportPayload, dict?: any): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const titleText = getReportLabel(p.title, dict);
  const sheetName = titleText.replace(/[\\\/\?\*\[\]]/g, '').slice(0, 31) || 'Report';
  const ws = wb.addWorksheet(sheetName);

  // 1. Add title and metadata header
  const titleRow = ws.addRow([titleText]);
  titleRow.font = { name: 'Arial', size: 16, bold: true };
  
  const fromTo = p.meta.from && p.meta.to ? `${p.meta.from} to ${p.meta.to}` : '';
  const metaRow = ws.addRow([
    `${p.meta.appName || ''} ${p.meta.branchName ? `(${p.meta.branchName})` : ''} ${fromTo}`.trim()
  ]);
  metaRow.font = { name: 'Arial', size: 10, italic: true, color: { argb: '55555555' } };
  
  ws.addRow([]); // Blank spacer

  // 2. Add header row
  const headerLabels = p.columns.map(col => getReportLabel(col.label, dict));
  const headerRow = ws.addRow(headerLabels);
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5A623' } // Gold brand color
    };
  });

  // Freeze panes so header is visible when scrolling
  ws.views = [{ state: 'frozen', ySplit: 4 }];

  // 3. Add rows
  p.rows.forEach((row) => {
    const rowData = p.columns.map(col => {
      const val = row[col.key];
      if (val === undefined || val === null) return '';
      if (val instanceof Date) return val.toISOString().slice(0, 10);
      return val;
    });

    const addedRow = ws.addRow(rowData);
    addedRow.font = { name: 'Arial', size: 10 };

    // Format individual cells based on column metadata
    p.columns.forEach((col, colIndex) => {
      const cell = addedRow.getCell(colIndex + 1);
      
      // Alignments
      if (col.align) {
        cell.alignment = { horizontal: col.align };
      }

      // Types & Formatting
      if (col.type === 'currency') {
        cell.numFmt = `"${p.meta.currencySymbol}"#,##0.00`;
      } else if (col.type === 'number') {
        cell.numFmt = '#,##0';
      } else if (col.type === 'percent') {
        cell.numFmt = '0.0%';
      }
    });
  });

  // 4. Add Totals row if provided
  if (p.totals) {
    const totalsData = p.columns.map((col, colIndex) => {
      if (colIndex === 0) return getReportLabel('reports.totals', dict) || 'TOTAL';
      if (col.total && p.totals && p.totals[col.key] !== undefined) {
        return p.totals[col.key];
      }
      return '';
    });

    const totalsRow = ws.addRow(totalsData);
    totalsRow.font = { name: 'Arial', size: 10, bold: true };
    
    p.columns.forEach((col, colIndex) => {
      const cell = totalsRow.getCell(colIndex + 1);
      
      // Double border bottom for accounting total representation
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'double' }
      };

      if (col.align) {
        cell.alignment = { horizontal: col.align };
      }

      if (col.type === 'currency') {
        cell.numFmt = `"${p.meta.currencySymbol}"#,##0.00`;
      } else if (col.type === 'number') {
        cell.numFmt = '#,##0';
      } else if (col.type === 'percent') {
        cell.numFmt = '0.0%';
      }
    });
  }

  // Auto-fit columns or use width hints
  p.columns.forEach((col, colIndex) => {
    const worksheetColumn = ws.getColumn(colIndex + 1);
    worksheetColumn.width = col.width ? col.width : 15;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
