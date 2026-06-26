"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Clock, Coins, History, LayoutDashboard, Plus, RefreshCw, Save, Target, Trash2 } from "lucide-react";
import { buildHumanAdvice } from "@/lib/advice";
import { DEFAULT_TRADING_FEE_PERCENT } from "@/lib/config";
import type { Allocation, PortfolioState } from "@/lib/types";

const navItems = [
  { id: "portfolio", label: "พอร์ตปัจจุบัน", icon: LayoutDashboard },
  { id: "targets", label: "สัดส่วนเป้าหมาย", icon: Target },
  { id: "advice", label: "คำแนะนำปรับพอร์ต", icon: BarChart3 },
  { id: "monthly", label: "ปรับพอร์ตรายเดือน", icon: Activity },
  { id: "history", label: "ประวัติ", icon: History }
] as const;

type ViewId = (typeof navItems)[number]["id"];
type CoinForm = {
  side: "BUY" | "SELL";
  symbol: string;
  date: string;
  time: string;
  amount: string;
  feePercent: string;
};
type EditForm = {
  symbol: string;
  amount: string;
  date: string;
  time: string;
};

const emptyState: PortfolioState = {
  rows: [],
  allocations: [],
  snapshots: [],
  rebalanceHistory: [],
  transactionHistory: [],
  summary: {
    totalValueThb: 0,
    totalValueUsdt: 0,
    coinCount: 0,
    updatedAt: "",
    totalBuyThb: 0,
    totalSellThb: 0,
    healthScore: 0,
    status: "ไม่ต้องปรับพอร์ต"
  },
  usdThb: 36
};

function formatThb(value: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value);
}

function formatUsdt(value: number) {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(value)} USDT`;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 6 }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(value)}%`;
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function formatCurrentMonthYear() {
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());
}

function bangkokMonthKey(value: string | Date) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", timeZone: "Asia/Bangkok" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

function isCurrentMonth(value: string) {
  return bangkokMonthKey(value) === bangkokMonthKey(new Date());
}

export default function Dashboard() {
  const [active, setActive] = useState<ViewId>("portfolio");
  const [data, setData] = useState<PortfolioState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [coinForm, setCoinForm] = useState({
    side: "BUY" as "BUY" | "SELL",
    symbol: "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    amount: "",
    feePercent: String(DEFAULT_TRADING_FEE_PERCENT)
  });

  async function loadPortfolio(force = false) {
    setLoading(true);
    const response = await fetch(`/api/portfolio${force ? "?force=1" : ""}`, { cache: "no-store" });
    const next = (await response.json()) as PortfolioState;
    setData(next);
    setAllocations(next.allocations);
    if (next.priceStatus?.warning) {
      setMessage(next.priceStatus.warning);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadPortfolio().catch(() => {
      setMessage("โหลดข้อมูลไม่สำเร็จ");
      setLoading(false);
    });
  }, []);

  const allocationSum = useMemo(() => allocations.reduce((sum, item) => sum + Number(item.targetPercent), 0), [allocations]);
  const buyRows = data.rows.filter((row) => row.action === "BUY" && row.buyThb > 0);
  const sellRows = data.rows.filter((row) => row.action === "SELL" && row.sellThb > 0);

  async function addCoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("กำลังบันทึกเหรียญ");
    const response = await fetch("/api/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: coinForm.symbol,
        side: coinForm.side,
        date: coinForm.date,
        time: coinForm.time,
        amount: Number(coinForm.amount)
      })
    });
    if (!response.ok) {
      const error = await response.json();
      setMessage(error.message ?? "บันทึกไม่สำเร็จ");
      return;
    }
    const result = await response.json();
    setCoinForm({ ...coinForm, symbol: "", amount: "" });
    setMessage(result.warning ?? result.sourceNote ?? (coinForm.side === "BUY" ? "บันทึกซื้อแล้ว" : "บันทึกขายแล้ว"));
    await loadPortfolio();
  }

  async function saveHoldingEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm?.symbol || !editForm.date || !editForm.time || Number(editForm.amount) <= 0) {
      setMessage("กรุณากรอกข้อมูลให้ครบถ้วนและจำนวนเหรียญต้องมากกว่า 0");
      return;
    }
    const response = await fetch("/api/holdings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: editForm.symbol,
        amount: Number(editForm.amount),
        date: editForm.date,
        time: editForm.time
      })
    });
    if (!response.ok) {
      const error = await response.json();
      setMessage(error.message ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setEditForm(null);
    setMessage("บันทึกการแก้ไขแล้ว");
    await loadPortfolio();
  }

  async function deleteHoldingRow(symbol: string) {
    if (!window.confirm(`ยืนยันลบเหรียญ ${symbol} ออกจากพอร์ต?`)) return;
    const response = await fetch(`/api/holdings?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" });
    if (!response.ok) {
      const error = await response.json();
      setMessage(error.message ?? "ลบไม่สำเร็จ");
      return;
    }
    setMessage("ลบเหรียญแล้ว");
    await loadPortfolio();
  }

  async function saveAllocations() {
    setMessage("กำลังบันทึกสัดส่วน");
    const response = await fetch("/api/allocations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocations })
    });
    if (!response.ok) {
      const error = await response.json();
      setMessage(error.message ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setMessage("บันทึกสัดส่วนแล้ว");
    await loadPortfolio();
  }

  async function generateRebalance() {
    setMessage("สร้าง snapshot รายเดือนแล้ว");
    await fetch("/api/snapshots", { method: "POST" });
    await loadPortfolio();
    setActive("monthly");
  }

  async function backupDb() {
    const response = await fetch("/api/backup", { method: "POST" });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "สำรองข้อมูลไม่สำเร็จ");
      return;
    }
    setMessage(`สำรองข้อมูลสำเร็จ: ${result.filename}`);
  }

  async function exportCsv() {
    const response = await fetch("/api/export", { method: "POST" });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "Export CSV ไม่สำเร็จ");
      return;
    }
    setMessage(`Export CSV สำเร็จ: ${result.files.join(", ")}`);
  }

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-line bg-[#0b1016] lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col gap-6 p-4 lg:p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded bg-teal/15 text-teal">
                <Coins size={22} />
              </div>
              <div>
                <h1 className="text-lg font-semibold leading-tight">ปรับพอร์ต</h1>
                <p className="text-xs text-muted">รายเดือน</p>
              </div>
            </div>

            <nav className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActive(item.id)}
                    className={`flex min-h-11 items-center gap-3 rounded px-3 text-left text-sm transition ${
                      active === item.id ? "bg-panel2 text-white ring-1 ring-line" : "text-slate-400 hover:bg-panel hover:text-white"
                    }`}
                    title={item.label}
                  >
                    <Icon size={18} />
                    <span className="truncate">{index + 1} {item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto hidden rounded border border-line bg-panel p-4 lg:block">
              <p className="text-xs text-muted">USDTHB</p>
              <p className="mt-1 text-2xl font-semibold">{data.usdThb.toFixed(2)}</p>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{navItems.find((item) => item.id === active)?.label}</h2>
              <p className="mt-1 text-sm text-muted">ภาษาไทย • Dark Mode • Single User</p>
            </div>
            <div className="flex items-center gap-3">
              {message ? <span className="text-sm text-amber">{message}</span> : null}
              <button
                onClick={backupDb}
                className="inline-flex min-h-10 items-center gap-2 rounded border border-line bg-panel px-3 text-sm text-slate-200 hover:bg-panel2"
              >
                Backup DB
              </button>
              <button
                onClick={exportCsv}
                className="inline-flex min-h-10 items-center gap-2 rounded border border-line bg-panel px-3 text-sm text-slate-200 hover:bg-panel2"
              >
                Export CSV
              </button>
              <button
                onClick={() => loadPortfolio(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded border border-line bg-panel px-3 text-sm text-slate-200 hover:bg-panel2"
                title="อัปเดตข้อมูล"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                อัปเดต
              </button>
            </div>
          </div>

          {active === "portfolio" ? (
            <PortfolioPage
              data={data}
              coinForm={coinForm}
              setCoinForm={setCoinForm}
              addCoin={addCoin}
              editForm={editForm}
              setEditForm={setEditForm}
              saveHoldingEdit={saveHoldingEdit}
              deleteHoldingRow={deleteHoldingRow}
            />
          ) : null}
          {active === "targets" ? (
            <TargetsPage allocations={allocations} setAllocations={setAllocations} allocationSum={allocationSum} saveAllocations={saveAllocations} />
          ) : null}
          {active === "advice" ? <AdvicePage data={data} /> : null}
          {active === "monthly" ? (
            <MonthlyPage data={data} buyRows={buyRows} sellRows={sellRows} generateRebalance={generateRebalance} />
          ) : null}
          {active === "history" ? <HistoryPage data={data} /> : null}
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border border-line bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function PortfolioPage({
  data,
  coinForm,
  setCoinForm,
  addCoin,
  editForm,
  setEditForm,
  saveHoldingEdit,
  deleteHoldingRow
}: {
  data: PortfolioState;
  coinForm: CoinForm;
  setCoinForm: React.Dispatch<React.SetStateAction<CoinForm>>;
  addCoin: (event: React.FormEvent<HTMLFormElement>) => void;
  editForm: EditForm | null;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm | null>>;
  saveHoldingEdit: (event: React.FormEvent<HTMLFormElement>) => void;
  deleteHoldingRow: (symbol: string) => void;
}) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="มูลค่าพอร์ตรวม THB" value={formatThb(data.summary.totalValueThb)} tone="text-amber" />
        <Metric label="มูลค่าพอร์ตรวม USDT" value={formatUsdt(data.summary.totalValueUsdt)} />
        <Metric label="จำนวนเหรียญทั้งหมด" value={`${data.summary.coinCount} เหรียญ`} />
        <Metric label="อัปเดตล่าสุด" value={formatDate(data.summary.updatedAt)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Panel title="ตารางพอร์ตปัจจุบัน">
          <PortfolioTable
            data={data}
            editForm={editForm}
            setEditForm={setEditForm}
            saveHoldingEdit={saveHoldingEdit}
            deleteHoldingRow={deleteHoldingRow}
          />
        </Panel>

        <Panel title="เพิ่มเหรียญ">
          <form className="grid gap-3" onSubmit={addCoin}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCoinForm({ ...coinForm, side: "BUY" })}
                className={`min-h-10 rounded border px-3 text-sm font-semibold ${
                  coinForm.side === "BUY" ? "border-green bg-green/15 text-green" : "border-line text-slate-300 hover:bg-panel2"
                }`}
              >
                ซื้อ
              </button>
              <button
                type="button"
                onClick={() => setCoinForm({ ...coinForm, side: "SELL" })}
                className={`min-h-10 rounded border px-3 text-sm font-semibold ${
                  coinForm.side === "SELL" ? "border-red bg-red/15 text-red" : "border-line text-slate-300 hover:bg-panel2"
                }`}
              >
                ขาย
              </button>
            </div>
            {[
              ["symbol", "Symbol", "ETH"],
              ["date", "Date", ""],
              ["time", "Time", ""],
              ["amount", "Amount", "0.5"],
              ["feePercent", "Fee %", "0.1"]
            ].map(([key, label, placeholder]) => (
              <label key={key} className="grid gap-1 text-sm text-slate-300">
                {label}
                <input
                  type={key === "date" ? "date" : key === "time" ? "time" : "text"}
                  value={coinForm[key as keyof CoinForm]}
                  placeholder={placeholder}
                  disabled={key === "feePercent"}
                  readOnly={key === "feePercent"}
                  onChange={(event) => setCoinForm({ ...coinForm, [key]: event.target.value })}
                  className="min-h-10 rounded border border-line bg-[#0c1117] px-3 text-slate-100 outline-none focus:border-teal disabled:cursor-not-allowed disabled:text-muted"
                />
              </label>
            ))}
            <button
              className={`mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 text-sm font-semibold ${
                coinForm.side === "BUY" ? "bg-teal text-[#061010] hover:bg-[#5eead4]" : "bg-red text-white hover:bg-[#ff7b7b]"
              }`}
            >
              <Plus size={17} />
              {coinForm.side === "BUY" ? "บันทึกซื้อ" : "บันทึกขาย"}
            </button>
          </form>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function entryDate(rowDate: string) {
  return new Date(rowDate).toISOString().slice(0, 10);
}

function entryTime(rowDate: string) {
  return new Date(rowDate).toISOString().slice(11, 16);
}

function PortfolioTable({
  data,
  editForm,
  setEditForm,
  saveHoldingEdit,
  deleteHoldingRow
}: {
  data: PortfolioState;
  editForm: EditForm | null;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm | null>>;
  saveHoldingEdit: (event: React.FormEvent<HTMLFormElement>) => void;
  deleteHoldingRow: (symbol: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead className="text-left text-xs uppercase text-muted">
          <tr className="border-b border-line">
            <th className="py-3 pr-4">ชื่อเหรียญ</th>
            <th className="py-3 pr-4 text-right">จำนวนเหรียญ</th>
            <th className="py-3 pr-4 text-right">ราคา Real-time</th>
            <th className="py-3 pr-4 text-right">มูลค่า USDT</th>
            <th className="py-3 pr-4 text-right">มูลค่า THB</th>
            <th className="py-3 text-right">Current %</th>
            <th className="py-3 pl-4 text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr>
              <td className="py-4 text-muted" colSpan={7}>
                พอร์ตว่าง
              </td>
            </tr>
          ) : (
            data.rows.map((row) => (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                {editForm?.symbol === row.symbol ? (
                  <td className="py-3 pr-4" colSpan={7}>
                    <form className="grid gap-3 md:grid-cols-[120px_1fr_1fr_1fr_auto] md:items-end" onSubmit={saveHoldingEdit}>
                      <div className="font-semibold">{row.symbol}</div>
                      <label className="grid gap-1 text-xs text-muted">
                        จำนวนเหรียญ
                        <input
                          className="min-h-10 rounded border border-line bg-[#0c1117] px-3 text-sm text-slate-100"
                          value={editForm.amount}
                          onChange={(event) => setEditForm({ ...editForm, amount: event.target.value })}
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-muted">
                        Date
                        <input
                          type="date"
                          className="min-h-10 rounded border border-line bg-[#0c1117] px-3 text-sm text-slate-100"
                          value={editForm.date}
                          onChange={(event) => setEditForm({ ...editForm, date: event.target.value })}
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-muted">
                        Time
                        <input
                          type="time"
                          className="min-h-10 rounded border border-line bg-[#0c1117] px-3 text-sm text-slate-100"
                          value={editForm.time}
                          onChange={(event) => setEditForm({ ...editForm, time: event.target.value })}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button className="min-h-10 rounded bg-teal px-3 text-sm font-semibold text-[#061010]">บันทึก</button>
                        <button type="button" className="min-h-10 rounded border border-line px-3 text-sm" onClick={() => setEditForm(null)}>
                          ยกเลิก
                        </button>
                      </div>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="py-3 pr-4 font-semibold">{row.symbol}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{formatAmount(row.amount)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{formatUsdt(row.currentPriceUsd)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{formatUsdt(row.valueUsd)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{formatThb(row.valueThb)}</td>
                    <td className="py-3 text-right tabular-nums">{formatPercent(row.currentPercent)}</td>
                    <td className="py-3 pl-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="min-h-9 rounded border border-line px-3 text-xs hover:bg-panel2"
                          onClick={() =>
                            setEditForm({
                              symbol: row.symbol,
                              amount: String(row.amount),
                              date: entryDate(row.entryDateTime),
                              time: entryTime(row.entryDateTime)
                            })
                          }
                        >
                          แก้ไข
                        </button>
                        <button
                          className="min-h-9 rounded border border-line px-3 text-xs text-red hover:bg-red/10"
                          onClick={() => deleteHoldingRow(row.symbol)}
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TargetsPage({
  allocations,
  setAllocations,
  allocationSum,
  saveAllocations
}: {
  allocations: Allocation[];
  setAllocations: (value: Allocation[]) => void;
  allocationSum: number;
  saveAllocations: () => void;
}) {
  function updateRow(index: number, key: keyof Allocation, value: string) {
    const next = allocations.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [key]: key === "targetPercent" ? Number(value) : value } : row
    );
    setAllocations(next);
  }

  return (
    <Panel title="สัดส่วนเป้าหมาย">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className={allocationSum === 100 ? "text-sm text-green" : "text-sm text-red"}>
          ผลรวม Target %: {formatPercent(allocationSum)}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAllocations([...allocations, { id: 0, coin: "", role: "", targetPercent: 0 }])}
            className="inline-flex min-h-10 items-center gap-2 rounded border border-line bg-panel2 px-3 text-sm"
          >
            <Plus size={16} />
            เพิ่ม
          </button>
          <button
            onClick={saveAllocations}
            className="inline-flex min-h-10 items-center gap-2 rounded bg-teal px-3 text-sm font-semibold text-[#061010]"
          >
            <Save size={16} />
            บันทึก
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr className="border-b border-line">
              <th className="py-3 pr-3">Coin</th>
              <th className="py-3 pr-3">Role</th>
              <th className="py-3 pr-3">Target %</th>
              <th className="py-3 text-right">ลบ</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((row, index) => (
              <tr key={`${row.id}-${index}`} className="border-b border-line/70">
                <td className="py-2 pr-3">
                  <input className="w-full rounded border border-line bg-[#0c1117] px-3 py-2" value={row.coin} onChange={(event) => updateRow(index, "coin", event.target.value)} />
                </td>
                <td className="py-2 pr-3">
                  <input className="w-full rounded border border-line bg-[#0c1117] px-3 py-2" value={row.role} onChange={(event) => updateRow(index, "role", event.target.value)} />
                </td>
                <td className="py-2 pr-3">
                  <input className="w-full rounded border border-line bg-[#0c1117] px-3 py-2" value={row.targetPercent} onChange={(event) => updateRow(index, "targetPercent", event.target.value)} />
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => setAllocations(allocations.filter((_, rowIndex) => rowIndex !== index))}
                    className="inline-grid h-9 w-9 place-items-center rounded border border-line text-red hover:bg-red/10"
                    title="ลบ"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AdvicePage({ data }: { data: PortfolioState }) {
  const adviceLines = buildHumanAdvice(data.rows);
  return (
    <div className="grid gap-6">
      <section className="grid gap-3 md:grid-cols-2">
        <Metric label="รวมซื้อ" value={formatThb(data.summary.totalBuyThb)} tone="text-green" />
        <Metric label="รวมขาย" value={formatThb(data.summary.totalSellThb)} tone="text-red" />
      </section>
      <Panel title="สรุปคำแนะนำแบบอ่านง่าย">
        <div className="grid gap-2 text-sm leading-6 text-slate-200">
          {adviceLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </Panel>
      <Panel title="คำแนะนำปรับพอร์ต">
        <AdviceTable data={data} />
      </Panel>
    </div>
  );
}

function AdviceTable({ data }: { data: PortfolioState }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="text-left text-xs uppercase text-muted">
          <tr className="border-b border-line">
            {["Coin", "Amount", "Current %", "Target %", "Drift %", "Action", "Buy Amount", "Sell Amount", "THB Value"].map((head) => (
              <th key={head} className="py-3 pr-4 text-right first:text-left">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.id} className="border-b border-line/70">
              <td className="py-3 pr-4 font-semibold">{row.symbol}</td>
              <td className="py-3 pr-4 text-right">{formatAmount(row.amount)}</td>
              <td className="py-3 pr-4 text-right">{formatPercent(row.currentPercent)}</td>
              <td className="py-3 pr-4 text-right">{formatPercent(row.targetPercent)}</td>
              <td className="py-3 pr-4 text-right">{formatPercent(row.driftPercent)}</td>
              <td className="py-3 pr-4 text-right">
                <span className={`rounded px-2 py-1 text-xs font-semibold ${row.action === "BUY" ? "bg-green/15 text-green" : row.action === "SELL" ? "bg-red/15 text-red" : "bg-slate-500/15 text-slate-300"}`}>
                  {row.action}
                </span>
              </td>
              <td className="py-3 pr-4 text-right">{formatAmount(row.buyAmount)}</td>
              <td className="py-3 pr-4 text-right">{formatAmount(row.sellAmount)}</td>
              <td className="py-3 pr-4 text-right">{formatThb(row.thbValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyPage({
  data,
  buyRows,
  sellRows,
  generateRebalance
}: {
  data: PortfolioState;
  buyRows: PortfolioState["rows"];
  sellRows: PortfolioState["rows"];
  generateRebalance: () => void;
}) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="rounded border border-line bg-panel p-5">
          <button
            onClick={generateRebalance}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-amber px-4 text-sm font-semibold text-[#140e03]"
          >
            <Clock size={17} />
            บันทึกรอบปรับพอร์ต
          </button>
          <p className="mt-3 text-sm leading-6 text-muted">
            ใช้บันทึกรอบที่มีการปรับพอร์ตหรืออยากเก็บสถิติ ณ เวลานี้ ระบบไม่ได้ทำการซื้อขายจริง
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            คำแนะนำในหน้านี้เป็นเพียงแผนการปรับพอร์ต หากซื้อ/ขายจริงแล้ว ให้บันทึกธุรกรรมที่หน้าพอร์ตปัจจุบันก่อน แล้วค่อยกดบันทึกรอบปรับพอร์ต
          </p>
          <div className="mt-5">
            <p className="text-sm text-muted">Portfolio Health Score</p>
            <p className="mt-2 text-5xl font-semibold">{data.summary.healthScore}</p>
            <p className={data.summary.status === "ควรปรับพอร์ต" ? "mt-2 text-red" : "mt-2 text-green"}>{data.summary.status}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <MiniPlan title="ควรขาย" rows={sellRows} kind="sell" />
          <MiniPlan title="ควรซื้อ" rows={buyRows} kind="buy" />
        </div>
      </section>
    </div>
  );
}

function MiniPlan({ title, rows, kind }: { title: string; rows: PortfolioState["rows"]; kind: "buy" | "sell" }) {
  return (
    <Panel title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr className="border-b border-line">
              <th className="py-3 pr-3">Coin</th>
              <th className="py-3 pr-3 text-right">Amount</th>
              <th className="py-3 text-right">THB</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="py-4 text-muted" colSpan={3}>
                  ไม่มีรายการ
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line/70">
                  <td className="py-3 pr-3 font-semibold">{row.symbol}</td>
                  <td className="py-3 pr-3 text-right">{formatAmount(kind === "buy" ? row.buyAmount : row.sellAmount)}</td>
                  <td className={`py-3 text-right ${kind === "buy" ? "text-green" : "text-red"}`}>
                    {formatThb(kind === "buy" ? row.buyThb : row.sellThb)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function HistoryPage({ data }: { data: PortfolioState }) {
  const latestSnapshots = data.snapshots.slice(0, 3);
  const monthlyTransactionRows = data.transactionHistory.filter((row) => isCurrentMonth(row.createdAt));
  const snapshotsAscending = [...data.snapshots].sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime());
  const transactionRowsForSnapshot = (snapshotDate: string) => {
    const snapshotTime = new Date(snapshotDate).getTime();
    const snapshotIndex = snapshotsAscending.findIndex((row) => row.snapshotDate === snapshotDate);
    const previousSnapshotTime = snapshotIndex > 0 ? new Date(snapshotsAscending[snapshotIndex - 1].snapshotDate).getTime() : Number.NEGATIVE_INFINITY;
    return data.transactionHistory.filter((row) => {
      const createdTime = new Date(row.createdAt).getTime();
      return createdTime > previousSnapshotTime && createdTime <= snapshotTime;
    });
  };
  const transactionSummaryForSnapshot = (snapshotDate: string) => {
    const rows = transactionRowsForSnapshot(snapshotDate);
    if (rows.length === 0) return "-";
    return rows.map((row) => `${row.side} ${row.symbol}`).join(", ");
  };

  return (
    <div className="grid gap-6">
      <Panel title="ประวัติการปรับพอร์ต">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr className="border-b border-line">
                <th className="py-3 pr-4">วันที่</th>
                <th className="py-3 pr-4 text-right">มูลค่าพอร์ต THB</th>
                <th className="py-3 pr-4">เหรียญที่มีสัดส่วนมากสุด</th>
                <th className="py-3 pr-4">รายการซื้อขายจริงในรอบนั้น</th>
                <th className="py-3">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {latestSnapshots.length === 0 ? (
                <tr>
                  <td className="py-4 text-muted" colSpan={5}>
                    ไม่มีรายการ
                  </td>
                </tr>
              ) : (
                latestSnapshots.map((row) => (
                  <tr key={row.id} className="border-b border-line/70">
                    <td className="py-3 pr-4">{formatDate(row.snapshotDate)}</td>
                    <td className="py-3 pr-4 text-right">{formatThb(row.totalValueThb)}</td>
                    <td className="py-3 pr-4">{row.topCoin}</td>
                    <td className="py-3 pr-4">{transactionSummaryForSnapshot(row.snapshotDate)}</td>
                    <td className="py-3">
                      {transactionRowsForSnapshot(row.snapshotDate).length > 0 ? "มีการปรับพอร์ตจริง" : "บันทึกสถิติ / ไม่ได้ปรับจริง"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`รายงานการปรับพอร์ตประจำเดือน ${formatCurrentMonthYear()}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr className="border-b border-line">
                <th className="py-3 pr-4">วันที่</th>
                <th className="py-3 pr-4">เหรียญ</th>
                <th className="py-3 pr-4">BUY / SELL</th>
                <th className="py-3 pr-4 text-right">จำนวน</th>
                <th className="py-3 pr-4 text-right">ราคา THB</th>
                <th className="py-3 text-right">มูลค่า THB</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTransactionRows.length === 0 ? (
                <tr>
                  <td className="py-4 text-muted" colSpan={6}>
                    เดือนนี้ยังไม่มีรายการปรับพอร์ต
                  </td>
                </tr>
              ) : (
                monthlyTransactionRows.map((row) => (
                  <tr key={row.id} className="border-b border-line/70">
                    <td className="py-3 pr-4">{formatDate(row.createdAt)}</td>
                    <td className="py-3 pr-4 font-semibold">{row.symbol}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${row.side === "BUY" ? "bg-green/15 text-green" : "bg-red/15 text-red"}`}>
                        {row.side === "BUY" ? "ซื้อ" : "ขาย"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">{formatAmount(row.amount)}</td>
                    <td className="py-3 pr-4 text-right">{formatThb(row.priceThb)}</td>
                    <td className="py-3 text-right">{formatThb(row.valueThb)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
