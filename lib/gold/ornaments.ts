/**
 * Pure ornament line-item math for gold/silver pledges — shared by web + mobile,
 * unit-tested. No I/O, never throws.
 */

export type OrnamentLineInput = {
  quantity?: number;
  grossWeightGrams?: number;
  wastageGrams?: number;
  netWeightGrams?: number;
  ratePerGram?: number;
};

export type OrnamentLine = {
  quantity: number;
  grossWeightGrams: number;
  wastageGrams: number;
  netWeightGrams: number;
  ratePerGram: number;
  value: number;
};

function clampNum(v: number | undefined): number {
  return Number.isFinite(v) && (v as number) > 0 ? (v as number) : 0;
}

/** Net weight = gross − wastage, unless an explicit net was entered. */
export function computeNetWeight(grossWeightGrams: number, wastageGrams: number): number {
  const net = clampNum(grossWeightGrams) - clampNum(wastageGrams);
  return net > 0 ? net : 0;
}

/** Resolve one line: derive net (if not given) and value = net × rate. */
export function resolveOrnamentLine(input: OrnamentLineInput): OrnamentLine {
  const gross = clampNum(input.grossWeightGrams);
  const wastage = clampNum(input.wastageGrams);
  const net = input.netWeightGrams != null && input.netWeightGrams > 0
    ? input.netWeightGrams
    : computeNetWeight(gross, wastage);
  const rate = clampNum(input.ratePerGram);
  const quantity = Number.isFinite(input.quantity) && (input.quantity as number) > 0
    ? Math.floor(input.quantity as number)
    : 1;
  return {
    quantity,
    grossWeightGrams: gross,
    wastageGrams: wastage,
    netWeightGrams: net,
    ratePerGram: rate,
    value: Math.round(net * rate),
  };
}

export type OrnamentTotals = {
  totalQuantity: number;
  totalGrossWeight: number;
  totalWastage: number;
  totalNetWeight: number;
  totalValue: number;
};

/** Aggregate the pledge header totals from its line items. */
export function ornamentTotals(items: OrnamentLineInput[]): OrnamentTotals {
  const lines = items.map(resolveOrnamentLine);
  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  return {
    totalQuantity: lines.reduce((s, l) => s + l.quantity, 0),
    totalGrossWeight: round3(lines.reduce((s, l) => s + l.grossWeightGrams, 0)),
    totalWastage: round3(lines.reduce((s, l) => s + l.wastageGrams, 0)),
    totalNetWeight: round3(lines.reduce((s, l) => s + l.netWeightGrams, 0)),
    totalValue: lines.reduce((s, l) => s + l.value, 0),
  };
}
