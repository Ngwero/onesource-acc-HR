export function computePurchaseInputVat(totalAmount: number, taxRatePercent: number): {
  netAmount: number;
  taxAmount: number;
} {
  if (taxRatePercent <= 0) {
    return { netAmount: totalAmount, taxAmount: 0 };
  }

  const rate = taxRatePercent / 100;
  const netAmount = totalAmount / (1 + rate);
  const taxAmount = totalAmount - netAmount;

  return {
    netAmount: Math.round(netAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
  };
}
