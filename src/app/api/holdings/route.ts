import { NextRequest, NextResponse } from "next/server";
import { getAllocations, upsertHolding } from "@/lib/db";
import { normalizeSymbol } from "@/lib/coinMap";
import { DEFAULT_TRADING_FEE_PERCENT } from "@/lib/config";
import { getCurrentPrice, getHistoricalPrice } from "@/lib/prices";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const symbol = normalizeSymbol(String(body.symbol ?? ""));
  const amount = Number(body.amount);
  const date = String(body.date ?? "");
  const time = String(body.time ?? "");

  if (!symbol || !date || !time || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }

  const entryDateTime = new Date(`${date}T${time}:00`).toISOString();
  const allocations = await getAllocations();
  const allocation = allocations.find((item) => item.coin === symbol);
  const targetPercent = allocation?.targetPercent ?? 0;
  let historical;
  let current;
  try {
    historical = await getHistoricalPrice(symbol, entryDateTime);
    current = await getCurrentPrice(symbol);
  } catch {
    return NextResponse.json(
      { message: "ไม่สามารถดึงราคาย้อนหลังของเหรียญนี้ได้ กรุณาตรวจ Symbol หรือเลือกวันที่ใหม่" },
      { status: 400 }
    );
  }
  const now = new Date().toISOString();

  await upsertHolding({
    symbol,
    amount,
    targetPercent,
    feePercent: DEFAULT_TRADING_FEE_PERCENT,
    entryDateTime,
    entryPriceUsd: historical.usd,
    entryPriceThb: historical.thb,
    entryValueUsd: amount * historical.usd,
    entryValueThb: amount * historical.thb,
    currentPriceUsd: current.usd,
    currentPriceThb: current.thb,
    updatedAt: now
  });

  return NextResponse.json({
    ok: true,
    warning: allocation ? null : "เหรียญนี้ยังไม่มีสัดส่วนเป้าหมาย กรุณาเพิ่มในหน้าสัดส่วนเป้าหมาย",
    sourceNote: historical.sourceNote ?? null
  });
}
