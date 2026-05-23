import prisma from '@/lib/db';
import { encryptField, decryptField, decryptAadharNumber } from '@/lib/pii';
import { CRIFClient } from './providers/crif';
import { CIBILClient } from './providers/cibil';
import { getOrCreateAgent } from './certLoader';
import { SocksProxyAgent } from 'socks-proxy-agent';
import type { BureauQueryInput } from './providers/crif';

export type BureauProvider = 'CRIF' | 'CIBIL';
export type PullType = 'hard' | 'soft';

export interface BureauPullInput {
  customerId: string;
  tenantId: string;
  loanId?: string | null;
  pullType: PullType;
  provider?: BureauProvider;
  consentObtained: boolean;
  consentMethod: 'written' | 'verbal_recorded' | 'digital_otp';
  requestedByUserId: string;
  requestIp: string;
}

export interface BureauSummary {
  reportId: string;
  status: 'success' | 'no_match' | 'error';
  bureauProvider: string;
  creditScore: number | null;
  scoreModel: string | null;
  scoreLabel: string | null; // "Excellent" | "Good" | "Fair" | "Poor" | "NH" | "NA"
  totalAccounts: number;
  activeAccounts: number;
  overdueAccounts: number;
  totalOverdueAmt: number;
  enquiryCount90d: number;
  activeMFILoans: number;
  activeMFILoanAmt: number;
  writtenOffAccounts: number;
  suitFiledAccounts: number;
  validUntil: Date;
  fromCache: boolean;
  source: 'tenant' | 'platform_default';
}

/**
 * Validates subscription and resolves credentials for a tenant.
 * Falls back to platform default sandbox credentials in non-production environments if none configured.
 */
export async function resolveBureauCredentials(tenantId: string) {
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { bureauEnabled: true }
  });

  if (!subscription || !subscription.bureauEnabled) {
    throw new Error('MODULE_NOT_ENABLED');
  }

  // 1. Try tenant-specific credentials
  const tenantCred = await prisma.bureauCredential.findFirst({
    where: { tenantId, isActive: true }
  });

  if (tenantCred) {
    return {
      provider: tenantCred.provider as BureauProvider,
      memberId: decryptField(tenantCred.memberId) || '',
      apiKey: decryptField(tenantCred.apiKey) || '',
      apiSecret: tenantCred.apiSecret ? (decryptField(tenantCred.apiSecret) || '') : '',
      bureauCert: tenantCred.bureauCert, // Keep encrypted for the loader
      bureauKey: tenantCred.bureauKey,   // Keep encrypted for the loader
      environment: tenantCred.environment,
      source: 'tenant' as const,
    };
  }

  // 2. Fall back to developer platform sandbox credentials in non-production environments
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev && process.env.BUREAU_SANDBOX_MEMBER_ID) {
    return {
      provider: 'CRIF' as BureauProvider,
      memberId: process.env.BUREAU_SANDBOX_MEMBER_ID,
      apiKey: process.env.BUREAU_SANDBOX_API_KEY || '',
      apiSecret: process.env.BUREAU_SANDBOX_API_SECRET || '',
      bureauCert: null,
      bureauKey: null,
      environment: 'sandbox',
      source: 'platform_default' as const,
    };
  }

  throw new Error('CREDENTIALS_REQUIRED: Please configure your credit bureau credentials in settings.');
}

/**
 * Checks subscription limits and deducts a pull from quota.
 */
async function checkAndDeductQuota(tenantId: string): Promise<void> {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId }
  });

  if (!sub || !sub.bureauEnabled) {
    throw new Error('MODULE_NOT_ENABLED');
  }

  if (sub.bureauPullsUsed >= sub.bureauPullsIncluded) {
    throw new Error('QUOTA_EXCEEDED: Monthly credit bureau pull quota has been reached.');
  }

  await prisma.tenantSubscription.update({
    where: { tenantId },
    data: { bureauPullsUsed: { increment: 1 } }
  });
}

function getScoreLabel(score: number | null, provider: string): string {
  if (!score) return 'NH'; // No History
  if (provider === 'CRIF') {
    if (score >= 750) return 'Excellent';
    if (score >= 650) return 'Good';
    if (score >= 500) return 'Fair';
    return 'Poor';
  }
  // CIBIL Scale
  if (score >= 750) return 'Excellent';
  if (score >= 650) return 'Good';
  if (score >= 550) return 'Fair';
  if (score >= 350) return 'Poor';
  return 'NA';
}

function mapSummary(report: any, fromCache: boolean, source: 'tenant' | 'platform_default'): BureauSummary {
  return {
    reportId: report.id,
    status: report.status as 'success' | 'no_match' | 'error',
    bureauProvider: report.bureauProvider,
    creditScore: report.creditScore,
    scoreModel: report.scoreModel,
    scoreLabel: getScoreLabel(report.creditScore, report.bureauProvider),
    totalAccounts: report.totalAccounts || 0,
    activeAccounts: report.activeAccounts || 0,
    overdueAccounts: report.overdueAccounts || 0,
    totalOverdueAmt: report.totalOverdueAmt ? Number(report.totalOverdueAmt) : 0,
    enquiryCount90d: report.enquiryCount90d || 0,
    activeMFILoans: report.activeMFILoans || 0,
    activeMFILoanAmt: report.activeMFILoanAmt ? Number(report.activeMFILoanAmt) : 0,
    writtenOffAccounts: report.writtenOffAccounts || 0,
    suitFiledAccounts: report.suitFiledAccounts || 0,
    validUntil: report.validUntil,
    fromCache,
    source,
  };
}

/**
 * Main coordinator function to pull a new credit report or fetch from the 30-day cache.
 */
export async function pullBureauReport(input: BureauPullInput): Promise<BureauSummary> {
  if (!input.consentObtained) {
    throw new Error('CONSENT_REQUIRED: Explicit borrower consent is required before performing a credit pull.');
  }

  // 1. Resolve Credentials and verify module status
  const creds = await resolveBureauCredentials(input.tenantId);

  // 2. Check Cache (30 days validation)
  const cachedReport = await prisma.bureauReport.findFirst({
    where: {
      customerId: input.customerId,
      tenantId: input.tenantId,
      status: 'success',
      validUntil: { gte: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (cachedReport) {
    return mapSummary(cachedReport, true, creds.source);
  }

  // 3. Quota billing verification
  await checkAndDeductQuota(input.tenantId);

  // 4. Retrieve Customer PII
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: input.customerId },
    select: {
      name: true,
      phone: true,
      aadharNumber: true, // Encrypted
      pan: true,          // Plaintext
      address: true,
      notes: true, // We will extract city and zip if needed, or fallback
    }
  });

  const decryptedAadhar = customer.aadharNumber 
    ? decryptAadharNumber(customer.aadharNumber) 
    : null;

  // Extract mock zip/city if pincode or city fields are missing
  const queryPayload: BureauQueryInput = {
    name: customer.name,
    phone: customer.phone,
    dob: null, // Defaults in Phase 1
    pan: customer.pan,
    aadhar: decryptedAadhar,
    address: customer.address,
    city: 'Chennai',       // Fallback placeholder
    pincode: '600001',     // Fallback placeholder
  };

  // 5. Initialize TLS Agent or local development proxy
  let agent: any = null;
  if (process.env.BUREAU_PROXY && process.env.NODE_ENV !== 'production') {
    agent = new SocksProxyAgent(process.env.BUREAU_PROXY);
  } else if (creds.bureauCert && creds.bureauKey) {
    agent = getOrCreateAgent(input.tenantId, creds.bureauCert, creds.bureauKey);
  }

  // 6. Build pre-pull pending database entry
  const consentText = `I, the applicant, hereby authorize ${
    creds.provider === 'CRIF' ? 'CRIF High Mark Credit Information Services Pvt. Ltd.' : 'TransUnion CIBIL Limited'
  } to access my credit information for the purpose of loan processing. Consent obtained on ${new Date().toLocaleDateString('en-IN')}.`;

  const pendingReport = await prisma.bureauReport.create({
    data: {
      tenantId: input.tenantId,
      customerId: input.customerId,
      loanId: input.loanId || null,
      bureauProvider: creds.provider,
      pullType: input.pullType,
      requestId: `PENDING-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'pending',
      consentText,
      consentObtained: true,
      consentTimestamp: new Date(),
      consentIp: input.requestIp,
      consentMethod: input.consentMethod,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Valid for 30 days
    }
  });

  try {
    let rawResponse = '';
    let parsed: any = null;

    if (creds.provider === 'CRIF') {
      const client = new CRIFClient(creds, agent);
      rawResponse = await client.fetchReport(queryPayload);
      parsed = client.parseResponse(rawResponse);
    } else {
      const client = new CIBILClient(creds, agent);
      rawResponse = await client.fetchReport(queryPayload);
      parsed = client.parseResponse(rawResponse);
    }

    const encryptedRaw = encryptField(rawResponse) || '';

    // Update report with parsed scorecard metrics
    const completedReport = await prisma.bureauReport.update({
      where: { id: pendingReport.id },
      data: {
        requestId: parsed.bureauRequestId,
        status: parsed.status,
        creditScore: parsed.creditScore,
        scoreModel: parsed.scoreModel,
        totalAccounts: parsed.totalAccounts,
        activeAccounts: parsed.activeAccounts,
        overdueAccounts: parsed.overdueAccounts,
        totalOverdueAmt: parsed.totalOverdueAmt,
        enquiryCount90d: parsed.enquiryCount90d,
        activeMFILoans: parsed.activeMFILoans,
        activeMFILoanAmt: parsed.activeMFILoanAmt,
        writtenOffAccounts: parsed.writtenOffAccounts,
        suitFiledAccounts: parsed.suitFiledAccounts,
        rawResponse: encryptedRaw,
      }
    });

    // Write audit trail entry
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.requestedByUserId,
        action: 'credit_bureau_pull',
        entityType: 'customer',
        entityId: input.customerId,
        newValue: JSON.stringify({
          provider: creds.provider,
          pullType: input.pullType,
          score: parsed.creditScore,
          status: parsed.status,
          reportId: completedReport.id,
        })
      }
    });

    return mapSummary(completedReport, false, creds.source);

  } catch (err: any) {
    // Flag the report status as error
    await prisma.bureauReport.update({
      where: { id: pendingReport.id },
      data: { status: 'error' }
    });

    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.requestedByUserId,
        action: 'credit_bureau_error',
        entityType: 'customer',
        entityId: input.customerId,
        newValue: JSON.stringify({ error: err.message || err })
      }
    });

    throw err;
  }
}
