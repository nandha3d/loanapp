import type { AppType } from './appConfig';

export type SettingsSubscriptionFlags = {
  whatsappSmsEnabled?: boolean;
  bureauEnabled?: boolean;
  npaEnabled?: boolean;
};

const LENDING_APP_TYPES: readonly AppType[] = [
  'microlending',
  'autofinance',
  'goldloan',
  'property',
  'productfinance',
];

export function isLendingAppType(appType: string): appType is Exclude<AppType, 'chitfunds'> {
  return LENDING_APP_TYPES.includes(appType as AppType);
}

export function getSettingsTabsForAppType(
  appType: string,
  subscription: SettingsSubscriptionFlags = {},
): string[] {
  const tabs = ['routes'];
  if (isLendingAppType(appType)) tabs.push('penalty', 'packages');
  if (appType === 'goldloan') tabs.push('goldmaster');
  if (appType === 'chitfunds') tabs.push('chittypes');
  tabs.push('payment', 'integrations');
  if (subscription.whatsappSmsEnabled) tabs.push('notifications');
  tabs.push('bulk');
  if (isLendingAppType(appType) && subscription.bureauEnabled) tabs.push('bureau');
  if (isLendingAppType(appType) && subscription.npaEnabled) tabs.push('npa');
  tabs.push('branches', 'system');
  if (isLendingAppType(appType)) tabs.push('features');
  tabs.push('theme', 'data', 'users', 'security');
  return tabs;
}

export function normalizeSettingsTab(
  appType: string,
  requestedTab: string | null | undefined,
  subscription: SettingsSubscriptionFlags = {},
): string {
  if (!requestedTab) return 'routes';
  return getSettingsTabsForAppType(appType, subscription).includes(requestedTab) ? requestedTab : 'routes';
}

export type CustomerRouteMode = 'ENABLED_OPTIONAL' | 'ENABLED_REQUIRED' | 'DISABLED';

export function customerRouteSettingKey(appType: string): string {
  return `customer_route_mode_${appType || 'microlending'}`;
}

export function resolveCustomerRouteMode(
  appType: string,
  rawValue?: string | null,
): CustomerRouteMode {
  if (rawValue === 'DISABLED' || rawValue === 'ENABLED_OPTIONAL' || rawValue === 'ENABLED_REQUIRED') {
    return rawValue;
  }
  return appType === 'chitfunds' ? 'ENABLED_OPTIONAL' : 'ENABLED_REQUIRED';
}
