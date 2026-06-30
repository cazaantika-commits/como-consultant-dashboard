/**
 * Verify KIEFERLE calculation engine result
 * Run: node scripts/verify-kieferle.mjs
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const db = await createConnection(process.env.DATABASE_URL);

// Get KIEFERLE project consultant
const [pcRows] = await db.execute(
  "SELECT pc.*, cp.id as cpa_project_id, cp.duration_months, cp.building_category_id FROM cpa_project_consultants pc JOIN cpa_projects cp ON cp.id = pc.cpa_project_id WHERE pc.id = 210005"
);
const pc = pcRows[0];
console.log("KIEFERLE consultant:", {
  id: pc.id,
  cpa_project_id: pc.cpa_project_id,
  supervision_fee_method: pc.supervision_fee_method,
  duration_months: pc.duration_months,
  building_category_id: pc.building_category_id,
});

// Get aliases
const [aliasRows] = await db.execute(
  "SELECT a.alias_code, a.canonical_role_id, sr.code as canonical_code FROM cpa_supervision_role_aliases a JOIN cpa_supervision_roles sr ON sr.id = a.canonical_role_id"
);
console.log("\nAliases:", aliasRows);

// Get supervision baseline for the category
const [baselineRows] = await db.execute(
  `SELECT sr.code, sb.required_allocation_pct, sb.supervision_role_id
   FROM cpa_supervision_baseline sb
   JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
   WHERE sb.building_category_id = ?`, [pc.building_category_id]
);
console.log("\nBaseline for category", pc.building_category_id + ":");
for (const b of baselineRows) {
  console.log(`  ${b.code}: ${b.required_allocation_pct}%`);
}

// Get supervision team
const [teamRows] = await db.execute(
  `SELECT cst.supervision_role_id, cst.proposed_allocation_pct, cst.proposed_monthly_rate,
          sr.code as role_code, sr.label as role_label
   FROM cpa_consultant_supervision_team cst
   JOIN cpa_supervision_roles sr ON sr.id = cst.supervision_role_id
   WHERE cst.project_consultant_id = 210005`
);

// Build alias map
const aliasMap = {};
for (const a of aliasRows) {
  aliasMap[a.alias_code] = Number(a.canonical_role_id);
}

// Build baseline map
const baselineMap = {};
for (const b of baselineRows) {
  baselineMap[Number(b.supervision_role_id)] = Number(b.required_allocation_pct);
}

const durationMonths = Number(pc.duration_months);
console.log("\nDuration months:", durationMonths);

let total = 0;
console.log("\nSupervision fee calculation:");
for (const row of teamRows) {
  const roleId = Number(row.supervision_role_id);
  const roleCode = String(row.role_code ?? "");
  const canonicalRoleId = aliasMap[roleCode] !== undefined ? aliasMap[roleCode] : roleId;
  const baselinePct = baselineMap[canonicalRoleId] ?? 100;
  const proposedPct = Number(row.proposed_allocation_pct ?? 0);
  const effectiveAlloc = proposedPct > 0 ? proposedPct : baselinePct;
  const rate = Number(row.proposed_monthly_rate ?? 0);
  const fee = rate * durationMonths * (effectiveAlloc / 100);
  total += fee;
  const aliasNote = aliasMap[roleCode] !== undefined ? ` [ALIAS→${aliasMap[roleCode]}]` : "";
  console.log(`  ${roleCode}${aliasNote}: rate=${rate.toLocaleString()} × ${durationMonths}mo × ${effectiveAlloc}% = ${fee.toLocaleString()} AED`);
}
console.log(`\nTotal supervision fee: ${total.toLocaleString()} AED`);
console.log(`Design fee: ${Number(pc.design_fee_amount).toLocaleString()} AED`);
console.log(`Total: ${(total + Number(pc.design_fee_amount)).toLocaleString()} AED`);

await db.end();
