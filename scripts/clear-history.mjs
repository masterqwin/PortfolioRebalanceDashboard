import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";

const dbPath = path.join(process.cwd(), "portfolio.db");
const cleared = ["snapshots", "rebalance_history", "transaction_history"];

if (!fs.existsSync(dbPath)) {
  console.error(JSON.stringify({ ok: false, message: "ไม่พบไฟล์ portfolio.db" }, null, 2));
  process.exit(1);
}

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync(dbPath));

try {
  db.run("BEGIN TRANSACTION");
  for (const table of cleared) {
    db.run(`DELETE FROM ${table}`);
  }
  db.run("COMMIT");
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  console.log(JSON.stringify({ ok: true, cleared }, null, 2));
} catch (error) {
  db.run("ROLLBACK");
  console.error(
    JSON.stringify({ ok: false, message: error instanceof Error ? error.message : "ล้าง history ไม่สำเร็จ" }, null, 2)
  );
  process.exit(1);
} finally {
  db.close();
}
