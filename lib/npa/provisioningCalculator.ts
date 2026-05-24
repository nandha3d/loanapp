import type { AssetCategory } from './npaClassifier';
import prisma from '@/lib/db';

export interface ProvisioningResult {
  rate: number;      // percentage (e.g., 15 for 15%)
  amount: number;    // ₹ amount
  basis: string;     // human-readable explanation
}

export interface ProvisioningBucket {
  count: number;
  outstanding: number;
  provisioning: number;
}

export interface ProvisioningSummary {
  standard: ProvisioningBucket;
  sma: ProvisioningBucket;
  sub_standard: ProvisioningBucket;
  doubtful: ProvisioningBucket;
  loss: ProvisioningBucket;
  total: ProvisioningBucket;
}

/**
 * RBI IRACP provisioning rates.
 * For MFIs: all loans are unsecured.
 * isSecured flag retained for NBFC clients who have secured loans.
 */
export function calculateProvisioning(
  category: AssetCategory,
  outstandingAmount: number,
  isSecured: boolean = false
): ProvisioningResult {

  const RATES: Record<AssetCategory, { secured: number; unsecured: number; basis: string }> = {
    standard:     { secured: 0.40, unsecured: 0.40,  basis: 'Standard asset: 0.40% of outstanding' },
    sma_0:        { secured: 0.40, unsecured: 0.40,  basis: 'SMA-0: Standard provisioning maintained' },
    sma_1:        { secured: 0.40, unsecured: 0.40,  basis: 'SMA-1: Standard provisioning maintained' },
    sma_2:        { secured: 0.40, unsecured: 0.40,  basis: 'SMA-2: Standard provisioning maintained' },
    sub_standard: { secured: 15,   unsecured: 15,    basis: 'Sub-Standard: 15% of outstanding' },
    doubtful_d1:  { secured: 25,   unsecured: 100,   basis: 'Doubtful D1: 25% (secured) / 100% (unsecured)' },
    doubtful_d2:  { secured: 40,   unsecured: 100,   basis: 'Doubtful D2: 40% (secured) / 100% (unsecured)' },
    doubtful_d3:  { secured: 100,  unsecured: 100,   basis: 'Doubtful D3: 100% of outstanding' },
    loss:         { secured: 100,  unsecured: 100,   basis: 'Loss: 100% of outstanding' },
    written_off:  { secured: 100,  unsecured: 100,   basis: 'Written-off: 100% provisioned' },
  };

  const rateEntry = RATES[category];
  const rate = isSecured ? rateEntry.secured : rateEntry.unsecured;
  const amount = (outstandingAmount * rate) / 100;

  return {
    rate,
    amount: Math.round(amount * 100) / 100,  // round to 2 decimal places
    basis: rateEntry.basis,
  };
}

/**
 * Aggregate provisioning across all loans in a tenant.
 * Used for the NPA Report and balance sheet provisioning line item.
 */
export async function getTenantProvisioningSummary(
  tenantId: string,
  asOfDate: Date = new Date()
): Promise<ProvisioningSummary> {
  const startOfDay = new Date(asOfDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(asOfDate);
  endOfDay.setHours(23, 59, 59, 999);

  const snapshots = await prisma.loanProvisioning.findMany({
    where: {
      tenantId,
      snapshotDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const summary: ProvisioningSummary = {
    standard:     { count: 0, outstanding: 0, provisioning: 0 },
    sma:          { count: 0, outstanding: 0, provisioning: 0 },
    sub_standard: { count: 0, outstanding: 0, provisioning: 0 },
    doubtful:     { count: 0, outstanding: 0, provisioning: 0 },
    loss:         { count: 0, outstanding: 0, provisioning: 0 },
    total:        { count: 0, outstanding: 0, provisioning: 0 },
  };

  for (const s of snapshots) {
    const bucket = getCategoryBucket(s.category as AssetCategory);
    summary[bucket].count++;
    summary[bucket].outstanding += Number(s.outstandingAmt);
    summary[bucket].provisioning += Number(s.provisioningAmt);
    summary.total.count++;
    summary.total.outstanding += Number(s.outstandingAmt);
    summary.total.provisioning += Number(s.provisioningAmt);
  }

  return summary;
}

function getCategoryBucket(category: AssetCategory): keyof Omit<ProvisioningSummary, 'total'> {
  if (category === 'standard') return 'standard';
  if (['sma_0', 'sma_1', 'sma_2'].includes(category)) return 'sma';
  if (category === 'sub_standard') return 'sub_standard';
  if (['doubtful_d1', 'doubtful_d2', 'doubtful_d3'].includes(category)) return 'doubtful';
  return 'loss';
}
