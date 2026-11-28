import ExcelJS from 'exceljs';

function styleHeaderRow(sheet: ExcelJS.Worksheet, rowNumber = 1, fillHex = '1E8449') {
  const row = sheet.getRow(rowNumber);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fillHex}` } };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 24;
}

export async function buildChitMembersTemplateXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ZoloFund';
  const sheet = wb.addWorksheet('Members_Import');
  sheet.columns = [
    { header: 'Full Name', key: 'fullName', width: 28 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Ticket No (Optional)', key: 'ticketNo', width: 20 },
    { header: 'Address (Optional)', key: 'address', width: 34 },
  ];
  styleHeaderRow(sheet);
  sheet.addRow({
    fullName: 'Anitha Venkatesh',
    phone: '9842211001',
    ticketNo: '1',
    address: 'Erode, TN',
  });
  sheet.addRow({
    fullName: 'Balaji Srinivasan',
    phone: '9842211002',
    ticketNo: '2',
    address: 'Salem, TN',
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildChitMembersTemplateCsv(): string {
  return [
    'Full Name,Phone,Ticket No (Optional),Address (Optional)',
    'Anitha Venkatesh,9842211001,1,"Erode, TN"',
    'Balaji Srinivasan,9842211002,2,"Salem, TN"',
  ].join('\n');
}

export async function buildRunningChitMigrationTemplateXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ZoloFund';
  const sheet = wb.addWorksheet('Running_Chit_Members');
  sheet.columns = [
    { header: 'Ticket No', key: 'ticketNo', width: 14 },
    { header: 'Full Name', key: 'fullName', width: 26 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Already Prized (YES/NO)', key: 'alreadyPrized', width: 22 },
    { header: 'Prized Cycle No', key: 'prizedCycleNumber', width: 18 },
    { header: 'Historical Prize Amount', key: 'historicalPrizeAmount', width: 22 },
    { header: 'Pending Prize Payout', key: 'historicalPayoutPendingAmount', width: 22 },
    { header: 'Opening Arrears', key: 'openingArrearsAmount', width: 18 },
    { header: 'Opening Advance', key: 'openingAdvanceAmount', width: 18 },
    { header: 'Nominee Name', key: 'nomineeName', width: 22 },
  ];
  styleHeaderRow(sheet);
  sheet.addRow({
    ticketNo: '1',
    fullName: 'Karthik Subramanian',
    phone: '9842211005',
    alreadyPrized: 'YES',
    prizedCycleNumber: 1,
    historicalPrizeAmount: 95000,
    historicalPayoutPendingAmount: 0,
    openingArrearsAmount: 0,
    openingAdvanceAmount: 0,
    nomineeName: 'Lakshmi K',
  });
  sheet.addRow({
    ticketNo: '2',
    fullName: 'Deepa Selvaraj',
    phone: '9842211006',
    alreadyPrized: 'NO',
    prizedCycleNumber: '',
    historicalPrizeAmount: '',
    historicalPayoutPendingAmount: 0,
    openingArrearsAmount: 5000,
    openingAdvanceAmount: 0,
    nomineeName: 'Selvaraj R',
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Public Lead-Magnet 5-tab Formula-Driven Chit Fund Tracker Workbook (.xlsx)
 * Compatible with Microsoft Excel & Google Sheets.
 */
export async function buildPublicChitTrackerWorkbookXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ZoloFund';
  wb.created = new Date();

  // Tab 1: Group_Setup
  const setup = wb.addWorksheet('1_Group_Setup');
  setup.columns = [
    { header: 'Parameter', key: 'param', width: 34 },
    { header: 'Value', key: 'value', width: 24 },
    { header: 'Notes', key: 'notes', width: 46 },
  ];
  styleHeaderRow(setup);
  setup.addRow({ param: 'Chit Group Name', value: 'ZoloFund Sample 1L Chit', notes: 'Edit group name here' });
  setup.addRow({ param: 'Gross Chit Value (Pot)', value: 100000, notes: 'Total pool value per cycle' });
  setup.addRow({ param: 'Total Members / Cycles', value: 20, notes: 'Number of subscriber tickets' });
  setup.addRow({ param: 'Foreman Commission (%)', value: 5, notes: 'Standard 5% foreman commission' });
  setup.addRow({
    param: 'Base Installment per Member',
    value: { formula: 'IF(B3>0, B2/B3, 0)' },
    notes: 'Auto-calculated (Chit Value / Members)',
  });
  setup.addRow({
    param: 'Foreman Commission Amount (per cycle)',
    value: { formula: 'B2*(B4/100)' },
    notes: 'Commission earned on each cycle',
  });

  // Tab 2: Members
  const members = wb.addWorksheet('2_Members');
  members.columns = [
    { header: 'Ticket No', key: 'ticketNo', width: 12 },
    { header: 'Subscriber Name', key: 'name', width: 28 },
    { header: 'Phone Number', key: 'phone', width: 18 },
    { header: 'Prized Cycle (if won)', key: 'wonCycle', width: 20 },
    { header: 'Nominee Name', key: 'nominee', width: 24 },
  ];
  styleHeaderRow(members);
  for (let i = 1; i <= 20; i++) {
    members.addRow({
      ticketNo: i,
      name: `Member ${i}`,
      phone: `98000000${String(i).padStart(2, '0')}`,
      wonCycle: i <= 2 ? i : '',
      nominee: `Nominee ${i}`,
    });
  }

  // Tab 3: Monthly_Auctions (formula-driven)
  const auctions = wb.addWorksheet('3_Monthly_Auctions');
  auctions.columns = [
    { header: 'Cycle', key: 'cycle', width: 10 },
    { header: 'Auction Date', key: 'date', width: 15 },
    { header: 'Winner Name', key: 'winner', width: 24 },
    { header: 'Bid Discount', key: 'discount', width: 16 },
    { header: 'Foreman Commission', key: 'commission', width: 20 },
    { header: 'Distributable Dividend', key: 'distDiv', width: 22 },
    { header: 'Dividend / Member', key: 'divPerMember', width: 20 },
    { header: 'Winner Net Prize', key: 'netPrize', width: 18 },
    { header: 'Net Installment Payable', key: 'netPayable', width: 22 },
  ];
  styleHeaderRow(auctions);
  for (let p = 1; p <= 20; p++) {
    const r = p + 1;
    auctions.addRow({
      cycle: p,
      date: '',
      winner: p === 1 ? 'Member 1' : p === 2 ? 'Member 2' : '',
      discount: p === 1 ? 5000 : p === 2 ? 25000 : 0,
      commission: { formula: `'1_Group_Setup'!$B$6` },
      distDiv: { formula: `MAX(0, D${r}-E${r})` },
      divPerMember: { formula: `IF('1_Group_Setup'!$B$3>0, FLOOR(F${r}/'1_Group_Setup'!$B$3, 1), 0)` },
      netPrize: { formula: `MAX(0, '1_Group_Setup'!$B$2-D${r})` },
      netPayable: { formula: `MAX(0, '1_Group_Setup'!$B$5-G${r})` },
    });
  }

  // Tab 4: Collection_Ledger
  const ledger = wb.addWorksheet('4_Collection_Ledger');
  ledger.columns = [
    { header: 'Receipt No', key: 'receiptNo', width: 16 },
    { header: 'Cycle', key: 'cycle', width: 10 },
    { header: 'Ticket No', key: 'ticketNo', width: 12 },
    { header: 'Subscriber Name', key: 'name', width: 26 },
    { header: 'Due Amount', key: 'due', width: 16 },
    { header: 'Paid Amount', key: 'paid', width: 16 },
    { header: 'Balance', key: 'balance', width: 16 },
    { header: 'Payment Mode', key: 'mode', width: 16 },
  ];
  styleHeaderRow(ledger);
  for (let i = 1; i <= 5; i++) {
    const r = i + 1;
    ledger.addRow({
      receiptNo: `RCP-00${i}`,
      cycle: 1,
      ticketNo: i,
      name: `Member ${i}`,
      due: { formula: `'3_Monthly_Auctions'!I2` },
      paid: { formula: `'3_Monthly_Auctions'!I2` },
      balance: { formula: `MAX(0, E${r}-F${r})` },
      mode: i % 2 === 0 ? 'UPI' : 'CASH',
    });
  }

  // Tab 5: Summary_Dashboard
  const summary = wb.addWorksheet('5_Summary_Dashboard');
  summary.columns = [
    { header: 'KPI Metric', key: 'metric', width: 38 },
    { header: 'Live Formula Value', key: 'value', width: 24 },
  ];
  styleHeaderRow(summary);
  summary.addRow({ metric: 'Total Pool Value', value: { formula: `'1_Group_Setup'!B2` } });
  summary.addRow({ metric: 'Total Enrolled Subscribers', value: { formula: `COUNTA('2_Members'!B2:B200)` } });
  summary.addRow({ metric: 'Total Auctions Completed', value: { formula: `COUNTIF('3_Monthly_Auctions'!D2:D21, ">0")` } });
  summary.addRow({ metric: 'Total Dividends Distributed', value: { formula: `SUM('3_Monthly_Auctions'!F2:F21)` } });
  summary.addRow({ metric: 'Total Collected in Ledger', value: { formula: `SUM('4_Collection_Ledger'!F2:F1000)` } });
  summary.addRow({ metric: 'Total Outstanding Balance (Defaulters)', value: { formula: `SUM('4_Collection_Ledger'!G2:G1000)` } });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
