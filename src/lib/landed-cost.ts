export interface LandedCostItem {
  qty: number;
  unitPrice: number;
}

/** Allocate transport + loading across line items by value share. */
export function allocateLandedUnitCosts(
  items: LandedCostItem[],
  transportCost: number,
  loadingCost: number
): number[] {
  const landedTotal = transportCost + loadingCost;
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

  return items.map((item) => {
    if (item.qty <= 0) return item.unitPrice;
    const itemValue = item.qty * item.unitPrice;
    const share = subtotal > 0 ? (landedTotal * itemValue) / subtotal : 0;
    return item.unitPrice + share / item.qty;
  });
}
