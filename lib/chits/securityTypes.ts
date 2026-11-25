import type { ChitSecurityCollateralType } from './engineTypes';

export interface SecurityDocumentSpec {
  key: string;
  type: string;
  label: string;
  accept: string;
}

export interface SecurityTypeSpec {
  type: ChitSecurityCollateralType;
  label: string;
  hint: string;
  showGuarantorMember: boolean;
  showValue: boolean;
  valueLabel: string;
  showPartyName: boolean;
  partyNameLabel: string;
  showPartyPhone: boolean;
  partyPhoneLabel: string;
  showDetails: boolean;
  detailsLabel: string;
  detailsPlaceholder: string;
  documents: readonly SecurityDocumentSpec[];
}

export const SECURITY_TYPE_SPECS: Record<ChitSecurityCollateralType, SecurityTypeSpec> = {
  INTERNAL_GUARANTOR_JAMEEN: {
    type: 'INTERNAL_GUARANTOR_JAMEEN',
    label: 'Internal Guarantor (Jameen)',
    hint: 'Locks a fellow non-defaulting subscriber ticket until all guaranteed periods settle, or records an external personal guarantor.',
    showGuarantorMember: true,
    showValue: false,
    valueLabel: 'Guarantee Limit',
    showPartyName: true,
    partyNameLabel: 'External Guarantor Name (if non-member)',
    showPartyPhone: true,
    partyPhoneLabel: 'Guarantor Phone',
    showDetails: true,
    detailsLabel: 'Guarantee Undertaking / Notes',
    detailsPlaceholder: 'e.g. Co-subscriber ticket #4 standing Jameen surety for remaining cycles',
    documents: [
      { key: 'guarantorPhoto', type: 'guarantor_photo', label: 'Guarantor Photo', accept: 'image/*' },
      { key: 'guarantorKyc', type: 'guarantor_kyc', label: 'Guarantor KYC (ID / Aadhaar / PAN)', accept: 'image/*,.pdf' },
    ],
  },
  PROMISSORY_NOTE: {
    type: 'PROMISSORY_NOTE',
    label: 'Promissory Note',
    hint: 'Demand Promissory Note (DPN) executed by the prized subscriber with stamp & witness verification.',
    showGuarantorMember: false,
    showValue: true,
    valueLabel: 'Promissory Note Amount',
    showPartyName: true,
    partyNameLabel: 'Co-Executant / Witness Name',
    showPartyPhone: true,
    partyPhoneLabel: 'Witness Phone',
    showDetails: true,
    detailsLabel: 'DPN Reference, Stamp Duty & Execution Date',
    detailsPlaceholder: 'e.g. DPN #412 dated 20-Jun-2026 on Rs. 100 e-Stamp paper',
    documents: [
      { key: 'promissoryNote', type: 'promissory_note', label: 'Signed Promissory Note Scan', accept: 'image/*,.pdf' },
      { key: 'witnessKyc', type: 'witness_kyc', label: 'Executant / Witness KYC', accept: 'image/*,.pdf' },
    ],
  },
  POST_DATED_CHEQUE: {
    type: 'POST_DATED_CHEQUE',
    label: 'Post-Dated Cheque (PDC)',
    hint: 'Blank or dated security cheques covering future chit instalments.',
    showGuarantorMember: false,
    showValue: true,
    valueLabel: 'Total Cheque Value',
    showPartyName: false,
    partyNameLabel: 'Account Holder Name',
    showPartyPhone: false,
    partyPhoneLabel: 'Contact Phone',
    showDetails: true,
    detailsLabel: 'Bank Name, Branch & Cheque Number(s)',
    detailsPlaceholder: 'e.g. SBI Pollachi, Cheque #004511–004515',
    documents: [
      { key: 'securityCheque', type: 'security_cheque', label: 'Post-Dated Cheque Image(s)', accept: 'image/*,.pdf' },
      { key: 'bankProof', type: 'bank_proof', label: 'Cancelled Cheque / Bank Passbook', accept: 'image/*,.pdf' },
    ],
  },
  GOLD_PLEDGE: {
    type: 'GOLD_PLEDGE',
    label: 'Gold Pledge',
    hint: 'Physical gold ornaments pledged against future chit liability.',
    showGuarantorMember: false,
    showValue: true,
    valueLabel: 'Appraised Gold Value',
    showPartyName: false,
    partyNameLabel: 'Appraiser Name',
    showPartyPhone: false,
    partyPhoneLabel: 'Appraiser Phone',
    showDetails: true,
    detailsLabel: 'Ornament Description, Net Weight (g) & Purity',
    detailsPlaceholder: 'e.g. 22K Gold Bangles (2 pcs) — Gross 24.5g, Net 23.8g',
    documents: [
      { key: 'goldPhoto', type: 'gold_photo', label: 'Gold Ornament Photo', accept: 'image/*' },
      { key: 'goldAppraisal', type: 'gold_appraisal', label: 'Gold Assay / Valuation Slip', accept: 'image/*,.pdf' },
    ],
  },
  PROPERTY_DOCUMENT: {
    type: 'PROPERTY_DOCUMENT',
    label: 'Property Document',
    hint: 'Original registered title deed / mortgage security against remaining cycles.',
    showGuarantorMember: false,
    showValue: true,
    valueLabel: 'Property Valuation',
    showPartyName: false,
    partyNameLabel: 'Title Holder Name',
    showPartyPhone: false,
    partyPhoneLabel: 'Phone',
    showDetails: true,
    detailsLabel: 'Document / Deed No., Survey No. & Sub-Registrar',
    detailsPlaceholder: 'e.g. Doc #2189/2021, S.F.No 142/2, SRO Tiruppur',
    documents: [
      { key: 'propertyDeed', type: 'property_deed', label: 'Registered Title / Sale Deed', accept: 'image/*,.pdf' },
      { key: 'propertyEc', type: 'property_ec', label: 'EC & Latest Tax Receipt', accept: 'image/*,.pdf' },
    ],
  },
  FD_LIEN: {
    type: 'FD_LIEN',
    label: 'FD Lien',
    hint: 'Bank or treasury Fixed Deposit receipt marked with foreman lien.',
    showGuarantorMember: false,
    showValue: true,
    valueLabel: 'FD Lien Value',
    showPartyName: false,
    partyNameLabel: 'Depositor Name',
    showPartyPhone: false,
    partyPhoneLabel: 'Branch Contact',
    showDetails: true,
    detailsLabel: 'Bank Name, FD Account / Receipt No. & Maturity Date',
    detailsPlaceholder: 'e.g. Indian Bank FD #68291045, Matures 15-Dec-2027',
    documents: [
      { key: 'fdReceipt', type: 'fd_receipt', label: 'FD Receipt / Certificate', accept: 'image/*,.pdf' },
      { key: 'fdLienLetter', type: 'fd_lien_letter', label: 'Bank Lien Marking Letter', accept: 'image/*,.pdf' },
    ],
  },
  NONE: {
    type: 'NONE',
    label: 'None (No Collateral / Waived)',
    hint: 'Clean release without physical or guarantor collateral.',
    showGuarantorMember: false,
    showValue: false,
    valueLabel: 'Value',
    showPartyName: false,
    partyNameLabel: 'Name',
    showPartyPhone: false,
    partyPhoneLabel: 'Phone',
    showDetails: true,
    detailsLabel: 'Approval / Waiver Notes',
    detailsPlaceholder: 'e.g. Last-cycle payout or foreman-approved collateral waiver',
    documents: [],
  },
};

export const CANONICAL_SECURITY_OPTIONS: readonly { value: ChitSecurityCollateralType; label: string }[] = [
  { value: 'INTERNAL_GUARANTOR_JAMEEN', label: SECURITY_TYPE_SPECS.INTERNAL_GUARANTOR_JAMEEN.label },
  { value: 'PROMISSORY_NOTE', label: SECURITY_TYPE_SPECS.PROMISSORY_NOTE.label },
  { value: 'POST_DATED_CHEQUE', label: SECURITY_TYPE_SPECS.POST_DATED_CHEQUE.label },
  { value: 'GOLD_PLEDGE', label: SECURITY_TYPE_SPECS.GOLD_PLEDGE.label },
  { value: 'PROPERTY_DOCUMENT', label: SECURITY_TYPE_SPECS.PROPERTY_DOCUMENT.label },
  { value: 'FD_LIEN', label: SECURITY_TYPE_SPECS.FD_LIEN.label },
  { value: 'NONE', label: SECURITY_TYPE_SPECS.NONE.label },
];

const LEGACY_TO_CANONICAL: Record<string, ChitSecurityCollateralType> = {
  guarantor: 'INTERNAL_GUARANTOR_JAMEEN',
  cheque: 'POST_DATED_CHEQUE',
  gold: 'GOLD_PLEDGE',
  property: 'PROPERTY_DOCUMENT',
  fd: 'FD_LIEN',
  none: 'NONE',
};

export function normalizeSecurityType(raw?: string | null): ChitSecurityCollateralType {
  if (!raw) return 'INTERNAL_GUARANTOR_JAMEEN';
  const trimmed = raw.trim();
  if (trimmed in SECURITY_TYPE_SPECS) {
    return trimmed as ChitSecurityCollateralType;
  }
  const lower = trimmed.toLowerCase();
  if (lower in LEGACY_TO_CANONICAL) {
    return LEGACY_TO_CANONICAL[lower];
  }
  if (lower === 'pending') return 'INTERNAL_GUARANTOR_JAMEEN';
  return 'INTERNAL_GUARANTOR_JAMEEN';
}

export function getSecurityTypeSpec(raw?: string | null): SecurityTypeSpec {
  return SECURITY_TYPE_SPECS[normalizeSecurityType(raw)];
}

export const ALL_SECURITY_DOCUMENT_SPECS: readonly SecurityDocumentSpec[] = (() => {
  const seen = new Set<string>();
  const list: SecurityDocumentSpec[] = [];
  for (const spec of Object.values(SECURITY_TYPE_SPECS)) {
    for (const doc of spec.documents) {
      if (!seen.has(doc.type)) {
        seen.add(doc.type);
        list.push(doc);
      }
    }
  }
  return list;
})();

export const ALLOWED_SECURITY_DOCUMENT_TYPES = new Set<string>(
  ALL_SECURITY_DOCUMENT_SPECS.map((d) => d.type),
);

export const SECURITY_DOCUMENT_LABELS: Record<string, string> = Object.fromEntries(
  ALL_SECURITY_DOCUMENT_SPECS.map((d) => [d.type, d.label]),
);
