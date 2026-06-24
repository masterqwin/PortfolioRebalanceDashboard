import { NextRequest, NextResponse } from "next/server";
import { upsertHolding } from "@/lib/db";
import { normalizeSymbol } from "@/lib/coinMap";
import { getCurrentPrice, getHistoricalPrice } from "@/lib/prices";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const symbol = normalizeSymbol(String(body.symbol ?? ""));
  const amount = Number(body.amount);
  const targetPercent = Number(body.targetPercent);
  const feePercent = Number(body.feePercent);
  const date = String(body.date ?? "");
  const time = String(body.time ?? "");

  if (!symbol || !date || !time || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }

  const entryDateTime = new Date(`${date}T${time}:00`).toISOString();
  const historical = await getHistoricalPrice(symbol, entryDateTime);
  const current = await getCurrentPrice(symbol);
  const now = new Date().toISOString();

  await upsertHolding({
    symbol,
    amount,
    targetPercent: Number.isFinite(targetPercent) ? targetPercent : 0,
    feePercent: Number.isFinite(feePercent) ? feePercent : 0,
    entryDateTime,
    entryPriceUsd: historical.usd,
    currentPriceUsd: current.usd,
    currentPriceThb: current.thb,
    updatedAt: now
  });

  return NextResponse.json({ ok: true });
}
