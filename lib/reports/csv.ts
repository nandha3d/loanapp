import { type ReportPayload, getReportLabel } from './types';

export function toCSV(p: ReportPayload, dict?: any): string {
  // 1. Build Header Row
  const headers = p.columns.map(col => {
    const rawLabel = getReportLabel(col.label, dict);
    return `"${rawLabel.replace(/"/g, '""')}"`;
  }).join(',');

  // 2. Build Data Rows
  const rows = p.rows.map(row => {
    return p.columns.map(col => {
      let val = row[col.key];
      if (val === undefined || val === null) {
        val = '';
      } else if (val instanceof Date) {
        val = val.toISOString().slice(0, 10);
      } else if (typeof val === 'object') {
        val = JSON.stringify(val);
      } else {
        val = String(val);
      }
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',');
  });

  // 3. Build Totals Row (optional)
  let totalsRow = '';
  if (p.totals) {
    totalsRow = '\n' + p.columns.map((col, index) => {
      if (index === 0) {
        return `"${getReportLabel('reports.totals', dict) || 'TOTAL'}"`;
      }
      if (col.total && p.totals && p.totals[col.key] !== undefined) {
        return `"${p.totals[col.key]}"`;
      }
      return '""';
    }).join(',');
  }

  return headers + '\n' + rows.join('\n') + totalsRow;
}
