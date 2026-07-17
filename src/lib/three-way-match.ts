export interface ThreeWayLine {
  description: string;
  orderedQty: number;
  receivedQty: number;
  billedQty: number;
  unitPrice: number;
  billedUnitPrice: number;
}

export interface ThreeWayVariance {
  description: string;
  orderedQty: number;
  receivedQty: number;
  billedQty: number;
  unitPrice: number;
  billedUnitPrice: number;
  qtyVariance: number;
  billQtyVariance: number;
  priceVariance: number;
  priceVariancePct: number;
  qtyWithinTolerance: boolean;
  priceWithinTolerance: boolean;
  isMatched: boolean;
}

export function computeThreeWayVariance(
  line: ThreeWayLine,
  tolerancePct = 5
): ThreeWayVariance {
  const qtyVariance = line.receivedQty - line.orderedQty;
  const billQtyVariance = line.billedQty - line.receivedQty;
  const priceVariance = line.billedUnitPrice - line.unitPrice;
  const priceVariancePct =
    Math.abs(line.unitPrice) > 0.001 ? (priceVariance / line.unitPrice) * 100 : 0;

  const qtyWithinTolerance =
    Math.abs(qtyVariance) <= 0.001 && Math.abs(billQtyVariance) <= 0.001;
  const priceWithinTolerance = Math.abs(priceVariancePct) <= tolerancePct;

  return {
    description: line.description,
    orderedQty: line.orderedQty,
    receivedQty: line.receivedQty,
    billedQty: line.billedQty,
    unitPrice: line.unitPrice,
    billedUnitPrice: line.billedUnitPrice,
    qtyVariance,
    billQtyVariance,
    priceVariance,
    priceVariancePct,
    qtyWithinTolerance,
    priceWithinTolerance,
    isMatched: qtyWithinTolerance && priceWithinTolerance,
  };
}

export function assertThreeWayMatch(lines: ThreeWayVariance[]) {
  const failures = lines.filter((l) => !l.isMatched);
  if (failures.length === 0) return;

  const summary = failures
    .map((l) => `${l.description}: qty Δ${l.qtyVariance}, price Δ${l.priceVariancePct.toFixed(1)}%`)
    .join("; ");
  throw new Error(`Three-way match failed — ${summary}`);
}
