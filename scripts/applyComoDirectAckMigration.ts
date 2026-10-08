import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

/** Explicit, additive migration; deliberately avoids db:push's older migration backlog. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const file = resolve(process.cwd(), "drizzle/0099_como_next_direct_contextual_ack_delivery.sql");
  const text = readFileSync(file, "utf8")
    .split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
  const statements = text.split(";").map(statement => statement.trim()).filter(Boolean);
  const names = [
    "como_next_direct_contextual_ack_delivery_settings",
    "como_next_direct_contextual_ack_delivery_ledger",
  ];
  if (statements.length !== names.length || statements.some((statement, index) =>
    !statement.startsWith(`CREATE TABLE IF NOT EXISTS \`${names[index]}\``))) {
    throw new Error("0099 contains statements outside the two expected additive CREATE TABLE definitions");
  }
  const connection = await mysql.createConnection(url);
  try {
    for (let index = 0; index < statements.length; index++) {
      await connection.query(statements[index]);
      console.log(`Verified additive table ${names[index]}`);
    }
    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (?, ?) ORDER BY table_name",
      names,
    );
    if (rows.length !== names.length) throw new Error("Direct acknowledgment tables not found after migration");
    console.log("Direct acknowledgment schema present; no delivery setting was enabled.");
  } finally {
    await connection.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
