import { Router } from "express";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

/**
 * Express routes to serve the original dashboard HTML page with data
 * from the structured financialData, projects, and consultants tables.
 * Also handles saves by writing back to both dashboardData (legacy) and financialData tables.
 */

const router = Router();

// Project ID mapping: old HTML uses p1-p6, DB uses numeric IDs 1-6
const PROJECT_ID_MAP: Record<string, number> = {
  p1: 1, p2: 2, p3: 3, p4: 4, p5: 5, p6: 6,
};
const REVERSE_PROJECT_MAP: Record<number, string> = {
  1: "p1", 2: "p2", 3: "p3", 4: "p4", 5: "p5", 6: "p6",
};

// Ensure the dashboardData table exists (for legacy saves)
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
ensureTable();

/**
 * Build the data object from structured DB tables in the format the old HTML expects:
 * {
 *   "p4": {
 *     bua: 350,
 *     price: 110000,
 *     financial: [
 *       { consultant: "Realistic Engineering", designType: "pct", designVal: 1.5, supervisionType: "pct", supervisionVal: 1.5 },
 *       ...
 *     ],
 *     proposalLinks: { "Realistic Engineering": "https://..." },
 *     evaluation: {},
 *     notes: ""
 *   }
 * }
 */
async function buildDataFromStructuredTables(): Promise<any> {
  const db = await getDb();
  if (!db) return {};

  // Get all projects
  const [projectRows] = (await db.execute(
    sql`SELECT id, name, bua, pricePerSqft FROM projects`
  )) as any[];

  // Get all project-consultant relationships with consultant names
  const [pcRows] = (await db.execute(
    sql`SELECT pc.projectId, pc.consultantId, c.name as consultantName 
        FROM projectConsultants pc 
        JOIN consultants c ON pc.consultantId = c.id 
        ORDER BY pc.projectId, pc.id`
  )) as any[];

  // Get all financial data with consultant names
  const [fdRows] = (await db.execute(
    sql`SELECT fd.projectId, fd.consultantId, fd.designType, fd.designValue, 
               fd.supervisionType, fd.supervisionValue, fd.proposalLink,
               c.name as consultantName
        FROM financialData fd 
        JOIN consultants c ON fd.consultantId = c.id`
  )) as any[];

  // Get all evaluation scores with consultant names
  const [evalRows] = (await db.execute(
    sql`SELECT es.projectId, es.consultantId, es.criterionId, es.score,
               c.name as consultantName
        FROM evaluationScores es
        JOIN consultants c ON es.consultantId = c.id`
  )) as any[];

  // Also get any existing legacy data for notes/evaluation that might not be in structured tables
  let legacyData: any = {};
  try {
    const [legacyRows] = (await db.execute(
      sql`SELECT dataValue FROM dashboardData WHERE dataKey = 'main' LIMIT 1`
    )) as any[];
    if (legacyRows && legacyRows.length > 0 && legacyRows[0].dataValue) {
      legacyData = JSON.parse(legacyRows[0].dataValue);
    }
  } catch (e) {
    // ignore
  }

  const result: any = {};

  // Build per-project data
  for (const project of projectRows) {
    const pKey = REVERSE_PROJECT_MAP[project.id];
    if (!pKey) continue;

    // Get consultants for this project (in order)
    const projectConsultants = pcRows
      .filter((pc: any) => pc.projectId === project.id)
      .map((pc: any) => pc.consultantName);

    // Build financial array matching consultant order
    const financialMap = new Map<string, any>();
    for (const fd of fdRows) {
      if (fd.projectId === project.id) {
        financialMap.set(fd.consultantName, fd);
      }
    }

    const financial: any[] = [];
    const proposalLinks: any = {};

    for (const cName of projectConsultants) {
      const fd = financialMap.get(cName);
      if (fd) {
        // Convert from DB format to HTML format
        // DB stores pct values multiplied by 100 (e.g., 150 = 1.5%)
        const designVal =
          fd.designType === "pct" ? fd.designValue / 100 : fd.designValue;
        const supervisionVal =
          fd.supervisionType === "pct"
            ? fd.supervisionValue / 100
            : fd.supervisionValue;

        financial.push({
          consultant: cName,
          designType: fd.designType === "lumpsum" ? "lump" : "pct",
          designVal,
          supervisionType: fd.supervisionType === "lumpsum" ? "lump" : "pct",
          supervisionVal,
        });

        if (fd.proposalLink) {
          proposalLinks[cName] = fd.proposalLink;
        }
      } else {
        financial.push({
          consultant: cName,
          designType: "pct",
          designVal: 0,
          supervisionType: "pct",
          supervisionVal: 0,
        });
      }
    }

    // Build evaluation data
    const evaluation: any = {};
    for (const ev of evalRows) {
      if (ev.projectId === project.id) {
        if (!evaluation[ev.criterionId]) {
          evaluation[ev.criterionId] = {};
        }
        evaluation[ev.criterionId][ev.consultantName] = String(ev.score);
      }
    }

    // Merge with legacy data for notes
    const legacyProject = legacyData[pKey] || {};

    result[pKey] = {
      bua: project.bua || legacyProject.bua || 0,
      price: project.pricePerSqft || legacyProject.price || 0,
      financial,
      proposalLinks: {
        ...(legacyProject.proposalLinks || {}),
        ...proposalLinks,
      },
      evaluation: Object.keys(evaluation).length > 0 ? evaluation : (legacyProject.evaluation || {}),
      notes: legacyProject.notes || "",
    };
  }

  // Also include consultantLinks from legacy data
  if (legacyData.consultantLinks) {
    result.consultantLinks = legacyData.consultantLinks;
  }

  return result;
}

// GET /api/dashboard-data - retrieve data from structured tables
router.get("/", async (_req, res) => {
  try {
    const data = await buildDataFromStructuredTables();
    return res.json(data);
  } catch (e) {
    console.error("[DashboardData] GET error:", e);
    return res.status(500).json({ error: "Failed to load data" });
  }
});

// POST /api/dashboard-data - save data (write to both legacy and structured tables)
router.post("/", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    // Save to legacy dashboardData table
    const jsonData = JSON.stringify(req.body);
    await db.execute(
      sql`INSERT INTO dashboardData (dataKey, dataValue) VALUES ('main', ${jsonData})
          ON DUPLICATE KEY UPDATE dataValue = ${jsonData}`
    );

    // Also sync financial data to structured tables
    try {
      await syncToStructuredTables(db, req.body);
    } catch (syncErr) {
      console.warn("[DashboardData] Sync to structured tables failed:", syncErr);
    }

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
    // Get existing data from structured tables
    const existingData = await buildDataFromStructuredTables();
    // Deep merge
    const updatedData = deepMerge(existingData, req.body);
    const jsonData = JSON.stringify(updatedData);
    await db.execute(
      sql`INSERT INTO dashboardData (dataKey, dataValue) VALUES ('main', ${jsonData})
          ON DUPLICATE KEY UPDATE dataValue = ${jsonData}`
    );

    // Sync to structured tables
    try {
      await syncToStructuredTables(db, updatedData);
    } catch (syncErr) {
      console.warn("[DashboardData] Sync to structured tables failed:", syncErr);
    }

    return res.json({ success: true, data: updatedData });
  } catch (e) {
    console.error("[DashboardData] PATCH error:", e);
    return res.status(500).json({ error: "Failed to update data" });
  }
});

/**
 * Sync data from the old format back to structured tables
 */
async function syncToStructuredTables(db: any, data: any) {
  // Get consultant name -> id mapping
  const [consultantRows] = (await db.execute(
    sql`SELECT id, name FROM consultants`
  )) as any[];
  const consultantMap = new Map<string, number>();
  for (const c of consultantRows) {
    consultantMap.set(c.name, c.id);
  }

  for (const [pKey, pData] of Object.entries(data)) {
    if (!pKey.startsWith("p")) continue;
    const projectId = PROJECT_ID_MAP[pKey];
    if (!projectId) continue;

    const pd = pData as any;

    // Update project BUA and price
    if (pd.bua !== undefined || pd.price !== undefined) {
      const bua = pd.bua || 0;
      const price = pd.price || 0;
      await db.execute(
        sql`UPDATE projects SET bua = ${bua}, pricePerSqft = ${price} WHERE id = ${projectId}`
      );
    }

    // Update financial data
    if (pd.financial && Array.isArray(pd.financial)) {
      for (const fin of pd.financial) {
        const consultantId = consultantMap.get(fin.consultant);
        if (!consultantId) continue;

        const designType = fin.designType === "lump" ? "lumpsum" : "pct";
        const supervisionType = fin.supervisionType === "lump" ? "lumpsum" : "pct";
        // Convert back: HTML uses raw values, DB stores pct * 100
        const designValue = designType === "pct" ? Math.round(fin.designVal * 100) : fin.designVal;
        const supervisionValue = supervisionType === "pct" ? Math.round(fin.supervisionVal * 100) : fin.supervisionVal;

        await db.execute(
          sql`INSERT INTO financialData (projectId, consultantId, designType, designValue, supervisionType, supervisionValue)
              VALUES (${projectId}, ${consultantId}, ${designType}, ${designValue}, ${supervisionType}, ${supervisionValue})
              ON DUPLICATE KEY UPDATE designType = ${designType}, designValue = ${designValue}, 
                                      supervisionType = ${supervisionType}, supervisionValue = ${supervisionValue}`
        );
      }
    }

    // Update proposal links
    if (pd.proposalLinks) {
      for (const [cName, link] of Object.entries(pd.proposalLinks)) {
        const consultantId = consultantMap.get(cName);
        if (!consultantId || !link) continue;
        await db.execute(
          sql`UPDATE financialData SET proposalLink = ${link as string} 
              WHERE projectId = ${projectId} AND consultantId = ${consultantId}`
        );
      }
    }
  }
}

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

export default router;
