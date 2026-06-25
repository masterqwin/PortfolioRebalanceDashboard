import fs from "fs";
import path from "path";
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import type { Allocation, Holding, RebalanceHistory, Snapshot, TransactionHistory } from "./types";

const dbPath = path.join(process.cwd(), "portfolio.db");
let db: Database | undefined;

async function database() {
  if (!db) {
    const SQL = await initSqlJs({
      locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file)
    });
    const fileBuffer = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
    db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
    migrate(db);
    seed(db);
    persist(db);
  }
  return db;
}

function persist(client: Database) {
  fs.writeFileSync(dbPath, Buffer.from(client.export()));
}

function migrate(client: Database) {
  client.run(`
    CREATE TABLE IF NOT EXISTS allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      target_percent REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      target_percent REAL NOT NULL,
      fee_percent REAL NOT NULL,
      entry_datetime TEXT NOT NULL,
      entry_price_usd REAL NOT NULL,
      entry_price_thb REAL NOT NULL DEFAULT 0,
      entry_value_usd REAL NOT NULL DEFAULT 0,
      entry_value_thb REAL NOT NULL DEFAULT 0,
      current_price_usd REAL NOT NULL,
      current_price_thb REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL,
      total_value_thb REAL NOT NULL,
      top_coin TEXT NOT NULL,
      top_buy_coin TEXT NOT NULL,
      top_sell_coin TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rebalance_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rebalance_date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('BUY', 'SELL')),
      amount REAL NOT NULL,
      value_thb REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transaction_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
      amount REAL NOT NULL,
      price_usd REAL NOT NULL,
      price_thb REAL NOT NULL,
      value_usd REAL NOT NULL,
      value_thb REAL NOT NULL,
      fee_percent REAL NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  addColumnIfMissing(client, "holdings", "entry_price_thb", "REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(client, "holdings", "entry_value_usd", "REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(client, "holdings", "entry_value_thb", "REAL NOT NULL DEFAULT 0");
}

function addColumnIfMissing(client: Database, table: string, column: string, definition: string) {
  const columns = client.exec(`PRAGMA table_info(${table})`);
  const exists = columns[0]?.values.some((row) => row[1] === column);
  if (!exists) {
    client.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function first<T>(client: Database, sql: string, params: SqlValue[] = []) {
  const result = client.exec(sql, params);
  if (!result[0]?.values[0]) return undefined;
  return Object.fromEntries(result[0].columns.map((column, index) => [column, result[0].values[0][index]])) as T;
}

function all<T>(client: Database, sql: string, params: SqlValue[] = []) {
  const result = client.exec(sql, params);
  if (!result[0]) return [];
  return result[0].values.map((row) => Object.fromEntries(result[0].columns.map((column, index) => [column, row[index]]))) as T[];
}

function seed(client: Database) {
  const allocationCount = first<{ count: number }>(client, "SELECT COUNT(*) as count FROM allocations");
  if ((allocationCount?.count ?? 0) === 0) {
    [
      ["ETH", "Core", 18],
      ["SOL", "Growth", 18],
      ["LINK", "Oracle", 14],
      ["AAVE", "DeFi", 14],
      ["TRX", "Network", 14],
      ["BNB", "Exchange", 12],
      ["PAXG", "Gold", 10]
    ].forEach((row) => client.run("INSERT INTO allocations (coin, role, target_percent) VALUES (?, ?, ?)", row));
  }

}

export async function getHoldings(): Promise<Holding[]> {
  const client = await database();
  return all<Holding>(
    client,
    `SELECT id, symbol, amount, target_percent as targetPercent, fee_percent as feePercent,
    entry_datetime as entryDateTime, entry_price_usd as entryPriceUsd,
    entry_price_thb as entryPriceThb, entry_value_usd as entryValueUsd, entry_value_thb as entryValueThb,
    current_price_usd as currentPriceUsd, current_price_thb as currentPriceThb, updated_at as updatedAt
    FROM holdings ORDER BY symbol`
  );
}

export async function upsertHolding(input: Omit<Holding, "id">) {
  const client = await database();
  client.run(
    `INSERT INTO holdings
    (symbol, amount, target_percent, fee_percent, entry_datetime, entry_price_usd, entry_price_thb, entry_value_usd, entry_value_thb, current_price_usd, current_price_thb, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET
      amount = amount + excluded.amount,
      target_percent = excluded.target_percent,
      fee_percent = excluded.fee_percent,
      entry_datetime = excluded.entry_datetime,
      entry_price_usd = excluded.entry_price_usd,
      entry_price_thb = excluded.entry_price_thb,
      entry_value_usd = excluded.entry_value_usd,
      entry_value_thb = excluded.entry_value_thb,
      current_price_usd = excluded.current_price_usd,
      current_price_thb = excluded.current_price_thb,
      updated_at = excluded.updated_at`,
    [
      input.symbol,
      input.amount,
      input.targetPercent,
      input.feePercent,
      input.entryDateTime,
      input.entryPriceUsd,
      input.entryPriceThb,
      input.entryValueUsd,
      input.entryValueThb,
      input.currentPriceUsd,
      input.currentPriceThb,
      input.updatedAt
    ]
  );
  persist(client);
}

export async function updateHoldingPrices(rows: { symbol: string; currentPriceUsd: number; currentPriceThb: number; updatedAt: string }[]) {
  const client = await database();
  rows.forEach((item) => {
    client.run(
      "UPDATE holdings SET current_price_usd = ?, current_price_thb = ?, updated_at = ? WHERE symbol = ?",
      [item.currentPriceUsd, item.currentPriceThb, item.updatedAt, item.symbol]
    );
  });
  persist(client);
}

export async function getHoldingBySymbol(symbol: string): Promise<Holding | undefined> {
  const client = await database();
  return first<Holding>(
    client,
    `SELECT id, symbol, amount, target_percent as targetPercent, fee_percent as feePercent,
    entry_datetime as entryDateTime, entry_price_usd as entryPriceUsd,
    entry_price_thb as entryPriceThb, entry_value_usd as entryValueUsd, entry_value_thb as entryValueThb,
    current_price_usd as currentPriceUsd, current_price_thb as currentPriceThb, updated_at as updatedAt
    FROM holdings WHERE symbol = ?`,
    [symbol]
  );
}

export async function updateHolding(
  symbol: string,
  amount: number,
  entryDateTime: string,
  entryPriceUsd: number,
  entryPriceThb: number,
  entryValueUsd: number,
  entryValueThb: number,
  currentPriceUsd: number,
  currentPriceThb: number,
  updatedAt: string
) {
  const client = await database();
  client.run(
    `UPDATE holdings SET amount = ?, entry_datetime = ?, entry_price_usd = ?, entry_price_thb = ?,
    entry_value_usd = ?, entry_value_thb = ?, current_price_usd = ?, current_price_thb = ?, updated_at = ?
    WHERE symbol = ?`,
    [amount, entryDateTime, entryPriceUsd, entryPriceThb, entryValueUsd, entryValueThb, currentPriceUsd, currentPriceThb, updatedAt, symbol]
  );
  persist(client);
}

export async function deleteHolding(symbol: string) {
  const client = await database();
  client.run("DELETE FROM holdings WHERE symbol = ?", [symbol]);
  persist(client);
}

export async function addTransactionHistory(input: Omit<TransactionHistory, "id">) {
  const client = await database();
  client.run(
    `INSERT INTO transaction_history
    (transaction_date, symbol, side, amount, price_usd, price_thb, value_usd, value_thb, fee_percent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.transactionDate,
      input.symbol,
      input.side,
      input.amount,
      input.priceUsd,
      input.priceThb,
      input.valueUsd,
      input.valueThb,
      input.feePercent,
      input.createdAt
    ]
  );
  persist(client);
}

export async function getTransactionHistory(): Promise<TransactionHistory[]> {
  const client = await database();
  return all<TransactionHistory>(
    client,
    `SELECT id, transaction_date as transactionDate, symbol, side, amount,
    price_usd as priceUsd, price_thb as priceThb, value_usd as valueUsd,
    value_thb as valueThb, fee_percent as feePercent, created_at as createdAt
    FROM transaction_history ORDER BY transaction_date DESC, id DESC`
  );
}

export async function getAllocations(): Promise<Allocation[]> {
  const client = await database();
  return all<Allocation>(client, "SELECT id, coin, role, target_percent as targetPercent FROM allocations ORDER BY id");
}

export async function addAllocation(input: Omit<Allocation, "id">) {
  const client = await database();
  client.run("INSERT INTO allocations (coin, role, target_percent) VALUES (?, ?, ?)", [input.coin, input.role, input.targetPercent]);
  persist(client);
}

export async function updateAllocation(input: Allocation) {
  const client = await database();
  client.run("UPDATE allocations SET coin = ?, role = ?, target_percent = ? WHERE id = ?", [
    input.coin,
    input.role,
    input.targetPercent,
    input.id
  ]);
  persist(client);
}

export async function deleteAllocation(id: number) {
  const client = await database();
  client.run("DELETE FROM allocations WHERE id = ?", [id]);
  persist(client);
}

export async function getSnapshots(): Promise<Snapshot[]> {
  const client = await database();
  return all<Snapshot>(
    client,
    `SELECT id, snapshot_date as snapshotDate, total_value_thb as totalValueThb,
    top_coin as topCoin, top_buy_coin as topBuyCoin, top_sell_coin as topSellCoin
    FROM snapshots ORDER BY snapshot_date DESC`
  );
}

export async function addSnapshot(input: Omit<Snapshot, "id">) {
  const client = await database();
  client.run(
    "INSERT INTO snapshots (snapshot_date, total_value_thb, top_coin, top_buy_coin, top_sell_coin) VALUES (?, ?, ?, ?, ?)",
    [input.snapshotDate, input.totalValueThb, input.topCoin, input.topBuyCoin, input.topSellCoin]
  );
  persist(client);
}

export async function getRebalanceHistory(): Promise<RebalanceHistory[]> {
  const client = await database();
  return all<RebalanceHistory>(
    client,
    `SELECT id, rebalance_date as rebalanceDate, symbol, action, amount, value_thb as valueThb
    FROM rebalance_history ORDER BY rebalance_date DESC, id DESC`
  );
}

export async function addRebalanceHistory(rows: Omit<RebalanceHistory, "id">[]) {
  if (rows.length === 0) return;
  const client = await database();
  rows.forEach((row) => {
    client.run(
      "INSERT INTO rebalance_history (rebalance_date, symbol, action, amount, value_thb) VALUES (?, ?, ?, ?, ?)",
      [row.rebalanceDate, row.symbol, row.action, row.amount, row.valueThb]
    );
  });
  persist(client);
}
