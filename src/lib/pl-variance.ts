export function computePeriodVariance(
  current: { revenue: number; costOfGoodsSold: number; grossProfit: number; expenses: number; netProfit: number },
  prior: { revenue: number; costOfGoodsSold: number; grossProfit: number; expenses: number; netProfit: number }
) {
  const pct = (cur: number, prev: number) =>
    Math.abs(prev) > 0.001 ? ((cur - prev) / Math.abs(prev)) * 100 : null;

  return {
    revenue: { amount: current.revenue - prior.revenue, percent: pct(current.revenue, prior.revenue) },
    costOfGoodsSold: {
      amount: current.costOfGoodsSold - prior.costOfGoodsSold,
      percent: pct(current.costOfGoodsSold, prior.costOfGoodsSold),
    },
    grossProfit: {
      amount: current.grossProfit - prior.grossProfit,
      percent: pct(current.grossProfit, prior.grossProfit),
    },
    expenses: {
      amount: current.expenses - prior.expenses,
      percent: pct(current.expenses, prior.expenses),
    },
    netProfit: {
      amount: current.netProfit - prior.netProfit,
      percent: pct(current.netProfit, prior.netProfit),
    },
  };
}
