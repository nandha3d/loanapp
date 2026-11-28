// Canonical 18-engine chit fund taxonomy, cross-cutting modifiers, and config
// serialization helpers (zero Next.js / Prisma imports — safe in pure tests,
// server components, mobile v1 routes, and client components).

export const CHIT_ENGINE_TYPES = [
  // Category A: Bidding & Auction Engines
  'AUCTION_STANDARD',
  'AUCTION_RESERVE_PRICE',
  'AUCTION_MULTI_DIVISION',
  'AUCTION_UNCAPPED_ENTERPRISE',
  // Category B: Fixed, Chart & Non-Auction Engines
  'BASE_PLUS_PREMIUM',
  'FIXED_CHART_ESCALATING',
  'FIXED_DIVIDEND',
  'FIXED_PAYOUT_VARIABLE_PAY',
  'PURE_LOTTERY',
  'FIXED_ROTATION',
  'NEED_BASED_CONSENSUS',
  // Category C: Micro, Commodity & Purpose-Driven Engines
  'MICRO_DAILY_COLLECTION',
  'GOLD_VALUE_ACCUMULATION',
  'GOLD_WEIGHT_ACCUMULATION',
  'FESTIVAL_COMMODITY',
  // Category D: Enterprise, Hybrid & Lending-Linked Engines
  'HYBRID_SPLIT_PHASE',
  'ASCA_SHG_REVOLVING',
  'CUSTOM_MANUAL_SCHEDULE',
] as const;

export type ChitEngineType = (typeof CHIT_ENGINE_TYPES)[number];

/**
 * STABLE-2: Untouched tenants see only the three already-shipped chit engines
 * until an administrator enables additional types in Settings -> Chit Types.
 */
export const DEFAULT_ENABLED_CHIT_ENGINE_TYPES: readonly ChitEngineType[] = [
  'AUCTION_STANDARD',
  'PURE_LOTTERY',
  'FIXED_ROTATION',
];

export const CHIT_ENGINE_CATEGORIES = [
  'AUCTION',
  'FIXED_CHART',
  'MICRO_COMMODITY',
  'ENTERPRISE_HYBRID',
] as const;

export type ChitEngineCategory = (typeof CHIT_ENGINE_CATEGORIES)[number];

export const REGULATORY_TIERS = [
  'REGISTERED_ACT_1982',
  'UNORGANIZED_INFORMAL',
  'SHG_COOPERATIVE',
  'MERCHANT_SAVINGS',
] as const;
export type ChitRegulatoryTier = (typeof REGULATORY_TIERS)[number];

export const SCALE_TIERS = [
  'MICRO',
  'HOUSEHOLD',
  'SME_TRADER',
  'ENTERPRISE',
] as const;
export type ChitScaleTier = (typeof SCALE_TIERS)[number];

export const COLLECTION_FREQUENCIES = [
  'DAILY_25',
  'DAILY_30',
  'WEEKLY',
  'FORTNIGHTLY',
  'MONTHLY',
  'BI_MONTHLY',
  'SEASONAL_HARVEST',
] as const;
export type ChitCollectionFrequency = (typeof COLLECTION_FREQUENCIES)[number];

export const PAYOUT_ASSET_TYPES = [
  'CASH',
  'GOLD_WEIGHT',
  'GOLD_VALUE',
  'COMMODITY_GOODS',
] as const;
export type ChitPayoutAssetType = (typeof PAYOUT_ASSET_TYPES)[number];

export const BIDDING_MODES = [
  'OPEN_LIVE',
  'OPEN_MANUAL',
  'SEALED_TENDER',
  'ONLINE_APP',
  'NONE',
] as const;
export type ChitBiddingMode = (typeof BIDDING_MODES)[number];

export const FOREMAN_COMPENSATION_MODES = [
  'PERCENTAGE_COMMISSION',
  'FREE_TICKET_CYCLE_1',
  'FREE_TICKET_CYCLE_2',
  'FLAT_FEE',
  'HYBRID',
  'ZERO_COMMISSION',
] as const;
export type ChitForemanCompensationMode = (typeof FOREMAN_COMPENSATION_MODES)[number];

export const CHIT_SECURITY_TYPES = [
  'NONE',
  'INTERNAL_GUARANTOR_JAMEEN',
  'PROMISSORY_NOTE',
  'POST_DATED_CHEQUE',
  'GOLD_PLEDGE',
  'PROPERTY_DOCUMENT',
  'FD_LIEN',
] as const;
export type ChitSecurityCollateralType = (typeof CHIT_SECURITY_TYPES)[number];

export const LATE_FEE_TYPES = [
  'FLAT_PER_DAY',
  'PERCENTAGE_PA',
  'NONE',
] as const;
export type ChitLateFeeType = (typeof LATE_FEE_TYPES)[number];

export type ChitEscalatingPayoutRow = {
  period: number;
  payoutAmount: number;
};

export type ChitFixedDividendRow = {
  period: number;
  dividendPerTicket: number;
};

export type ChitVariableInstalmentRow = {
  period: number;
  nonPrizedDue: number;
  prizedDue: number;
};

export type ChitCustomScheduleRow = {
  period: number;
  instalmentNonPrized: number;
  instalmentPrized: number;
  payoutAmount: number;
  commission: number;
  dividendPerTicket?: number;
};

export type ChitEngineConfig = {
  chitType: ChitEngineType;
  regulatoryTier: ChitRegulatoryTier;
  scaleTier: ChitScaleTier;
  collectionFrequency: ChitCollectionFrequency;
  payoutAssetType: ChitPayoutAssetType;
  biddingMode: ChitBiddingMode;
  discountRules: {
    minDiscountPct: number;
    maxDiscountPct: number | null;
    uncapped: boolean;
    reservePriceStepPct: number;
    bidIncrementMultiple: number;
    strictBidMultiple?: boolean;
    allowConsecutiveSelfBid?: boolean;
  };
  dividendDistributionMode:
    | 'ALL_MEMBERS'
    | 'NON_PRIZED_ONLY'
    | 'NON_WINNERS_ONLY'
    | 'DEFERRED_BONUS_POOL'
    | 'NONE';
  foremanCompensation: {
    mode: ChitForemanCompensationMode;
    commissionPct: number;
    flatFeeAmount: number;
    reservedForemanCycles: number[];
  };
  differentialInstalment: {
    enabled: boolean;
    baseInstalment: number;
    prizedPremiumAmount: number;
  };
  multiDivision: {
    enabled: boolean;
    lotteryWinnersPerCycle: number;
    auctionWinnersPerCycle: number;
  };
  securityRequirements: {
    requiredForPrized: boolean;
    acceptedTypes: string[];
    autoHoldPayoutUntilVerified: boolean;
  };
  defaultRules: {
    forfeitDividendOnLate: boolean;
    lateFeeType: ChitLateFeeType;
    lateFeeValue: number;
    substitutionCutoffPct: number;
  };
  escalatingPayouts?: ChitEscalatingPayoutRow[];
  fixedDividends?: ChitFixedDividendRow[];
  variableInstalments?: ChitVariableInstalmentRow[];
  customSchedule?: ChitCustomScheduleRow[];
  rotationOrder?: string[];
  microDaily?: {
    collectionDaysPerCycle: number;
    dailyAmount: number;
    drawCadence: 'weekly' | 'monthly';
  };
  goldScheme?: {
    bonusMonths: number;
    bonusPct: number;
    makingChargeWaiverPct: number;
    wastageWaiverPct: number;
    defaultGoldRatePerGram: number;
  };
  commodityScheme?: {
    itemsSummary: string;
    merchantBonusAmount: number;
    merchantBonusPct: number;
  };
  hybridSplitPhase?: {
    reservedCyclesCount: number;
    reservedDiscountPct: number;
    reservedTicketAssignments?: Record<string, string>;
  };
  ascaPool?: {
    monthlyLoanInterestPct: number;
    maxLoanMultiplier: number;
    adminExpensePerCycle: number;
  };
  seasonalDates?: string[];
  meetingSchedule?: {
    defaultDurationMinutes: number;
    autoStartAtScheduledTime: boolean;
  };
  voiceSettings?: {
    language: 'en' | 'ta' | 'ml' | 'hi' | 'te' | 'kn';
    allowMemberChange: boolean;
    speakingRate?: number;
    voiceProfile?: string;
  };
  tableCash?: {
    enabled: boolean;
    allowWinnerSettleAfterAuction?: boolean;
  };
};

export type ChitEngineCatalogItem = {
  code: ChitEngineType;
  category: ChitEngineCategory;
  name: string;
  regionalNames: string;
  description: string;
  supportsBidding: boolean;
  requiresScheduleTable: boolean;
  defaultAuctionType: 'open_manual' | 'open_live' | 'sealed' | 'lottery' | 'fixed_rotation';
  defaultConfig: ChitEngineConfig;
};

function makeConfig(
  chitType: ChitEngineType,
  overrides: Partial<Omit<ChitEngineConfig, 'chitType' | 'discountRules' | 'foremanCompensation' | 'differentialInstalment' | 'multiDivision' | 'securityRequirements' | 'defaultRules'>> & {
    discountRules?: Partial<ChitEngineConfig['discountRules']>;
    foremanCompensation?: Partial<ChitEngineConfig['foremanCompensation']>;
    differentialInstalment?: Partial<ChitEngineConfig['differentialInstalment']>;
    multiDivision?: Partial<ChitEngineConfig['multiDivision']>;
    securityRequirements?: Partial<ChitEngineConfig['securityRequirements']>;
    defaultRules?: Partial<ChitEngineConfig['defaultRules']>;
  } = {},
): ChitEngineConfig {
  return {
    chitType,
    regulatoryTier: overrides.regulatoryTier ?? 'UNORGANIZED_INFORMAL',
    scaleTier: overrides.scaleTier ?? 'HOUSEHOLD',
    collectionFrequency: overrides.collectionFrequency ?? 'MONTHLY',
    payoutAssetType: overrides.payoutAssetType ?? 'CASH',
    biddingMode: overrides.biddingMode ?? 'OPEN_MANUAL',
    discountRules: {
      minDiscountPct: 0,
      maxDiscountPct: 40,
      uncapped: false,
      reservePriceStepPct: 0,
      bidIncrementMultiple: 100,
      ...overrides.discountRules,
    },
    dividendDistributionMode: overrides.dividendDistributionMode ?? 'ALL_MEMBERS',
    foremanCompensation: {
      mode: 'PERCENTAGE_COMMISSION',
      commissionPct: 5,
      flatFeeAmount: 0,
      reservedForemanCycles: [],
      ...overrides.foremanCompensation,
    },
    differentialInstalment: {
      enabled: false,
      baseInstalment: 0,
      prizedPremiumAmount: 0,
      ...overrides.differentialInstalment,
    },
    multiDivision: {
      enabled: false,
      lotteryWinnersPerCycle: 1,
      auctionWinnersPerCycle: 3,
      ...overrides.multiDivision,
    },
    securityRequirements: {
      requiredForPrized: true,
      acceptedTypes: ['INTERNAL_GUARANTOR_JAMEEN', 'PROMISSORY_NOTE', 'POST_DATED_CHEQUE'],
      autoHoldPayoutUntilVerified: true,
      ...overrides.securityRequirements,
    },
    defaultRules: {
      forfeitDividendOnLate: false,
      lateFeeType: 'NONE',
      lateFeeValue: 0,
      substitutionCutoffPct: 70,
      ...overrides.defaultRules,
    },
    ...(overrides.escalatingPayouts ? { escalatingPayouts: overrides.escalatingPayouts } : {}),
    ...(overrides.fixedDividends ? { fixedDividends: overrides.fixedDividends } : {}),
    ...(overrides.variableInstalments ? { variableInstalments: overrides.variableInstalments } : {}),
    ...(overrides.customSchedule ? { customSchedule: overrides.customSchedule } : {}),
    ...(overrides.rotationOrder ? { rotationOrder: overrides.rotationOrder } : {}),
    ...(overrides.microDaily ? { microDaily: overrides.microDaily } : {}),
    ...(overrides.goldScheme ? { goldScheme: overrides.goldScheme } : {}),
    ...(overrides.commodityScheme ? { commodityScheme: overrides.commodityScheme } : {}),
    ...(overrides.hybridSplitPhase ? { hybridSplitPhase: overrides.hybridSplitPhase } : {}),
    ...(overrides.ascaPool ? { ascaPool: overrides.ascaPool } : {}),
    ...(overrides.seasonalDates ? { seasonalDates: overrides.seasonalDates } : {}),
  };
}

export const CHIT_ENGINE_CATALOG: Record<ChitEngineType, ChitEngineCatalogItem> = {
  AUCTION_STANDARD: {
    code: 'AUCTION_STANDARD',
    category: 'AUCTION',
    name: 'Standard Auction Dividend Chit',
    regionalNames: 'Yela Chit (TN), Paata (AP/TS), Lelam (KL), Committee (North)',
    description: 'Non-prized members bid a discount each cycle; highest discount wins the pot and net discount after foreman commission is distributed as dividend.',
    supportsBidding: true,
    requiresScheduleTable: false,
    defaultAuctionType: 'open_manual',
    defaultConfig: makeConfig('AUCTION_STANDARD', {
      regulatoryTier: 'REGISTERED_ACT_1982',
      biddingMode: 'OPEN_MANUAL',
      discountRules: { minDiscountPct: 5, maxDiscountPct: 40 },
    }),
  },
  AUCTION_RESERVE_PRICE: {
    code: 'AUCTION_RESERVE_PRICE',
    category: 'AUCTION',
    name: 'Reserve-Price / Declining Floor Chit',
    regionalNames: 'Sarkari Ghaata Committee (Delhi / UP / North India)',
    description: 'Mandatory declining minimum bid discount Rt = (x% * V) * (N - t + 1). If no bid exceeds the floor, winner is drawn by lottery at the floor.',
    supportsBidding: true,
    requiresScheduleTable: false,
    defaultAuctionType: 'open_manual',
    defaultConfig: makeConfig('AUCTION_RESERVE_PRICE', {
      biddingMode: 'OPEN_MANUAL',
      discountRules: { minDiscountPct: 0, maxDiscountPct: 45, reservePriceStepPct: 1.5, bidIncrementMultiple: 100 },
    }),
  },
  AUCTION_MULTI_DIVISION: {
    code: 'AUCTION_MULTI_DIVISION',
    category: 'AUCTION',
    name: 'Multi-Division Chit',
    regionalNames: 'Multidivision Chitty (Kerala / KSFE model)',
    description: 'Multiple winners per cycle: typically 1 lottery winner at full pot minus commission plus M auction winners whose discounts are pooled for all subscribers.',
    supportsBidding: true,
    requiresScheduleTable: false,
    defaultAuctionType: 'open_manual',
    defaultConfig: makeConfig('AUCTION_MULTI_DIVISION', {
      regulatoryTier: 'REGISTERED_ACT_1982',
      scaleTier: 'SME_TRADER',
      biddingMode: 'OPEN_MANUAL',
      multiDivision: { enabled: true, lotteryWinnersPerCycle: 1, auctionWinnersPerCycle: 3 },
    }),
  },
  AUCTION_UNCAPPED_ENTERPRISE: {
    code: 'AUCTION_UNCAPPED_ENTERPRISE',
    category: 'AUCTION',
    name: 'Uncapped / High-Value Syndicate Chit',
    regionalNames: 'Business Committee, Bishi (MH/GJ), Enterprise Yela Chit',
    description: 'High-value trader/developer auction pool without statutory 30%-40% discount ceiling, backed by strict collateral and enterprise float rules.',
    supportsBidding: true,
    requiresScheduleTable: false,
    defaultAuctionType: 'open_live',
    defaultConfig: makeConfig('AUCTION_UNCAPPED_ENTERPRISE', {
      regulatoryTier: 'UNORGANIZED_INFORMAL',
      scaleTier: 'ENTERPRISE',
      biddingMode: 'OPEN_LIVE',
      discountRules: { minDiscountPct: 5, maxDiscountPct: null, uncapped: true, bidIncrementMultiple: 1000 },
      securityRequirements: {
        requiredForPrized: true,
        acceptedTypes: ['POST_DATED_CHEQUE', 'PROMISSORY_NOTE', 'PROPERTY_DOCUMENT', 'FD_LIEN'],
        autoHoldPayoutUntilVerified: true,
      },
    }),
  },
  BASE_PLUS_PREMIUM: {
    code: 'BASE_PLUS_PREMIUM',
    category: 'FIXED_CHART',
    name: 'Base + Premium (Differential Instalment) Chit',
    regionalNames: 'Theni Draw-of-Lots, Interest-Bearing Chit, Prized-Premium Chit',
    description: 'Members pay a base instalment before winning and Base + Premium after lifting; pool grows linearly as more tickets become prized.',
    supportsBidding: false,
    requiresScheduleTable: false,
    defaultAuctionType: 'lottery',
    defaultConfig: makeConfig('BASE_PLUS_PREMIUM', {
      biddingMode: 'NONE',
      dividendDistributionMode: 'NONE',
      foremanCompensation: { mode: 'PERCENTAGE_COMMISSION', commissionPct: 5 },
      differentialInstalment: { enabled: true, baseInstalment: 5000, prizedPremiumAmount: 1000 },
    }),
  },
  FIXED_CHART_ESCALATING: {
    code: 'FIXED_CHART_ESCALATING',
    category: 'FIXED_CHART',
    name: 'Fixed Payment / Escalating Payout (Chart Chit)',
    regionalNames: 'Table Chit, Chart Chit, Fixed-Rate Chit',
    description: 'Fixed equal instalment every cycle with a pre-printed escalating payout table drawn by lottery or consensus without bidding.',
    supportsBidding: false,
    requiresScheduleTable: true,
    defaultAuctionType: 'lottery',
    defaultConfig: makeConfig('FIXED_CHART_ESCALATING', {
      biddingMode: 'NONE',
      dividendDistributionMode: 'NONE',
      foremanCompensation: { mode: 'FLAT_FEE', commissionPct: 0, flatFeeAmount: 0 },
      escalatingPayouts: [],
    }),
  },
  FIXED_DIVIDEND: {
    code: 'FIXED_DIVIDEND',
    category: 'FIXED_CHART',
    name: 'Fixed Dividend Chit',
    regionalNames: 'Pre-Fixed Dividend Scheme',
    description: 'Pre-published per-cycle dividend schedule tapering over the tenure so monthly net payable is predictable without live auctions.',
    supportsBidding: false,
    requiresScheduleTable: true,
    defaultAuctionType: 'lottery',
    defaultConfig: makeConfig('FIXED_DIVIDEND', {
      biddingMode: 'NONE',
      dividendDistributionMode: 'ALL_MEMBERS',
      fixedDividends: [],
    }),
  },
  FIXED_PAYOUT_VARIABLE_PAY: {
    code: 'FIXED_PAYOUT_VARIABLE_PAY',
    category: 'FIXED_CHART',
    name: 'Fixed Payout / Variable Payment Chit',
    regionalNames: 'Full-Pot Chit',
    description: 'Winner always receives 100% of gross chit value (less optional commission) while cycle-by-cycle instalments vary to balance the pool.',
    supportsBidding: false,
    requiresScheduleTable: true,
    defaultAuctionType: 'lottery',
    defaultConfig: makeConfig('FIXED_PAYOUT_VARIABLE_PAY', {
      biddingMode: 'NONE',
      dividendDistributionMode: 'NONE',
      foremanCompensation: { mode: 'ZERO_COMMISSION', commissionPct: 0 },
      variableInstalments: [],
    }),
  },
  PURE_LOTTERY: {
    code: 'PURE_LOTTERY',
    category: 'FIXED_CHART',
    name: 'Pure Lottery Chit',
    regionalNames: 'Kulakkal Chit (TN), Narukku Kuri (KL)',
    description: 'Audited random draw among non-prized tickets each cycle with zero bidding and optional flat foreman fee or zero dividend.',
    supportsBidding: false,
    requiresScheduleTable: false,
    defaultAuctionType: 'lottery',
    defaultConfig: makeConfig('PURE_LOTTERY', {
      biddingMode: 'NONE',
      dividendDistributionMode: 'NONE',
      foremanCompensation: { mode: 'ZERO_COMMISSION', commissionPct: 0 },
    }),
  },
  FIXED_ROTATION: {
    code: 'FIXED_ROTATION',
    category: 'FIXED_CHART',
    name: 'Fixed-Order Rotation Chit',
    regionalNames: 'Murai Chit (TN), Office / Friends ROSCA',
    description: 'Predetermined Day-1 payout sequence across all cycles with zero bidding, zero commission, and zero dividend.',
    supportsBidding: false,
    requiresScheduleTable: false,
    defaultAuctionType: 'fixed_rotation',
    defaultConfig: makeConfig('FIXED_ROTATION', {
      biddingMode: 'NONE',
      dividendDistributionMode: 'NONE',
      foremanCompensation: { mode: 'ZERO_COMMISSION', commissionPct: 0 },
      securityRequirements: { requiredForPrized: false, acceptedTypes: ['NONE'], autoHoldPayoutUntilVerified: false },
    }),
  },
  NEED_BASED_CONSENSUS: {
    code: 'NEED_BASED_CONSENSUS',
    category: 'FIXED_CHART',
    name: 'Need-Based / Consensus Chit',
    regionalNames: 'Community / Family Trust Chit',
    description: 'Members mutually allocate each cycle pot to the subscriber with the most urgent medical, education, or family need.',
    supportsBidding: false,
    requiresScheduleTable: false,
    defaultAuctionType: 'lottery',
    defaultConfig: makeConfig('NEED_BASED_CONSENSUS', {
      biddingMode: 'NONE',
      dividendDistributionMode: 'NONE',
      foremanCompensation: { mode: 'ZERO_COMMISSION', commissionPct: 0 },
      securityRequirements: { requiredForPrized: false, acceptedTypes: ['INTERNAL_GUARANTOR_JAMEEN'], autoHoldPayoutUntilVerified: false },
    }),
  },
  MICRO_DAILY_COLLECTION: {
    code: 'MICRO_DAILY_COLLECTION',
    category: 'MICRO_COMMODITY',
    name: 'Daily / 25-Day Cycle Micro-Chit',
    regionalNames: 'Thandal Chit, Sandhai / Market Chit (TN)',
    description: 'Field agent daily or weekly collections (e.g. 25 collection days/month skipping Sundays) paired with periodic draws or auctions.',
    supportsBidding: true,
    requiresScheduleTable: false,
    defaultAuctionType: 'open_manual',
    defaultConfig: makeConfig('MICRO_DAILY_COLLECTION', {
      scaleTier: 'MICRO',
      collectionFrequency: 'DAILY_25',
      biddingMode: 'OPEN_MANUAL',
      microDaily: { collectionDaysPerCycle: 25, dailyAmount: 200, drawCadence: 'monthly' },
    }),
  },
  GOLD_VALUE_ACCUMULATION: {
    code: 'GOLD_VALUE_ACCUMULATION',
    category: 'MICRO_COMMODITY',
    name: 'Gold / Jewellery Value Chit',
    regionalNames: '11+1 Gold Scheme, Nagai Chit (TN/KL/KA)',
    description: 'Fixed monthly savings over N months redeemed in gold jewellery at maturity with merchant bonus month or making/wastage charge waivers.',
    supportsBidding: false,
    requiresScheduleTable: false,
    defaultAuctionType: 'fixed_rotation',
    defaultConfig: makeConfig('GOLD_VALUE_ACCUMULATION', {
      regulatoryTier: 'MERCHANT_SAVINGS',
      payoutAssetType: 'GOLD_VALUE',
      biddingMode: 'NONE',
      dividendDistributionMode: 'NONE',
      foremanCompensation: { mode: 'ZERO_COMMISSION', commissionPct: 0 },
      securityRequirements: { requiredForPrized: false, acceptedTypes: ['NONE'], autoHoldPayoutUntilVerified: false },
      goldScheme: { bonusMonths: 1, bonusPct: 0, makingChargeWaiverPct: 100, wastageWaiverPct: 100, defaultGoldRatePerGram: 0 },
    }),
  },
  GOLD_WEIGHT_ACCUMULATION: {
    code: 'GOLD_WEIGHT_ACCUMULATION',
    category: 'MICRO_COMMODITY',
    name: 'Gold Weight-Accumulation Chit',
    regionalNames: 'DigiGold / Gram-Locked Chit',
    description: 'Each instalment immediately converts to gold grams g_t = S_t / R_t at that day’s bullion rate and redeems accumulated weight at maturity.',
    supportsBidding: false,
    requiresScheduleTable: false,
    defaultAuctionType: 'fixed_rotation',
    defaultConfig: makeConfig('GOLD_WEIGHT_ACCUMULATION', {
      regulatoryTier: 'MERCHANT_SAVINGS',
      payoutAssetType: 'GOLD_WEIGHT',
      biddingMode: 'NONE',
      dividendDistributionMode: 'NONE',
      foremanCompensation: { mode: 'ZERO_COMMISSION', commissionPct: 0 },
      securityRequirements: { requiredForPrized: false, acceptedTypes: ['NONE'], autoHoldPayoutUntilVerified: false },
      goldScheme: { bonusMonths: 0, bonusPct: 0, makingChargeWaiverPct: 50, wastageWaiverPct: 50, defaultGoldRatePerGram: 7500 },
    }),
  },
  FESTIVAL_COMMODITY: {
    code: 'FESTIVAL_COMMODITY',
    category: 'MICRO_COMMODITY',
    name: 'Festival / Commodity / Goods Chit',
    regionalNames: 'Deepavali Chit, Pongal Chit, Vessel / Grocery / Cracker Chit',
    description: 'Fixed cash instalments over 10-12 cycles redeemed in kind (gold coin, sweets, crackers, brassware, groceries, or appliances) with merchant bonus.',
    supportsBidding: false,
    requiresScheduleTable: false,
    defaultAuctionType: 'fixed_rotation',
    defaultConfig: makeConfig('FESTIVAL_COMMODITY', {
      regulatoryTier: 'MERCHANT_SAVINGS',
      scaleTier: 'MICRO',
      payoutAssetType: 'COMMODITY_GOODS',
      biddingMode: 'NONE',
      dividendDistributionMode: 'NONE',
      foremanCompensation: { mode: 'ZERO_COMMISSION', commissionPct: 0 },
      securityRequirements: { requiredForPrized: false, acceptedTypes: ['NONE'], autoHoldPayoutUntilVerified: false },
      commodityScheme: { itemsSummary: 'Festival gift hamper & household goods', merchantBonusAmount: 0, merchantBonusPct: 8 },
    }),
  },
  HYBRID_SPLIT_PHASE: {
    code: 'HYBRID_SPLIT_PHASE',
    category: 'ENTERPRISE_HYBRID',
    name: 'Hybrid / Split-Phase Chit',
    regionalNames: 'Foreman-First / Pre-Booked Auction Chit',
    description: 'Early cycles 1..k are reserved at a predetermined discount for foreman/early-need members, and cycles k+1..N run as competitive auctions.',
    supportsBidding: true,
    requiresScheduleTable: false,
    defaultAuctionType: 'open_manual',
    defaultConfig: makeConfig('HYBRID_SPLIT_PHASE', {
      scaleTier: 'SME_TRADER',
      biddingMode: 'OPEN_MANUAL',
      foremanCompensation: { mode: 'HYBRID', commissionPct: 3, reservedForemanCycles: [1] },
      hybridSplitPhase: { reservedCyclesCount: 1, reservedDiscountPct: 0 },
    }),
  },
  ASCA_SHG_REVOLVING: {
    code: 'ASCA_SHG_REVOLVING',
    category: 'ENTERPRISE_HYBRID',
    name: 'ASCA / SHG Revolving Pool',
    regionalNames: 'Kudumbashree (KL), Mahalir Thittam (TN), Sangha Fund',
    description: 'Accumulating savings and credit pool where members take partial internal loans at agreed monthly interest and share net profit at term end.',
    supportsBidding: false,
    requiresScheduleTable: false,
    defaultAuctionType: 'fixed_rotation',
    defaultConfig: makeConfig('ASCA_SHG_REVOLVING', {
      regulatoryTier: 'SHG_COOPERATIVE',
      scaleTier: 'MICRO',
      biddingMode: 'NONE',
      dividendDistributionMode: 'DEFERRED_BONUS_POOL',
      foremanCompensation: { mode: 'ZERO_COMMISSION', commissionPct: 0 },
      securityRequirements: { requiredForPrized: false, acceptedTypes: ['INTERNAL_GUARANTOR_JAMEEN'], autoHoldPayoutUntilVerified: false },
      ascaPool: { monthlyLoanInterestPct: 1.5, maxLoanMultiplier: 3, adminExpensePerCycle: 0 },
    }),
  },
  CUSTOM_MANUAL_SCHEDULE: {
    code: 'CUSTOM_MANUAL_SCHEDULE',
    category: 'ENTERPRISE_HYBRID',
    name: 'Custom / Manual Schedule Chit',
    regionalNames: 'Bespoke / Notebook Chit',
    description: 'Foreman specifies or imports exact non-prized due, prized due, payout, commission, and dividend for every cycle t in [1, N].',
    supportsBidding: false,
    requiresScheduleTable: true,
    defaultAuctionType: 'fixed_rotation',
    defaultConfig: makeConfig('CUSTOM_MANUAL_SCHEDULE', {
      biddingMode: 'NONE',
      customSchedule: [],
    }),
  },
};

export function isChitEngineType(value: unknown): value is ChitEngineType {
  return typeof value === 'string' && (CHIT_ENGINE_TYPES as readonly string[]).includes(value);
}

/** Accept either camelCase or snake_case JSON shapes (spec §4 compatibility). */
export function parseChitEngineConfig(
  raw: string | Partial<ChitEngineConfig> | Record<string, unknown> | null | undefined,
  engineTypeOverride?: string | null,
): ChitEngineConfig {
  let obj: Record<string, any> = {};
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') obj = parsed;
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === 'object') {
    obj = raw as Record<string, any>;
  }

  const candidateType = engineTypeOverride ?? obj.chitType ?? obj.chit_type ?? 'AUCTION_STANDARD';
  const engineType: ChitEngineType = isChitEngineType(candidateType) ? candidateType : 'AUCTION_STANDARD';
  const base = CHIT_ENGINE_CATALOG[engineType].defaultConfig;

  const dr = obj.discountRules ?? obj.discount_rules ?? {};
  const fc = obj.foremanCompensation ?? obj.foreman_compensation ?? {};
  const di = obj.differentialInstalment ?? obj.differential_instalment ?? {};
  const md = obj.multiDivision ?? obj.multi_division ?? {};
  const sr = obj.securityRequirements ?? obj.security_requirements ?? {};
  const df = obj.defaultRules ?? obj.default_rules ?? {};

  const legacyDivDist = obj.dividendDistributionMode ?? obj.dividend_distribution;

  return {
    chitType: engineType,
    regulatoryTier: (obj.regulatoryTier ?? obj.regulatory_tier ?? base.regulatoryTier) as ChitRegulatoryTier,
    scaleTier: (obj.scaleTier ?? obj.scale_tier ?? base.scaleTier) as ChitScaleTier,
    collectionFrequency: (obj.collectionFrequency ?? obj.collection_frequency ?? base.collectionFrequency) as ChitCollectionFrequency,
    payoutAssetType: (obj.payoutAssetType ?? obj.payout_asset_type ?? base.payoutAssetType) as ChitPayoutAssetType,
    biddingMode: (obj.biddingMode ?? obj.bidding_mode ?? base.biddingMode) as ChitBiddingMode,
    discountRules: {
      minDiscountPct: dr.minDiscountPct ?? dr.min_discount_pct ?? base.discountRules.minDiscountPct,
      maxDiscountPct: dr.maxDiscountPct !== undefined
        ? dr.maxDiscountPct
        : dr.max_discount_pct !== undefined
          ? dr.max_discount_pct
          : base.discountRules.maxDiscountPct,
      uncapped: Boolean(dr.uncapped ?? base.discountRules.uncapped),
      reservePriceStepPct: Number(dr.reservePriceStepPct ?? dr.reserve_price_step_pct ?? base.discountRules.reservePriceStepPct) || 0,
      bidIncrementMultiple: Number(dr.bidIncrementMultiple ?? dr.bid_increment_multiple ?? base.discountRules.bidIncrementMultiple) || 0,
      ...(dr.strictBidMultiple !== undefined || dr.strict_bid_multiple !== undefined
        ? { strictBidMultiple: Boolean(dr.strictBidMultiple ?? dr.strict_bid_multiple) }
        : {}),
      ...(dr.allowConsecutiveSelfBid !== undefined || dr.allow_consecutive_self_bid !== undefined
        ? { allowConsecutiveSelfBid: Boolean(dr.allowConsecutiveSelfBid ?? dr.allow_consecutive_self_bid) }
        : {}),
    },
    dividendDistributionMode: (legacyDivDist ?? base.dividendDistributionMode) as ChitEngineConfig['dividendDistributionMode'],
    foremanCompensation: {
      mode: (fc.mode ?? base.foremanCompensation.mode) as ChitForemanCompensationMode,
      commissionPct: Number(fc.commissionPct ?? fc.commission_pct ?? base.foremanCompensation.commissionPct) || 0,
      flatFeeAmount: Number(fc.flatFeeAmount ?? fc.flat_fee_amount ?? base.foremanCompensation.flatFeeAmount) || 0,
      reservedForemanCycles: Array.isArray(fc.reservedForemanCycles ?? fc.reserved_foreman_cycles)
        ? (fc.reservedForemanCycles ?? fc.reserved_foreman_cycles).map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
        : base.foremanCompensation.reservedForemanCycles,
    },
    differentialInstalment: {
      enabled: Boolean(di.enabled ?? base.differentialInstalment.enabled),
      baseInstalment: Number(di.baseInstalment ?? di.base_instalment ?? base.differentialInstalment.baseInstalment) || 0,
      prizedPremiumAmount: Number(di.prizedPremiumAmount ?? di.prized_premium_amount ?? base.differentialInstalment.prizedPremiumAmount) || 0,
    },
    multiDivision: {
      enabled: Boolean(md.enabled ?? base.multiDivision.enabled),
      lotteryWinnersPerCycle: Number(md.lotteryWinnersPerCycle ?? md.lottery_winners_per_cycle ?? base.multiDivision.lotteryWinnersPerCycle) || 0,
      auctionWinnersPerCycle: Number(md.auctionWinnersPerCycle ?? md.auction_winners_per_cycle ?? base.multiDivision.auctionWinnersPerCycle) || 0,
    },
    securityRequirements: {
      requiredForPrized: Boolean(sr.requiredForPrized ?? sr.required_for_prized ?? base.securityRequirements.requiredForPrized),
      acceptedTypes: Array.isArray(sr.acceptedTypes ?? sr.accepted_types)
        ? (sr.acceptedTypes ?? sr.accepted_types).map(String)
        : base.securityRequirements.acceptedTypes,
      autoHoldPayoutUntilVerified: Boolean(sr.autoHoldPayoutUntilVerified ?? sr.auto_hold_payout_until_verified ?? base.securityRequirements.autoHoldPayoutUntilVerified),
    },
    defaultRules: {
      forfeitDividendOnLate: Boolean(df.forfeitDividendOnLate ?? df.forfeit_dividend_on_late ?? base.defaultRules.forfeitDividendOnLate),
      lateFeeType: (df.lateFeeType ?? df.late_fee_type ?? base.defaultRules.lateFeeType) as ChitLateFeeType,
      lateFeeValue: Number(df.lateFeeValue ?? df.late_fee_value ?? base.defaultRules.lateFeeValue) || 0,
      substitutionCutoffPct: Number(df.substitutionCutoffPct ?? df.substitution_cutoff_pct ?? base.defaultRules.substitutionCutoffPct) || 0,
    },
    escalatingPayouts: obj.escalatingPayouts ?? base.escalatingPayouts,
    fixedDividends: obj.fixedDividends ?? base.fixedDividends,
    variableInstalments: obj.variableInstalments ?? base.variableInstalments,
    customSchedule: obj.customSchedule ?? base.customSchedule,
    rotationOrder: obj.rotationOrder ?? base.rotationOrder,
    microDaily: obj.microDaily ?? base.microDaily,
    goldScheme: obj.goldScheme ?? base.goldScheme,
    commodityScheme: obj.commodityScheme ?? base.commodityScheme,
    hybridSplitPhase: obj.hybridSplitPhase ?? base.hybridSplitPhase,
    ascaPool: obj.ascaPool ?? base.ascaPool,
    seasonalDates: obj.seasonalDates ?? base.seasonalDates,
    ...(obj.meetingSchedule && typeof obj.meetingSchedule === 'object'
      ? {
          meetingSchedule: {
            defaultDurationMinutes: Math.max(
              5,
              Math.min(240, Math.round(Number(obj.meetingSchedule.defaultDurationMinutes) || 30)),
            ),
            autoStartAtScheduledTime: Boolean(obj.meetingSchedule.autoStartAtScheduledTime),
          },
        }
      : {}),
    ...(obj.voiceSettings && typeof obj.voiceSettings === 'object'
      ? {
          voiceSettings: {
            language: (
              ['en', 'ta', 'ml', 'hi', 'te', 'kn'].includes(String(obj.voiceSettings.language ?? ''))
                ? String(obj.voiceSettings.language)
                : 'en'
            ) as 'en' | 'ta' | 'ml' | 'hi' | 'te' | 'kn',
            allowMemberChange: Boolean(obj.voiceSettings.allowMemberChange),
            ...(obj.voiceSettings.speakingRate != null
              ? { speakingRate: Number(obj.voiceSettings.speakingRate) || 0.88 }
              : {}),
            ...(obj.voiceSettings.voiceProfile
              ? { voiceProfile: String(obj.voiceSettings.voiceProfile) }
              : {}),
          },
        }
      : {}),
    ...(obj.tableCash && typeof obj.tableCash === 'object'
      ? {
          tableCash: {
            enabled: Boolean(obj.tableCash.enabled),
            allowWinnerSettleAfterAuction: obj.tableCash.allowWinnerSettleAfterAuction !== false,
          },
        }
      : {}),
  };
}

export function serializeChitEngineConfig(cfg: ChitEngineConfig): string {
  return JSON.stringify(cfg);
}

/** Resolve engine type safely for legacy rows that lack `chitEngineType`. */
export function resolveEngineTypeFromGroup(group: {
  chitEngineType?: string | null;
  auctionType?: string | null;
}): ChitEngineType {
  if (isChitEngineType(group.chitEngineType)) return group.chitEngineType;
  if (group.auctionType === 'lottery') return 'PURE_LOTTERY';
  if (group.auctionType === 'fixed_rotation') return 'FIXED_ROTATION';
  return 'AUCTION_STANDARD';
}

export function mapBiddingModeToAuctionType(
  engineType: ChitEngineType,
  biddingMode?: ChitBiddingMode | null,
): 'open_manual' | 'open_live' | 'sealed' | 'lottery' | 'fixed_rotation' {
  const item = CHIT_ENGINE_CATALOG[engineType];
  if (!item.supportsBidding) return item.defaultAuctionType;
  if (biddingMode === 'OPEN_LIVE' || biddingMode === 'ONLINE_APP') return 'open_live';
  if (biddingMode === 'SEALED_TENDER') return 'sealed';
  if (biddingMode === 'OPEN_MANUAL') return 'open_manual';
  if (biddingMode === 'NONE') return 'lottery';
  return item.defaultAuctionType;
}

export function isBiddingEnabledForPeriod(
  group: {
    chitEngineType?: string | null;
    auctionType?: string | null;
    engineConfig?: string | null;
  },
  periodNumber: number,
): boolean {
  const engineType = resolveEngineTypeFromGroup(group);
  const catalog = CHIT_ENGINE_CATALOG[engineType];
  if (!catalog.supportsBidding) return false;
  if (['lottery', 'fixed_rotation'].includes(group.auctionType ?? '')) return false;

  const cfg = parseChitEngineConfig(group.engineConfig, engineType);
  if (cfg.biddingMode === 'NONE') return false;

  if (engineType === 'HYBRID_SPLIT_PHASE') {
    const reservedCount = cfg.hybridSplitPhase?.reservedCyclesCount ?? 0;
    if (periodNumber <= reservedCount) return false;
  }
  if (cfg.foremanCompensation.reservedForemanCycles.includes(periodNumber)) {
    return false;
  }
  if (
    periodNumber === 1 &&
    (cfg.foremanCompensation.mode === 'FREE_TICKET_CYCLE_1')
  ) {
    return false;
  }
  if (
    periodNumber === 2 &&
    (cfg.foremanCompensation.mode === 'FREE_TICKET_CYCLE_2')
  ) {
    return false;
  }
  return true;
}

export type PeriodRoomMode =
  | 'OPEN_AUCTION'
  | 'SEALED_TENDER'
  | 'LOTTERY_DRAW'
  | 'CONSENSUS'
  | 'FIXED_ROTATION';

const FIXED_ROTATION_ENGINES = new Set<ChitEngineType>([
  'FIXED_ROTATION',
  'GOLD_VALUE_ACCUMULATION',
  'GOLD_WEIGHT_ACCUMULATION',
  'FESTIVAL_COMMODITY',
]);

/**
 * Resolves the canonical room experience for a chit group cycle so each chit
 * template renders only relevant controls (bell/bidding vs lottery drum vs consensus/rotation).
 */
export function resolvePeriodRoomMode(
  group: {
    chitEngineType?: string | null;
    auctionType?: string | null;
    engineConfig?: string | null;
    hasForemanTicket?: boolean | null;
  },
  periodNumber: number,
): PeriodRoomMode {
  if (periodNumber === 1 && group.hasForemanTicket) {
    return 'FIXED_ROTATION';
  }
  if (isBiddingEnabledForPeriod(group, periodNumber)) {
    return group.auctionType === 'sealed' ? 'SEALED_TENDER' : 'OPEN_AUCTION';
  }
  const engineType = resolveEngineTypeFromGroup(group);
  if (engineType === 'NEED_BASED_CONSENSUS') {
    return 'CONSENSUS';
  }
  if (group.auctionType === 'fixed_rotation' || FIXED_ROTATION_ENGINES.has(engineType)) {
    return 'FIXED_ROTATION';
  }
  const cfg = parseChitEngineConfig(group.engineConfig, engineType);
  if (
    cfg.foremanCompensation.reservedForemanCycles.includes(periodNumber) ||
    (periodNumber === 1 && cfg.foremanCompensation.mode === 'FREE_TICKET_CYCLE_1') ||
    (periodNumber === 2 && cfg.foremanCompensation.mode === 'FREE_TICKET_CYCLE_2') ||
    (engineType === 'HYBRID_SPLIT_PHASE' &&
      periodNumber <= (cfg.hybridSplitPhase?.reservedCyclesCount ?? 0))
  ) {
    return 'FIXED_ROTATION';
  }
  return 'LOTTERY_DRAW';
}

/** Whether 3-bell countdown controls apply to this cycle. */
export function supportsBellForPeriod(
  group: {
    chitEngineType?: string | null;
    auctionType?: string | null;
    engineConfig?: string | null;
    hasForemanTicket?: boolean | null;
    bellEnabled?: boolean | null;
  },
  periodNumber: number,
): boolean {
  return resolvePeriodRoomMode(group, periodNumber) === 'OPEN_AUCTION' && Boolean(group.bellEnabled);
}
