import { coinGeckoId } from "./coinMap";

export type PriceResult = {
  usd: number;
  thb: number;
  usdThb: number;
  sourceNote?: string;
};

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`CoinGecko request failed: ${response.status}`);
  }
  return response.json();
}

export async function getCurrentPrice(symbol: string): Promise<PriceResult> {
  const id = coinGeckoId(symbol);
  const data = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,thb`, {
    next: { revalidate: 60 }
  });
  const usd = Number(data[id]?.usd);
  const thb = Number(data[id]?.thb);
  if (!usd || !thb) {
    throw new Error("ไม่สามารถดึงราคาปัจจุบันของเหรียญนี้ได้");
  }
  return { usd, thb, usdThb: thb / usd };
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
