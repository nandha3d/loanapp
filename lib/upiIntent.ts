import QRCode from 'qrcode';

/**
 * Tier-0 cashless collection: build a standard UPI deep-link (intent) that any
 * UPI app reads, with the exact amount + a reference pre-filled. Money moves
 * bank-to-bank into the tenant's own VPA — no PSP, no API keys. Reconciliation
 * is a borrower "I've paid" claim + one-tap agent/admin confirmation (the `tr`
 * reference lets staff match it to the bank statement).
 */
export function buildUpiUri(input: {
  vpa: string;
  payeeName: string;
  amount: number;
  note?: string;
  ref?: string;
}): string {
  const params = new URLSearchParams({
    pa: input.vpa,
    pn: input.payeeName,
    am: input.amount.toFixed(2),
    cu: 'INR',
  });
  if (input.note) params.set('tn', input.note.slice(0, 50));
  // UPI `tr` (transaction ref) must be alphanumeric; trim our token to a safe id.
  if (input.ref) params.set('tr', input.ref.replace(/[^a-zA-Z0-9]/g, '').slice(0, 35));
  return `upi://pay?${params.toString()}`;
}

/** Renders the UPI intent as a scannable QR data URL (PNG). */
export async function buildUpiQrDataUrl(input: {
  vpa: string;
  payeeName: string;
  amount: number;
  note?: string;
  ref?: string;
}): Promise<{ uri: string; qrDataUrl: string }> {
  const uri = buildUpiUri(input);
  const qrDataUrl = await QRCode.toDataURL(uri, { width: 240, margin: 1 });
  return { uri, qrDataUrl };
}
