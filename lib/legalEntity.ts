/**
 * The legal entity behind Zolo Funds — the ONLY place these facts live.
 * Used by every legal page and footer (and must match the Google Play
 * developer account, D-U-N-S record and Razorpay KYC exactly).
 *
 * If the business is incorporated later, change it here and in the Play
 * Console / Razorpay / D-U-N-S records at the same time.
 */
export const LEGAL = {
  product: 'Zolo Funds',
  tradeName: 'Animazon',
  proprietor: 'Nandhakumar Ganesan',
  constitution: 'sole proprietorship',
  udyam: 'UDYAM-TN-07-0135439',
  address: '155, Animazon, Narayana Valasu, Nasiyanur Road, Erode - 638011, Tamil Nadu, India',
  city: 'Erode',
  /** "Animazon (sole proprietorship of Nandhakumar Ganesan)" */
  operator: 'Animazon (sole proprietorship of Nandhakumar Ganesan)',
  grievanceOfficer: 'Nandhakumar Ganesan, Proprietor',
  supportEmail: 'support@zolofunds.com',
  grievanceEmail: 'grievance@zolofunds.com',
  phone: '+91 80894 05950',
} as const;
