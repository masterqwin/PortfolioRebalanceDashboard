import type { Allocation, Holding, PortfolioRow, PortfolioSummary } from "./types";

const DRIFT_HOLD_THRESHOLD = 1;

export function calculatePortfolio(holdings: Holding[], allocations: Allocation[], usdThb: number) {
  const totalValueUsdt = holdings.reduce((sum, item) => sum + item.amount * item.currentPriceUsd, 0);
  const totalValueThb = holdings.reduce((sum, item) => sum + item.amount * item.currentPriceThb, 0);

  const rows: PortfolioRow[] = holdings.map((item) => {
    const allocation = allocations.find((entry) => entry.coin === item.symbol);
    const targetPercent = allocation?.targetPercent ?? item.targetPercent ?? 0;
    const valueUsd = item.amount * item.currentPriceUsd;
    const valueThb = item.amount * item.currentPriceThb;
    const targetValueThb = (totalValueThb * targetPercent) / 100;
    const driftValueThb = targetValueThb - valueThb;
    const currentPercent = totalValueThb > 0 ? (valueThb / totalValueThb) * 100 : 0;
    const driftPercent = currentPercent - targetPercent;
    const action = Math.abs(driftPercent) <= DRIFT_HOLD_THRESHOLD ? "HOLD" : driftPercent < 0 ? "BUY" : "SELL";
    const buyThb = action === "BUY" ? Math.max(driftValueThb, 0) : 0;
    const sellThb = action === "SELL" ? Math.max(-driftValueThb, 0) : 0;

    return {
      ...item,
      targetPercent,
      valueUsd,
      valueThb,
      currentPercent,
      driftPercent,
      action,
      buyAmount: item.currentPriceThb > 0 ? buyThb / item.currentPriceThb : 0,
      sellAmount: item.currentPriceThb > 0 ? sellThb / item.currentPriceThb : 0,
      buyThb,
      sellThb,
      thbValue: valueThb
    };
  });

  const totalBuyThb = rows.reduce((sum, row) => sum + row.buyThb, 0);
  const totalSellThb = rows.reduce((sum, row) => sum + row.sellThb, 0);
  const totalAbsoluteDrift = rows.reduce((sum, row) => sum + Math.abs(row.driftPercent), 0);
  const healthScore = Math.max(0, Math.round(100 - totalAbsoluteDrift * 2));

  const summary: PortfolioSummary = {
    totalValueThb,
    totalValueUsdt,
    coinCount: holdings.length,
    updatedAt: holdings.reduce((latest, item) => (item.updatedAt > latest ? item.updatedAt : latest), ""),
    totalBuyThb,
    totalSellThb,
    healthScore,
    status: healthScore >= 90 ? "ไม่ต้องปรับพอร์ต" : "ควรปรับพอร์ต"
  };

  return { rows, summary, usdThb };
}

export function allocationTotal(allocations: Pick<Allocation, "targetPercent">[]) {
  return allocations.reduce((sum, item) => sum + Number(item.targetPercent), 0);
}
