import { coinGeckoId, normalizeSymbol } from "./coinMap";

export type PriceResult = {
  usd: number;
  thb: number;
  usdThb: number;
  sourceNote?: string;
};

export type PriceMap = Record<string, PriceResult>;

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`CoinGecko request failed: ${response.status}`);
  }
  return response.json();
}

export async function getCurrentPrice(symbol: string): Promise<PriceResult> {
  const prices = await getCurrentPrices([symbol]);
  return prices[normalizeSymbol(symbol)];
}

export async function getCurrentPrices(symbols: string[]): Promise<PriceMap> {
  if (process.env.COINGECKO_FORCE_ERROR === "1") {
    throw new Error("CoinGecko request failed: forced");
  }
  const uniqueSymbols = Array.from(new Set(symbols.map(normalizeSymbol)));
  if (uniqueSymbols.length === 0) return {};
  const idBySymbol = Object.fromEntries(uniqueSymbols.map((symbol) => [symbol, coinGeckoId(symbol)]));
  const ids = Object.values(idBySymbol).join(",");
  const data = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,thb`, {
    next: { revalidate: 60 }
  });
  return Object.fromEntries(
    uniqueSymbols.map((symbol) => {
      const id = idBySymbol[symbol];
      const usd = Number(data[id]?.usd);
      const thb = Number(data[id]?.thb);
      if (!usd || !thb) {
        throw new Error("ไม่สามารถดึงราคาปัจจุบันของเหรียญนี้ได้");
      }
      return [symbol, { usd, thb, usdThb: thb / usd }];
    })
  );
}

export async function getHistoricalPrice(symbol: string, isoDateTime: string): Promise<PriceResult> {
  const id = coinGeckoId(symbol);
  const timestamp = Math.floor(new Date(isoDateTime).getTime() / 1000);
  const from = timestamp - 1800;
  const to = timestamp + 1800;

  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`,
    { cache: "no-store" }
  );
  const prices = (data.prices ?? []) as [number, number][];
  const closest = prices.reduce((best: [number, number] | null, price) => {
    if (!best) return price;
    return Math.abs(price[0] - timestamp * 1000) < Math.abs(best[0] - timestamp * 1000) ? price : best;
  }, null);
  const current = await getCurrentPrice(symbol);
  const hourlyUsd = Number(closest?.[1]);

  if (hourlyUsd) {
    return { usd: hourlyUsd, thb: hourlyUsd * current.usdThb, usdThb: current.usdThb };
  }

  const date = new Date(isoDateTime);
  const dailyData = await fetchJson(
    `https://api.coingecko.com/api/v3/coins/${id}/history?date=${String(date.getUTCDate()).padStart(2, "0")}-${String(
      date.getUTCMonth() + 1
    ).padStart(2, "0")}-${date.getUTCFullYear()}`,
    { cache: "no-store" }
  );
  const dailyUsd = Number(dailyData.market_data?.current_price?.usd);
  if (!dailyUsd) {
    throw new Error("ไม่สามารถดึงราคาย้อนหลังของเหรียญนี้ได้ กรุณาตรวจ Symbol หรือเลือกวันที่ใหม่");
  }
  return {
    usd: dailyUsd,
    thb: dailyUsd * current.usdThb,
    usdThb: current.usdThb,
    sourceNote: "ใช้ราคาย้อนหลังรายวันจาก CoinGecko"
  };
}
