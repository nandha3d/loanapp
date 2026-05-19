function normalizePhone(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

export function validateGuarantorPhone(input: {
  customerPhone: string | null | undefined;
  guarantorPhone: string | null | undefined;
}): { valid: true } | { valid: false; error: string } {
  const customerPhone = normalizePhone(input.customerPhone);
  const guarantorPhone = normalizePhone(input.guarantorPhone);

  if (customerPhone && guarantorPhone && customerPhone === guarantorPhone) {
    return { valid: false, error: 'Guarantor phone cannot match customer phone.' };
  }

  return { valid: true };
}
