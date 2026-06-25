import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { toCsv, timestampForFile } from "@/lib/csv";
import { getSnapshots, getTransactionHistory } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  try {
    const exportDir = path.join(process.cwd(), "exports");
    fs.mkdirSync(exportDir, { recursive: true });

    const timestamp = timestampForFile();
    const transactionsFile = `transactions_${timestamp}.csv`;
    const snapshotsFile = `snapshots_${timestamp}.csv`;

    const transactions = await getTransactionHistory();
    const transactionCsv = toCsv(
      ["วันที่", "เหรียญ", "ซื้อ/ขาย", "จำนวน", "ราคา USD", "ราคา THB", "มูลค่า USD", "มูลค่า THB", "Fee %"],
      transactions.map((row) => [
        row.transactionDate,
        row.symbol,
        row.side === "BUY" ? "ซื้อ" : "ขาย",
        row.amount,
        row.priceUsd,
        row.priceThb,
        row.valueUsd,
        row.valueThb,
        row.feePercent
      ])
    );

    const snapshots = await getSnapshots();
    const snapshotCsv = toCsv(
      ["วันที่", "มูลค่าพอร์ต THB", "เหรียญที่มีสัดส่วนมากที่สุด", "เหรียญที่ควรซื้อสูงสุด", "เหรียญที่ควรขายสูงสุด"],
      snapshots.map((row) => [row.snapshotDate, row.totalValueThb, row.topCoin, row.topBuyCoin, row.topSellCoin])
    );

    fs.writeFileSync(path.join(exportDir, transactionsFile), transactionCsv, "utf8");
    fs.writeFileSync(path.join(exportDir, snapshotsFile), snapshotCsv, "utf8");

    return NextResponse.json({ ok: true, files: [transactionsFile, snapshotsFile], exportDir });
  } catch {
    return NextResponse.json({ message: "Export CSV ไม่สำเร็จ" }, { status: 500 });
  }
}
