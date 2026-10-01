import { FEATURE_FLAG_KEYS } from '@/lib/features';
import { THEME_SETTING_KEY } from '@/lib/themes';

/** Which role may write each AppSetting key from the v1 API (SEC-08). */
export type SettingRole = 'admin' | 'superadmin' | 'developer';

export const ROLE_RANK: Record<string, number> = {
  developer: 3,
  superadmin: 2,
  admin: 1,
};

export const DEAD_KEYS = new Set([
  'bulk_collection_allowed',
  'bulk_limit_per_agent',
  'bureau_member_id',
  'bureau_api_key',
  'bureau_pulls_enabled',
  'npa_threshold_days',
  'npa_penalty_rate',
  'session_timeout_minutes',
]);

export const SECRET_KEYS = new Set([
  'msg91_auth_key',
  'smtp_pass',
  'kyc_digio_client_secret',
]);

export const SETTING_KEY_MIN_ROLE: Record<string, SettingRole> = {
  // System keys (developer only)
  app_name: 'developer',
  currency: 'developer',
  currency_symbol: 'developer',
  timezone: 'developer',
  midnight_cutoff: 'developer',
  allow_weekend_collection: 'developer',
  kyc_method: 'developer',
  loan_prefix_daily: 'developer',
  loan_prefix_weekly: 'developer',
  loan_prefix_biweekly: 'developer',
  loan_prefix_monthly: 'developer',
  bureau_egress_ip: 'developer',
  tally_export_max_vouchers: 'developer',
  customer_import_max_rows: 'developer',
  nach_max_retries: 'developer',
  nach_retry_interval_days: 'developer',
  nach_present_days_before: 'developer',
  kyc_digio_client_id: 'developer',
  kyc_digio_client_secret: 'developer',
  phone_country_code: 'developer',

  // Feature flags (superadmin only)
  ...Object.fromEntries(FEATURE_FLAG_KEYS.map((key) => [key, 'superadmin' as SettingRole])),

  // Theme & branding (superadmin only)
  [THEME_SETTING_KEY]: 'superadmin',
  primary_color: 'superadmin',
  primary_dark: 'superadmin',
  primary_light: 'superadmin',
  accent_color: 'superadmin',

  // Payment / UPI (admin+)
  upi_id: 'admin',
  receipt_pdf_active: 'admin',
  upi_manual_verification: 'admin',
  upi_qr_url: 'admin',

  // Penalty settings (admin+)
  default_penalty_per_day: 'admin',
  penalty_grace_period: 'admin',
  penalty_max_cap: 'admin',

  // Notifications (admin+)
  whatsapp_sms_active: 'admin',
  notify_channel_sms: 'admin',
  notify_channel_whatsapp: 'admin',
  notify_channel_email: 'admin',
  notify_event_payment_received: 'admin',
  notify_event_due_reminder: 'admin',
  notify_event_loan_disbursed: 'admin',
  notify_event_loan_overdue: 'admin',
  notify_event_loan_closed: 'admin',
  notify_event_penalty_accrued: 'admin',
  msg91_sender_id: 'admin',
  msg91_whatsapp_number: 'admin',
  msg91_auth_key: 'admin',
  smtp_host: 'admin',
  smtp_port: 'admin',
  smtp_user: 'admin',
  smtp_pass: 'admin',
  smtp_from_name: 'admin',
};

export const SETTING_GROUPS: Record<string, string> = {
  theme_preset: 'branding',
  primary_color: 'branding',
  primary_dark: 'branding',
  primary_light: 'branding',
  accent_color: 'branding',
  upi_id: 'payment',
  receipt_pdf_active: 'payment',
  upi_manual_verification: 'payment',
  upi_qr_url: 'payment',
  default_penalty_per_day: 'penalty',
  penalty_grace_period: 'penalty',
  penalty_max_cap: 'penalty',
  whatsapp_sms_active: 'notification',
  notify_channel_sms: 'notification',
  notify_channel_whatsapp: 'notification',
  notify_channel_email: 'notification',
  notify_event_payment_received: 'notification',
  notify_event_due_reminder: 'notification',
  notify_event_loan_disbursed: 'notification',
  notify_event_loan_overdue: 'notification',
  notify_event_loan_closed: 'notification',
  notify_event_penalty_accrued: 'notification',
  msg91_sender_id: 'notification',
  msg91_whatsapp_number: 'notification',
  msg91_auth_key: 'notification',
  smtp_host: 'notification',
  smtp_port: 'notification',
  smtp_user: 'notification',
  smtp_pass: 'notification',
  smtp_from_name: 'notification',
};
