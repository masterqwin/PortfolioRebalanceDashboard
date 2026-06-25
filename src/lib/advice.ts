import type { PortfolioRow } from "./types";

function formatThb(value: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(Math.abs(value));
}

export function buildHumanAdvice(rows: PortfolioRow[]) {
  const activeRows = rows.filter((row) => row.action === "BUY" || row.action === "SELL");
  if (activeRows.length === 0) {
    return ["พอร์ตยังอยู่ใกล้สัดส่วนเป้าหมาย ไม่จำเป็นต้องปรับตอนนี้"];
  }

  const lines = activeRows.map((row) => {
    if (row.action === "SELL") {
      return `${row.symbol} เกินเป้า ${formatPercent(row.driftPercent)}% แนะนำขายประมาณ ${formatThb(row.sellThb)}`;
    }
    return `${row.symbol} ต่ำกว่าเป้า ${formatPercent(row.driftPercent)}% แนะนำซื้อประมาณ ${formatThb(row.buyThb)}`;
  });

  const hasBuy = activeRows.some((row) => row.action === "BUY");
  const hasSell = activeRows.some((row) => row.action === "SELL");
  if (hasBuy && hasSell) {
    lines.push("นำเงินจากรายการขายไปเติมเหรียญที่ต่ำกว่าเป้า เพื่อให้พอร์ตกลับใกล้สัดส่วนเป้าหมาย");
  }

  return lines;
}
