import { Router } from "express";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

/**
 * Simple Express routes to store/retrieve the original dashboard JSON blob.
 * This keeps the original HTML page working exactly as-is,
 * while persisting data in the database instead of localStorage.
 */

// We'll use a simple key-value table for storing the dashboard data
const router = Router();

// Ensure the dashboardData table exists
async function ensureTable() {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS dashboardData (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dataKey VARCHAR(255) NOT NULL UNIQUE,
        dataValue LONGTEXT,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.warn("[DashboardData] Table creation skipped:", e);
  }
}

// Initialize table on module load
ensureTable();

// GET /api/dashboard-data - retrieve stored data
router.get("/", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }
    const result = await db.execute(
      sql`SELECT dataValue FROM dashboardData WHERE dataKey = 'main' LIMIT 1`
    );
    const rows = result[0] as unknown as any[];
    if (rows && rows.length > 0 && rows[0].dataValue) {
      return res.json(JSON.parse(rows[0].dataValue));
    }
    return res.json({});
  } catch (e) {
    console.error("[DashboardData] GET error:", e);
    return res.status(500).json({ error: "Failed to load data" });
  }
});

// POST /api/dashboard-data - save data
router.post("/", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }
    const jsonData = JSON.stringify(req.body);
    await db.execute(
      sql`INSERT INTO dashboardData (dataKey, dataValue) VALUES ('main', ${jsonData})
          ON DUPLICATE KEY UPDATE dataValue = ${jsonData}`
    );
    return res.json({ success: true });
  } catch (e) {
    console.error("[DashboardData] POST error:", e);
    return res.status(500).json({ error: "Failed to save data" });
  }
});

// PATCH /api/dashboard-data - partial update (for agents/Salwa)
router.patch("/", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }
    // Get existing data
    const result = await db.execute(
      sql`SELECT dataValue FROM dashboardData WHERE dataKey = 'main' LIMIT 1`
    );
    const rows = result[0] as unknown as any[];
    let existingData: any = {};
    if (rows && rows.length > 0 && rows[0].dataValue) {
      existingData = JSON.parse(rows[0].dataValue);
    }
    // Deep merge
    const updatedData = deepMerge(existingData, req.body);
    const jsonData = JSON.stringify(updatedData);
    await db.execute(
      sql`INSERT INTO dashboardData (dataKey, dataValue) VALUES ('main', ${jsonData})
          ON DUPLICATE KEY UPDATE dataValue = ${jsonData}`
    );
    return res.json({ success: true, data: updatedData });
  } catch (e) {
    console.error("[DashboardData] PATCH error:", e);
    return res.status(500).json({ error: "Failed to update data" });
  }
});

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

export default router;
