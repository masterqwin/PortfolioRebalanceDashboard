import { NextRequest, NextResponse } from "next/server";
import { calculatePortfolio } from "@/lib/calculations";
import { PRICE_CACHE_TTL_MS } from "@/lib/config";
import { getAllocations, getCashBalance, getHoldings, getRebalanceHistory, getSnapshots, getTransactionHistory, updateHoldingPrices } from "@/lib/db";
import { getCurrentPrices } from "@/lib/prices";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const holdings = await getHoldings();
  const forceRefresh = request.nextUrl.searchParams.get("force") === "1";
  const now = Date.now();
  const staleHoldings = holdings.filter((item) => {
    const age = now - new Date(item.updatedAt).getTime();
    return forceRefresh || !Number.isFinite(age) || age > PRICE_CACHE_TTL_MS;
  });
  const updatedSymbols: string[] = [];
  const failedSymbols: string[] = [];
  let warning: string | undefined;
  let priceRows: { symbol: string; currentPriceUsd: number; currentPriceThb: number; updatedAt: string; usdThb: number }[] = [];

  if (staleHoldings.length > 0) {
    try {
      const prices = await getCurrentPrices(staleHoldings.map((item) => item.symbol));
      priceRows = staleHoldings.map((item) => {
        const price = prices[item.symbol];
        updatedSymbols.push(item.symbol);
        return {
          symbol: item.symbol,
          currentPriceUsd: price.usd,
          currentPriceThb: price.thb,
          updatedAt: new Date().toISOString(),
          usdThb: price.usdThb
        };
      });
      await updateHoldingPrices(priceRows);
    } catch {
      failedSymbols.push(...staleHoldings.map((item) => item.symbol));
      warning = "CoinGecko จำกัดการเรียกข้อมูลชั่วคราว ระบบใช้ราคาล่าสุดที่บันทึกไว้แทน";
    }
  }

  const refreshedHoldings = await getHoldings();
  const allocations = await getAllocations();
  const cash = await getCashBalance();
  const priceSource = refreshedHoldings.find((item) => item.currentPriceUsd > 0);
  const usdThb = priceRows[0]?.usdThb ?? (priceSource ? priceSource.currentPriceThb / priceSource.currentPriceUsd : 36);
  const portfolio = calculatePortfolio(refreshedHoldings, allocations, usdThb, cash);

  return NextResponse.json({
    rows: portfolio.rows,
    allocations,
    snapshots: await getSnapshots(),
    rebalanceHistory: await getRebalanceHistory(),
    transactionHistory: await getTransactionHistory(),
    cash,
    summary: portfolio.summary,
    usdThb,
    priceStatus: {
      ok: failedSymbols.length === 0,
      warning,
      failedSymbols,
      updatedSymbols
    }
  });
}
