import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { users } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);

const allUsers = await db.select({ id: users.id, name: users.name, role: users.role, openId: users.openId }).from(users);
console.log("=== Users ===");
for (const u of allUsers) {
  console.log(`ID: ${u.id} | Name: ${u.name} | Role: ${u.role} | OpenID: ${u.openId?.substring(0, 30)}...`);
}

await conn.end();
