
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.TenantScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.BranchScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  name: 'name',
  code: 'code',
  address: 'address',
  phone: 'phone',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppSettingScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  key: 'key',
  value: 'value',
  group: 'group',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  branchId: 'branchId',
  name: 'name',
  phone: 'phone',
  email: 'email',
  username: 'username',
  passwordHash: 'passwordHash',
  totpSecret: 'totpSecret',
  role: 'role',
  appType: 'appType',
  status: 'status',
  avatar: 'avatar',
  lastLoginAt: 'lastLoginAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.RouteScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  branchId: 'branchId',
  name: 'name',
  assignedAgentId: 'assignedAgentId',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  appType: 'appType'
};

exports.Prisma.CustomerScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  branchId: 'branchId',
  customerCode: 'customerCode',
  name: 'name',
  phone: 'phone',
  address: 'address',
  aadharNumber: 'aadharNumber',
  pan: 'pan',
  routeId: 'routeId',
  agentId: 'agentId',
  kycStatus: 'kycStatus',
  profilePhoto: 'profilePhoto',
  userId: 'userId',
  status: 'status',
  notes: 'notes',
  appType: 'appType',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.KycDocumentScalarFieldEnum = {
  id: 'id',
  customerId: 'customerId',
  docType: 'docType',
  fileName: 'fileName',
  filePath: 'filePath',
  fileSize: 'fileSize',
  uploadedAt: 'uploadedAt'
};

exports.Prisma.SecurityChequeScalarFieldEnum = {
  id: 'id',
  customerId: 'customerId',
  bankName: 'bankName',
  chequeNumber: 'chequeNumber',
  amount: 'amount',
  imagePath: 'imagePath',
  status: 'status',
  notes: 'notes',
  loanId: 'loanId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LoanPackageScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  name: 'name',
  principal: 'principal',
  deduction: 'deduction',
  deductionType: 'deductionType',
  frequency: 'frequency',
  tenure: 'tenure',
  perInstalment: 'perInstalment',
  penaltyRate: 'penaltyRate',
  appType: 'appType',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LoanScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  branchId: 'branchId',
  loanCode: 'loanCode',
  customerId: 'customerId',
  packageId: 'packageId',
  loanType: 'loanType',
  appType: 'appType',
  collateralDetails: 'collateralDetails',
  guarantorId: 'guarantorId',
  principal: 'principal',
  deduction: 'deduction',
  deductionType: 'deductionType',
  disbursed: 'disbursed',
  frequency: 'frequency',
  tenure: 'tenure',
  startDate: 'startDate',
  endDate: 'endDate',
  perInstalment: 'perInstalment',
  penaltyRate: 'penaltyRate',
  totalPayable: 'totalPayable',
  voucherRef: 'voucherRef',
  status: 'status',
  paidCount: 'paidCount',
  totalInstalments: 'totalInstalments',
  totalCollected: 'totalCollected',
  closedAt: 'closedAt',
  npaClassifiedAt: 'npaClassifiedAt',
  npaStatus: 'npaStatus',
  deletedAt: 'deletedAt',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InstalmentScalarFieldEnum = {
  id: 'id',
  loanId: 'loanId',
  instalmentNo: 'instalmentNo',
  dueDate: 'dueDate',
  dueAmount: 'dueAmount',
  receivedAmount: 'receivedAmount',
  paymentMode: 'paymentMode',
  status: 'status',
  receivedAt: 'receivedAt',
  agentId: 'agentId',
  remarks: 'remarks',
  lockedAt: 'lockedAt',
  penaltyApplied: 'penaltyApplied',
  collectionEntryId: 'collectionEntryId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PenaltyScalarFieldEnum = {
  id: 'id',
  loanId: 'loanId',
  customerId: 'customerId',
  missedDays: 'missedDays',
  grossPenalty: 'grossPenalty',
  settledAmount: 'settledAmount',
  waivedAmount: 'waivedAmount',
  status: 'status',
  settledById: 'settledById',
  settledAt: 'settledAt',
  instalmentId: 'instalmentId',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DailyCollectionScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  branchId: 'branchId',
  agentId: 'agentId',
  routeId: 'routeId',
  date: 'date',
  totalExpected: 'totalExpected',
  totalCollected: 'totalCollected',
  entriesCount: 'entriesCount',
  appType: 'appType',
  status: 'status',
  lockedAt: 'lockedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CollectionEntryScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  collectionId: 'collectionId',
  customerId: 'customerId',
  loanId: 'loanId',
  dueAmount: 'dueAmount',
  receivedAmount: 'receivedAmount',
  paymentMode: 'paymentMode',
  remarks: 'remarks',
  agentId: 'agentId',
  submittedAt: 'submittedAt',
  isLocked: 'isLocked'
};

exports.Prisma.SystemNotificationScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  appType: 'appType',
  type: 'type',
  icon: 'icon',
  title: 'title',
  message: 'message',
  link: 'link',
  isRead: 'isRead',
  readAt: 'readAt',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.NotificationTemplateScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  name: 'name',
  channel: 'channel',
  subject: 'subject',
  body: 'body',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  userId: 'userId',
  action: 'action',
  entityType: 'entityType',
  entityId: 'entityId',
  oldValue: 'oldValue',
  newValue: 'newValue',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt'
};

exports.Prisma.GuarantorScalarFieldEnum = {
  id: 'id',
  customerId: 'customerId',
  name: 'name',
  phone: 'phone',
  address: 'address',
  aadharNumber: 'aadharNumber',
  photo: 'photo',
  relation: 'relation',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LoanCollateralScalarFieldEnum = {
  id: 'id',
  loanId: 'loanId',
  docType: 'docType',
  fileName: 'fileName',
  filePath: 'filePath',
  fileSize: 'fileSize',
  description: 'description',
  uploadedAt: 'uploadedAt'
};

exports.Prisma.ApprovalRequestScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  appType: 'appType',
  requestType: 'requestType',
  entityType: 'entityType',
  entityId: 'entityId',
  requestedById: 'requestedById',
  requestedChanges: 'requestedChanges',
  reason: 'reason',
  status: 'status',
  reviewedById: 'reviewedById',
  reviewedAt: 'reviewedAt',
  reviewNotes: 'reviewNotes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RouteAgentScalarFieldEnum = {
  id: 'id',
  routeId: 'routeId',
  agentId: 'agentId',
  isPrimary: 'isPrimary',
  assignedAt: 'assignedAt'
};

exports.Prisma.VehicleScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  appType: 'appType',
  customerId: 'customerId',
  registrationNo: 'registrationNo',
  make: 'make',
  model: 'model',
  year: 'year',
  color: 'color',
  engineNo: 'engineNo',
  chassisNo: 'chassisNo',
  insuranceExpiry: 'insuranceExpiry',
  rcDocPath: 'rcDocPath',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  insurancePath: 'insurancePath',
  loanId: 'loanId',
  repoFlag: 'repoFlag',
  repoFlaggedAt: 'repoFlaggedAt',
  repoFlaggedById: 'repoFlaggedById',
  vehicleType: 'vehicleType',
  deletedAt: 'deletedAt'
};

exports.Prisma.ChitGroupScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  branchId: 'branchId',
  appType: 'appType',
  name: 'name',
  chitValue: 'chitValue',
  monthlyContrib: 'monthlyContrib',
  totalMembers: 'totalMembers',
  durationMonths: 'durationMonths',
  commissionPct: 'commissionPct',
  startDate: 'startDate',
  status: 'status',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ChitMemberScalarFieldEnum = {
  id: 'id',
  chitGroupId: 'chitGroupId',
  customerId: 'customerId',
  memberNumber: 'memberNumber',
  hasWon: 'hasWon',
  wonAt: 'wonAt',
  joinedAt: 'joinedAt'
};

exports.Prisma.ChitAuctionScalarFieldEnum = {
  id: 'id',
  chitGroupId: 'chitGroupId',
  periodNumber: 'periodNumber',
  auctionDate: 'auctionDate',
  winnerMemberId: 'winnerMemberId',
  prizeAmount: 'prizeAmount',
  bidDiscount: 'bidDiscount',
  commission: 'commission',
  dividend: 'dividend',
  status: 'status',
  createdAt: 'createdAt'
};

exports.Prisma.ChitSubscriptionScalarFieldEnum = {
  id: 'id',
  memberId: 'memberId',
  periodNumber: 'periodNumber',
  dueDate: 'dueDate',
  dueAmount: 'dueAmount',
  paidAmount: 'paidAmount',
  status: 'status',
  paidAt: 'paidAt'
};

exports.Prisma.TenantSubscriptionScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  plan: 'plan',
  status: 'status',
  maxActiveLoans: 'maxActiveLoans',
  maxAgents: 'maxAgents',
  enabledModules: 'enabledModules',
  trialEndsAt: 'trialEndsAt',
  currentPeriodEnd: 'currentPeriodEnd',
  razorpaySubId: 'razorpaySubId',
  gracePeriodEnd: 'gracePeriodEnd',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RateLimitScalarFieldEnum = {
  id: 'id',
  key: 'key',
  count: 'count',
  windowStart: 'windowStart',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WebhookEventScalarFieldEnum = {
  id: 'id',
  provider: 'provider',
  eventId: 'eventId',
  event: 'event',
  payload: 'payload',
  status: 'status',
  processedAt: 'processedAt',
  createdAt: 'createdAt'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  loanId: 'loanId',
  amount: 'amount',
  paymentMode: 'paymentMode',
  referenceNumber: 'referenceNumber',
  paymentDate: 'paymentDate',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentAllocationScalarFieldEnum = {
  id: 'id',
  paymentId: 'paymentId',
  instalmentId: 'instalmentId',
  amount: 'amount',
  createdAt: 'createdAt'
};

exports.Prisma.BillingInvoiceScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  subscriptionId: 'subscriptionId',
  amount: 'amount',
  tax: 'tax',
  total: 'total',
  status: 'status',
  dueDate: 'dueDate',
  paidAt: 'paidAt',
  razorpayId: 'razorpayId',
  invoiceUrl: 'invoiceUrl',
  billingPeriod: 'billingPeriod',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CronLockScalarFieldEnum = {
  id: 'id',
  lockedAt: 'lockedAt',
  expiresAt: 'expiresAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};


exports.Prisma.ModelName = {
  Tenant: 'Tenant',
  Branch: 'Branch',
  AppSetting: 'AppSetting',
  User: 'User',
  Route: 'Route',
  Customer: 'Customer',
  KycDocument: 'KycDocument',
  SecurityCheque: 'SecurityCheque',
  LoanPackage: 'LoanPackage',
  Loan: 'Loan',
  Instalment: 'Instalment',
  Penalty: 'Penalty',
  DailyCollection: 'DailyCollection',
  CollectionEntry: 'CollectionEntry',
  SystemNotification: 'SystemNotification',
  NotificationTemplate: 'NotificationTemplate',
  AuditLog: 'AuditLog',
  Guarantor: 'Guarantor',
  LoanCollateral: 'LoanCollateral',
  ApprovalRequest: 'ApprovalRequest',
  RouteAgent: 'RouteAgent',
  Vehicle: 'Vehicle',
  ChitGroup: 'ChitGroup',
  ChitMember: 'ChitMember',
  ChitAuction: 'ChitAuction',
  ChitSubscription: 'ChitSubscription',
  TenantSubscription: 'TenantSubscription',
  RateLimit: 'RateLimit',
  WebhookEvent: 'WebhookEvent',
  Payment: 'Payment',
  PaymentAllocation: 'PaymentAllocation',
  BillingInvoice: 'BillingInvoice',
  CronLock: 'CronLock'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
