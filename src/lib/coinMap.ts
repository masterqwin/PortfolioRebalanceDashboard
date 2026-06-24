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
  return COIN_GECKO_IDS[normalizeSymbol(symbol)] ?? normalizeSymbol(symbol).toLowerCase();
}
