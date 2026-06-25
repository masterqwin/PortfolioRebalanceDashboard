import { NextRequest, NextResponse } from "next/server";
import { addTransactionHistory, deleteHolding, getAllocations, getHoldingBySymbol, updateHolding, upsertHolding } from "@/lib/db";
import { isSupportedSymbol, normalizeSymbol } from "@/lib/coinMap";
import { DEFAULT_TRADING_FEE_PERCENT, PRICE_CACHE_TTL_MS } from "@/lib/config";
import { getCurrentPrice, getHistoricalPrice } from "@/lib/prices";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const symbol = normalizeSymbol(String(body.symbol ?? ""));
  const side = String(body.side ?? "BUY").toUpperCase();
  const amount = Number(body.amount);
  const date = String(body.date ?? "");
  const time = String(body.time ?? "");

  if (!symbol || !date || !time || !Number.isFinite(amount) || amount <= 0 || !["BUY", "SELL"].includes(side)) {
    return NextResponse.json({ message: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }
  if (!isSupportedSymbol(symbol)) {
    return NextResponse.json({ message: "ยังไม่รองรับ Symbol นี้ กรุณาเพิ่ม CoinGecko mapping ก่อน" }, { status: 400 });
  }

  const entryDateTime = new Date(`${date}T${time}:00`).toISOString();
  const allocations = await getAllocations();
  const allocation = allocations.find((item) => item.coin === symbol);
  const targetPercent = allocation?.targetPercent ?? 0;
  const existing = await getHoldingBySymbol(symbol);
  if (side === "SELL") {
    if (!existing) {
      return NextResponse.json({ message: "ไม่พบเหรียญในพอร์ต" }, { status: 404 });
    }
    if (amount > existing.amount) {
      return NextResponse.json({ message: "จำนวนที่ขายมากกว่าจำนวนที่ถืออยู่" }, { status: 400 });
    }
  }
  let historical;
  let current;
  try {
    historical = await getHistoricalPrice(symbol, entryDateTime);
    current = await getCurrentPrice(symbol);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "ไม่สามารถดึงราคาย้อนหลังของเหรียญนี้ได้ กรุณาตรวจ Symbol หรือเลือกวันที่ใหม่" },
      { status: 400 }
    );
  }
  const now = new Date().toISOString();

  if (side === "BUY") {
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
  } else if (existing) {
    const nextAmount = existing.amount - amount;
    if (nextAmount <= 0) {
      await deleteHolding(symbol);
    } else {
      await updateHolding(
        symbol,
        nextAmount,
        existing.entryDateTime,
        existing.entryPriceUsd,
        existing.entryPriceThb,
        nextAmount * existing.entryPriceUsd,
        nextAmount * existing.entryPriceThb,
        current.usd,
        current.thb,
        now
      );
    }
  }

  await addTransactionHistory({
    transactionDate: entryDateTime,
    symbol,
    side: side as "BUY" | "SELL",
    amount,
    priceUsd: historical.usd,
    priceThb: historical.thb,
    valueUsd: amount * historical.usd,
    valueThb: amount * historical.thb,
    feePercent: DEFAULT_TRADING_FEE_PERCENT,
    createdAt: now
  });

  return NextResponse.json({
    ok: true,
    warning: allocation ? null : "เหรียญนี้ยังไม่มีสัดส่วนเป้าหมาย กรุณาเพิ่มในหน้าสัดส่วนเป้าหมาย",
    sourceNote: historical.sourceNote ?? null
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const symbol = normalizeSymbol(String(body.symbol ?? ""));
  const amount = Number(body.amount);
  const date = String(body.date ?? "");
  const time = String(body.time ?? "");

  if (!symbol || !date || !time || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }
  if (!isSupportedSymbol(symbol)) {
    return NextResponse.json({ message: "ยังไม่รองรับ Symbol นี้ กรุณาเพิ่ม CoinGecko mapping ก่อน" }, { status: 400 });
  }

  const existing = await getHoldingBySymbol(symbol);
  if (!existing) {
    return NextResponse.json({ message: "ไม่พบเหรียญในพอร์ต" }, { status: 404 });
  }

  const entryDateTime = new Date(`${date}T${time}:00`).toISOString();
  let historical;
  try {
    historical = await getHistoricalPrice(symbol, entryDateTime);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "ไม่สามารถดึงราคาย้อนหลังของเหรียญนี้ได้ กรุณาตรวจ Symbol หรือเลือกวันที่ใหม่" },
      { status: 400 }
    );
  }

  let currentPriceUsd = existing.currentPriceUsd;
  let currentPriceThb = existing.currentPriceThb;
  const cacheAge = Date.now() - new Date(existing.updatedAt).getTime();
  if (!Number.isFinite(cacheAge) || cacheAge > PRICE_CACHE_TTL_MS) {
    try {
      const current = await getCurrentPrice(symbol);
      currentPriceUsd = current.usd;
      currentPriceThb = current.thb;
    } catch {
      currentPriceUsd = existing.currentPriceUsd;
      currentPriceThb = existing.currentPriceThb;
    }
  }

  await updateHolding(
    symbol,
    amount,
    entryDateTime,
    historical.usd,
    historical.thb,
    amount * historical.usd,
    amount * historical.thb,
    currentPriceUsd,
    currentPriceThb,
    new Date().toISOString()
  );

  return NextResponse.json({ ok: true, sourceNote: historical.sourceNote ?? null });
}

export async function DELETE(request: NextRequest) {
  const symbol = normalizeSymbol(new URL(request.url).searchParams.get("symbol") ?? "");
  if (!symbol) {
    return NextResponse.json({ message: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }
  await deleteHolding(symbol);
  return NextResponse.json({ ok: true });
}
