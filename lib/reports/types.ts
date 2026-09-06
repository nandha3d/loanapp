export type ReportColumn = {
  key: string;                 // row field name
  label: string;               // i18n key, e.g. 'reports.col.loanCode'
  align?: 'left' | 'right' | 'center';
  type?: 'text' | 'number' | 'currency' | 'date' | 'percent' | 'badge';
  total?: boolean;             // include in footer total row (numbers/currency only)
  width?: number;              // PDF/Excel column width hint
};

export type ReportPayload = {
  title: string;               // i18n key
  columns: ReportColumn[];
  rows: Record<string, any>[];
  totals?: Record<string, number>;   // server-computed footer
  kpis?: { label: string; value: string | number; tone?: 'good'|'warn'|'bad' }[];
  meta: { from?: string; to?: string; branchName?: string; appName?: string; currencySymbol: string };
};

export interface ReportBuilderParams {
  tenantId: string;
  appType: string;
  from: string;
  to: string;
  routeId?: string;
  agentId?: string;
  branchId?: string | null;
  customerId?: string;
  loanType?: string;
  status?: string;
  frequency?: string;
  minAmount?: number;
  maxAmount?: number;
  paymentMode?: string;
  paymentStatus?: string;
  loanId?: string;
  groupId?: string; // chit group scoping (chit-cash-flow, chit-group-portfolio, etc.)
}

export function getReportLabel(key: string, dict?: any): string {
  if (!key) return '';

  // 1. Try dot lookup in dict
  if (dict) {
    const parts = key.split('.');
    let curr = dict;
    for (const p of parts) {
      if (!curr) { curr = null; break; }
      curr = curr[p];
    }
    if (typeof curr === 'string' && curr !== key) {
      return curr;
    }
  }

  // 2. Direct map check in dict
  if (dict?.reports?.col?.[key]) return dict.reports.col[key];
  if (dict?.reports?.kpi?.[key]) return dict.reports.kpi[key];
  if (dict?.reports?.title?.[key]) return dict.reports.title[key];

  // 3. Clean up raw keys
  let cleanKey = key
    .replace(/^reports\.col\.+/, '')
    .replace(/^reports\.kpi\.+/, '')
    .replace(/^reports\.[a-zA-Z0-9_-]+\.title$/, (match) => match.replace(/^reports\./, '').replace(/\.title$/, ''))
    .replace(/^reports\./, '');

  const knownLabels: Record<string, string> = {
    agent: 'Agent',
    agentName: 'Agent Name',
    date: 'Date',
    branch: 'Branch',
    branchName: 'Branch Name',
    lastSeen: 'Last Seen',
    daysSince: 'Days Since Last Seen',
    loansAssigned: 'Loans Assigned',
    collections: 'Collections',
    pending: 'Pending',
    recovery: 'Recovery %',
    visits: 'Visits',
    attendance: 'Attendance',
    distance: 'Distance',
    missedToday: 'Missed Today',
    noActivity3d: 'No Activity (3d)',
    coveragePct: 'Coverage %',
    loanCode: 'Loan Code',
    customer: 'Customer',
    customerName: 'Customer Name',
    loanType: 'Loan Type',
    principal: 'Principal',
    interest: 'Interest',
    totalPayable: 'Total Payable',
    frequency: 'Frequency',
    startDate: 'Start Date',
    endDate: 'End Date',
    outstanding: 'Outstanding',
    status: 'Status',
    time: 'Time',
    user: 'User',
    action: 'Action',
    entity: 'Entity',
    entityRef: 'Entity ID',
    change: 'Change Details',
    ip: 'IP Address',
    mode: 'Mode',
    type: 'Type',
    amount: 'Amount',
    loanNo: 'Loan No',
    instalmentNo: 'Instalment #',
    dueDate: 'Due Date',
    paidDate: 'Paid Date',
    delay: 'Delay (Days)',
    due: 'Due Amount',
    paid: 'Paid Amount',
    penalty: 'Penalty',
    balance: 'Balance',
    group: 'Group / Line',
    expected: 'Expected',
    collected: 'Collected',
    efficiency: 'Efficiency',
    topPerformer: 'Top Performer',
    avgRecoveryRate: 'Avg Recovery Rate',
    totalVisits: 'Total Visits',
    totalDistanceKm: 'Total Distance',
    totalLoans: 'Total Loans',
    totalPrincipal: 'Total Principal',
    totalOutstanding: 'Total Outstanding',
    activeLoans: 'Active Loans',
    totalInstalments: 'Total Instalments',
    paidInstalments: 'Paid Instalments',
    missedInstalments: 'Missed Instalments',
    totalPenaltyApplied: 'Total Penalty Applied',
    overallEfficiency: 'Overall Efficiency',
    totalExpected: 'Total Expected',
    totalCollected: 'Total Collected',
    totalPending: 'Total Pending',
    transactionCount: 'Total Transactions',
    totalPaymentsReceived: 'Total Payments Received',
    totalEvents: 'Total Events',
    editsCount: 'Edits Count',
    deletesCount: 'Deletes Count',
    distinctUsers: 'Active Users',
  };

  if (knownLabels[cleanKey]) {
    return knownLabels[cleanKey];
  }

  return cleanKey
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}
