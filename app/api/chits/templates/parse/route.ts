import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getWebChitScope, canAdminChits, assertChitCapability } from '@/lib/chits/access';
import { normalizeIndianPhone } from '@/lib/chits/quickAddMembers';

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCsvText(csv: string): string[][] {
  return csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(splitCsvLine);
}

function cellStr(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'object' && 'result' in val) {
    return String((val as { result?: unknown }).result ?? '').trim();
  }
  if (typeof val === 'object' && 'text' in val) {
    return String((val as { text?: unknown }).text ?? '').trim();
  }
  return String(val).trim();
}

function cellNum(val: unknown): number {
  const n = Number(String(cellStr(val)).replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: NextRequest) {
  try {
    const scope = await getWebChitScope();
    assertChitCapability(canAdminChits(scope.role, scope.staffPermissions));

    const fd = await req.formData();
    const file = fd.get('file');
    const kind = String(fd.get('kind') ?? 'members');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Missing spreadsheet file' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    let tableRows: unknown[][] = [];

    if (fileName.endsWith('.csv') || file.type.includes('csv') || file.type === 'text/plain') {
      const text = await file.text();
      tableRows = parseCsvText(text);
    } else {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const sheet = wb.worksheets[0];
      if (!sheet) {
        return NextResponse.json({ ok: false, error: 'Workbook has no worksheets' }, { status: 400 });
      }
      sheet.eachRow((row) => {
        const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
        if (vals.some((v) => cellStr(v) !== '')) {
          tableRows.push(vals);
        }
      });
    }

    if (tableRows.length < 2) {
      return NextResponse.json({ ok: false, error: 'Spreadsheet has no data rows beneath header' }, { status: 400 });
    }

    const headers = tableRows[0].map((h) => cellStr(h).toLowerCase());
    const colIndex = (candidates: string[], fallbackIdx: number) => {
      const idx = headers.findIndex((h) => candidates.some((c) => h.includes(c)));
      return idx >= 0 ? idx : fallbackIdx;
    };

    if (kind === 'migration') {
      const iTicket = colIndex(['ticket'], 0);
      const iName = colIndex(['full name', 'name'], 1);
      const iPhone = colIndex(['phone', 'mobile'], 2);
      const iPrized = colIndex(['already prized', 'prized ('], 3);
      const iPrizedCycle = colIndex(['prized cycle'], 4);
      const iHistPrize = colIndex(['historical prize'], 5);
      const iPendPayout = colIndex(['pending prize'], 6);
      const iArrears = colIndex(['arrears'], 7);
      const iAdvance = colIndex(['advance'], 8);
      const iNominee = colIndex(['nominee'], 9);

      const members = tableRows
        .slice(1)
        .map((r) => {
          const name = cellStr(r[iName]);
          const phoneRaw = cellStr(r[iPhone]);
          if (!name && !phoneRaw) return null;
          const prizedStr = cellStr(r[iPrized]).toLowerCase();
          const alreadyPrized = ['yes', 'y', 'true', '1'].includes(prizedStr);
          const prizedCycleNum = cellNum(r[iPrizedCycle]);
          return {
            ticketNumber: cellStr(r[iTicket]) || undefined,
            name,
            phone: normalizeIndianPhone(phoneRaw) ?? phoneRaw,
            alreadyPrized,
            prizedCycleNumber: alreadyPrized && prizedCycleNum > 0 ? Math.trunc(prizedCycleNum) : null,
            historicalPrizeAmount: alreadyPrized && cellNum(r[iHistPrize]) > 0 ? cellNum(r[iHistPrize]) : null,
            historicalPayoutPendingAmount: cellNum(r[iPendPayout]),
            openingArrearsAmount: cellNum(r[iArrears]),
            openingAdvanceAmount: cellNum(r[iAdvance]),
            nomineeName: cellStr(r[iNominee]) || null,
          };
        })
        .filter(Boolean);

      return NextResponse.json({ ok: true, kind, rows: members });
    }

    const iName = colIndex(['full name', 'name'], 0);
    const iPhone = colIndex(['phone', 'mobile'], 1);
    const iTicket = colIndex(['ticket'], 2);
    const iAddress = colIndex(['address'], 3);

    const members = tableRows
      .slice(1)
      .map((r) => {
        const name = cellStr(r[iName]);
        const phoneRaw = cellStr(r[iPhone]);
        if (!name && !phoneRaw) return null;
        return {
          name,
          phone: normalizeIndianPhone(phoneRaw) ?? phoneRaw,
          ticketNo: cellStr(r[iTicket]) || undefined,
          address: cellStr(r[iAddress]) || undefined,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ ok: true, kind: 'members', rows: members });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to parse spreadsheet';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 },
    );
  }
}
