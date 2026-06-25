import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { timestampForFile } from "@/lib/csv";

export const runtime = "nodejs";

export async function POST() {
  try {
    const dbPath = path.join(process.cwd(), "portfolio.db");
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ message: "ไม่พบไฟล์ฐานข้อมูล portfolio.db" }, { status: 500 });
    }

    const backupDir = path.join(process.cwd(), "backups");
    fs.mkdirSync(backupDir, { recursive: true });
    const filename = `portfolio_backup_${timestampForFile()}.db`;
    const backupPath = path.join(backupDir, filename);
    fs.copyFileSync(dbPath, backupPath);

    return NextResponse.json({ ok: true, backupPath, filename });
  } catch {
    return NextResponse.json({ message: "สำรองฐานข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
