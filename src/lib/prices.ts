import { coinGeckoId, normalizeSymbol } from "./coinMap";

type PriceResult = {
  usd: number;
  thb: number;
  usdThb: number;
};

function fallbackPrice(symbol: string): PriceResult {
  const prices: Record<string, number> = {
    ETH: 3500,
    SOL: 145,
    LINK: 16,
    AAVE: 92,
    TRX: 0.12,
    BNB: 580,
    PAXG: 2320
  };
  const usd = prices[normalizeSymbol(symbol)] ?? 1;
  const usdThb = 36;
  return { usd, thb: usd * usdThb, usdThb };
}

export async function getCurrentPrice(symbol: string): Promise<PriceResult> {
  const id = coinGeckoId(symbol);
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,thb`,
      { next: { revalidate: 60 } }
    );
    if (!response.ok) return fallbackPrice(symbol);
    const data = await response.json();
    const usd = Number(data[id]?.usd);
    const thb = Number(data[id]?.thb);
    if (!usd || !thb) return fallbackPrice(symbol);
    return { usd, thb, usdThb: thb / usd };
  } catch {
    return fallbackPrice(symbol);
  }
}

export async function getHistoricalPrice(symbol: string, isoDateTime: string): Promise<PriceResult> {
  const id = coinGeckoId(symbol);
  const timestamp = Math.floor(new Date(isoDateTime).getTime() / 1000);
  const from = timestamp - 1800;
  const to = timestamp + 1800;

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`,
      { cache: "no-store" }
    );
    if (!response.ok) return fallbackPrice(symbol);
    const data = await response.json();
    const closest = (data.prices ?? []).reduce(
      (best: [number, number] | null, price: [number, number]) => {
        if (!best) return price;
        return Math.abs(price[0] - timestamp * 1000) < Math.abs(best[0] - timestamp * 1000) ? price : best;
      },
      null
    );
    const usd = Number(closest?.[1]);
    if (!usd) return fallbackPrice(symbol);
    const current = await getCurrentPrice(symbol);
    return { usd, thb: usd * current.usdThb, usdThb: current.usdThb };
  } catch {
    return fallbackPrice(symbol);
  }
}
