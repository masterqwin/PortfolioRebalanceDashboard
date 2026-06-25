export type Holding = {
  id: number;
  symbol: string;
  amount: number;
  targetPercent: number;
  feePercent: number;
  entryDateTime: string;
  entryPriceUsd: number;
  entryPriceThb: number;
  entryValueUsd: number;
  entryValueThb: number;
  currentPriceUsd: number;
  currentPriceThb: number;
  updatedAt: string;
};

export type Allocation = {
  id: number;
  coin: string;
  role: string;
  targetPercent: number;
};

export type Snapshot = {
  id: number;
  snapshotDate: string;
  totalValueThb: number;
  topCoin: string;
  topBuyCoin: string;
  topSellCoin: string;
};

export type RebalanceHistory = {
  id: number;
  rebalanceDate: string;
  symbol: string;
  action: "BUY" | "SELL";
  amount: number;
  valueThb: number;
};

export type PortfolioRow = Holding & {
  valueUsd: number;
  valueThb: number;
  currentPercent: number;
  targetPercent: number;
  driftPercent: number;
  action: "BUY" | "SELL" | "HOLD";
  buyAmount: number;
  sellAmount: number;
  buyThb: number;
  sellThb: number;
  thbValue: number;
};

export type PortfolioSummary = {
  totalValueThb: number;
  totalValueUsdt: number;
  coinCount: number;
  updatedAt: string;
  totalBuyThb: number;
  totalSellThb: number;
  healthScore: number;
  status: "ไม่ต้องปรับพอร์ต" | "ควรปรับพอร์ต";
};

export type PortfolioState = {
  rows: PortfolioRow[];
  allocations: Allocation[];
  snapshots: Snapshot[];
  rebalanceHistory: RebalanceHistory[];
  summary: PortfolioSummary;
  usdThb: number;
};
