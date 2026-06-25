export const COIN_GECKO_IDS: Record<string, string> = {
  ETH: "ethereum",
  SOL: "solana",
  LINK: "chainlink",
  AAVE: "aave",
  TRX: "tron",
  BNB: "binancecoin",
  PAXG: "pax-gold"
};

export function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function coinGeckoId(symbol: string) {
  const id = COIN_GECKO_IDS[normalizeSymbol(symbol)];
  if (!id) {
    throw new Error("ยังไม่รองรับ Symbol นี้ กรุณาเพิ่ม CoinGecko mapping ก่อน");
  }
  return id;
}

export function isSupportedSymbol(symbol: string) {
  return Boolean(COIN_GECKO_IDS[normalizeSymbol(symbol)]);
}
