export async function generateChitReceiptNo(tx: any, input: {
  tenantId: string;
  branchCode?: string | null;
  receiptType: 'collection' | 'penalty' | 'payout' | 'reversal' | 'dividend_payout';
  date?: Date;
}) {
  const date = input.date ?? new Date();
  const yyyy = date.getFullYear();
  const prefixMap = {
    collection: 'CC',
    penalty: 'CPN',
    payout: 'CPO',
    reversal: 'CRV',
    dividend_payout: 'CDP',
  } as const;
  const prefix = `${prefixMap[input.receiptType]}-${input.branchCode || 'BR'}-${yyyy}`;
  const count = await tx.chitReceipt.count({
    where: { tenantId: input.tenantId, receiptNo: { startsWith: prefix } },
  });

  return `${prefix}-${String(count + 1).padStart(6, '0')}`;
}
