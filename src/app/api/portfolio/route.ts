import { NextResponse } from "next/server";
import { calculatePortfolio } from "@/lib/calculations";
import { getAllocations, getHoldings, getRebalanceHistory, getSnapshots, updateHoldingPrices } from "@/lib/db";
import { getCurrentPrice } from "@/lib/prices";

export const runtime = "nodejs";

export async function GET() {
  const holdings = await getHoldings();
  const priceRows = await Promise.all(
    holdings.map(async (item) => {
      const price = await getCurrentPrice(item.symbol);
      return {
        symbol: item.symbol,
        currentPriceUsd: price.usd,
        currentPriceThb: price.thb,
        updatedAt: new Date().toISOString(),
        usdThb: price.usdThb
      };
    })
  );

  if (priceRows.length > 0) {
    await updateHoldingPrices(priceRows);
  }

  const refreshedHoldings = await getHoldings();
  const allocations = await getAllocations();
  const usdThb = priceRows[0]?.usdThb ?? 36;
  const portfolio = calculatePortfolio(refreshedHoldings, allocations, usdThb);

  return NextResponse.json({
    rows: portfolio.rows,
    allocations,
    snapshots: await getSnapshots(),
    rebalanceHistory: await getRebalanceHistory(),
    summary: portfolio.summary,
    usdThb
  });
}
