import { NextResponse } from "next/server";
import { calculatePortfolio } from "@/lib/calculations";
import { addRebalanceHistory, addSnapshot, getAllocations, getHoldings } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const calculated = calculatePortfolio(await getHoldings(), await getAllocations(), 36);
  const rows = calculated.rows;
  const now = new Date().toISOString();
  await addSnapshot({
    snapshotDate: now,
    totalValueThb: calculated.summary.totalValueThb,
    topCoin: [...rows].sort((a, b) => b.currentPercent - a.currentPercent)[0]?.symbol ?? "-",
    topBuyCoin: [...rows].sort((a, b) => b.buyThb - a.buyThb)[0]?.symbol ?? "-",
    topSellCoin: [...rows].sort((a, b) => b.sellThb - a.sellThb)[0]?.symbol ?? "-"
  });
  await addRebalanceHistory(
    rows
      .filter((row) => row.action === "BUY" || row.action === "SELL")
      .map((row) => ({
        rebalanceDate: now,
        symbol: row.symbol,
        action: row.action as "BUY" | "SELL",
        amount: row.action === "BUY" ? row.buyAmount : row.sellAmount,
        valueThb: row.action === "BUY" ? row.buyThb : row.sellThb
      }))
      .filter((row) => row.valueThb > 0)
  );

  return NextResponse.json({ ok: true });
}
