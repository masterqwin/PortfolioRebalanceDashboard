import { NextRequest, NextResponse } from "next/server";
import { addAllocation, deleteAllocation, getAllocations, updateAllocation } from "@/lib/db";
import { allocationTotal } from "@/lib/calculations";
import { normalizeSymbol } from "@/lib/coinMap";

export const runtime = "nodejs";

function validateTotal(nextAllocations: { targetPercent: number }[]) {
  return Math.abs(allocationTotal(nextAllocations) - 100) < 0.001;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const next = {
    coin: normalizeSymbol(String(body.coin ?? "")),
    role: String(body.role ?? "").trim(),
    targetPercent: Number(body.targetPercent)
  };
  const existing = await getAllocations();
  if (!validateTotal([...existing, next])) {
    return NextResponse.json({ message: "ผลรวม Target % ต้องเท่ากับ 100%" }, { status: 400 });
  }
  await addAllocation(next);
  return NextResponse.json({ ok: true });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const input = {
    id: Number(body.id),
    coin: normalizeSymbol(String(body.coin ?? "")),
    role: String(body.role ?? "").trim(),
    targetPercent: Number(body.targetPercent)
  };
  const existing = (await getAllocations()).map((item) => (item.id === input.id ? input : item));
  if (!validateTotal(existing)) {
    return NextResponse.json({ message: "ผลรวม Target % ต้องเท่ากับ 100%" }, { status: 400 });
  }
  await updateAllocation(input);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  const existing = (await getAllocations()).filter((item) => item.id !== id);
  if (!validateTotal(existing)) {
    return NextResponse.json({ message: "ผลรวม Target % ต้องเท่ากับ 100%" }, { status: 400 });
  }
  await deleteAllocation(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as {
    allocations: { id?: number; coin: string; role: string; targetPercent: number }[];
  };
  const rows = body.allocations.map((item) => ({
    id: Number(item.id ?? 0),
    coin: normalizeSymbol(String(item.coin ?? "")),
    role: String(item.role ?? "").trim(),
    targetPercent: Number(item.targetPercent)
  }));

  if (!validateTotal(rows)) {
    return NextResponse.json({ message: "ผลรวม Target % ต้องเท่ากับ 100%" }, { status: 400 });
  }

  const existingIds = new Set((await getAllocations()).map((item) => item.id));
  for (const row of rows) {
    if (row.id && existingIds.has(row.id)) {
      await updateAllocation(row);
    } else {
      await addAllocation({ coin: row.coin, role: row.role, targetPercent: row.targetPercent });
    }
  }

  const nextIds = new Set(rows.map((row) => row.id).filter(Boolean));
  for (const item of await getAllocations()) {
    if (!nextIds.has(item.id) && rows.some((row) => row.id > 0)) {
      await deleteAllocation(item.id);
    }
  }

  return NextResponse.json({ ok: true });
}
