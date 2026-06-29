// App type configuration for multi-app architecture
// Each admin is assigned to one appType and only sees that application

export type AppType = 'microlending' | 'autofinance' | 'chitfunds' | 'goldloan' | 'property' | 'productfinance';

export interface AppConfig {
  id: AppType;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  primaryColor: string;
  primaryDark: string;
  primaryLight: string;
  accentColor: string;
  logoText: [string, string]; // [first part, highlighted part]
}

export const APP_CONFIGS: Record<AppType, AppConfig> = {
  microlending: {
    id: 'microlending',
    name: 'Micro Lending',
    shortName: 'ML',
    icon: 'account_balance',
    description: 'Manage micro-loans, collections, penalties, and customer portfolios.',
    primaryColor: '#E67E22',
    primaryDark: '#D35400',
    primaryLight: '#FFF3E6',
    accentColor: '#F39C12',
    logoText: ['Loan', 'Track'],
  },
  autofinance: {
    id: 'autofinance',
    name: 'Auto Finance',
    shortName: 'AF',
    icon: 'directions_car',
    description: 'Vehicle financing, EMI management, and auto loan tracking.',
    primaryColor: '#2980B9',
    primaryDark: '#1A5276',
    primaryLight: '#EBF5FB',
    accentColor: '#3498DB',
    logoText: ['Auto', 'Finance'],
  },
  chitfunds: {
    id: 'chitfunds',
    name: 'Chit Funds',
    shortName: 'CF',
    icon: 'savings',
    description: 'Chit fund management, auctions, and member tracking.',
    primaryColor: '#27AE60',
    primaryDark: '#1E8449',
    primaryLight: '#EAFAF1',
    accentColor: '#2ECC71',
    logoText: ['Chit', 'Fund'],
  },
  goldloan: {
    id: 'goldloan',
    name: 'Gold Loan',
    shortName: 'GL',
    icon: 'workspace_premium',
    description: 'Gold-backed lending, valuation, LTV, packets, pledges, and release tracking.',
    primaryColor: '#B8860B',
    primaryDark: '#8B6914',
    primaryLight: '#FFF8E7',
    accentColor: '#DAA520',
    logoText: ['Gold', 'Loan'],
  },
  property: {
    id: 'property',
    name: 'Property Loan',
    shortName: 'PL',
    icon: 'home_work',
    description: 'Property-backed lending with mortgage document management and release tracking.',
    primaryColor: '#7D3C98',
    primaryDark: '#5B2C6F',
    primaryLight: '#F5EEF8',
    accentColor: '#A569BD',
    logoText: ['Property', 'Loan'],
  },
  productfinance: {
    id: 'productfinance',
    name: 'Product Finance',
    shortName: 'PF',
    icon: 'shopping_bag',
    description: 'Consumer-durable and product financing with dealer and EMI tracking.',
    primaryColor: '#16A085',
    primaryDark: '#117A65',
    primaryLight: '#E8F8F5',
    accentColor: '#1ABC9C',
    logoText: ['Product', 'Finance'],
  },
};

export function getAppConfig(appType: string): AppConfig {
  return APP_CONFIGS[appType as AppType] || APP_CONFIGS.microlending;
}

// Generate CSS custom properties for a given app theme
export function getAppThemeCSS(config: AppConfig): Record<string, string> {
  return {
    '--primary': config.primaryColor,
    '--primary-dark': config.primaryDark,
    '--primary-light': config.primaryLight,
    '--accent': config.accentColor,
  };
}
