import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: "/home/ubuntu/como-consultant-dashboard/.env" });

const jsonText = readFileSync("/home/ubuntu/upload/KIEFERLE_6457956.json", "utf-8");
const parsed = JSON.parse(jsonText);

const db = await createConnection(process.env.DATABASE_URL);

// 1. Find consultant id
const [consultants] = await db.execute(
  "SELECT id FROM cpa_consultants_master WHERE code = ? AND is_active = 1",
  [parsed.consultant_code]
);
if (!consultants[0]) throw new Error(`Consultant ${parsed.consultant_code} not found`);
const consultantId = consultants[0].id;
console.log("Consultant ID:", consultantId, "Code:", parsed.consultant_code);

// 2. Find the CPA project for Majan (project_id=2)
// We need cpa_project_id for Majan
const [cpaProjects] = await db.execute(
  "SELECT id FROM cpa_projects WHERE project_id = 2"
);
console.log("CPA Projects for Majan:", cpaProjects);
if (!cpaProjects[0]) throw new Error("CPA project for Majan not found");
const cpaProjectId = cpaProjects[0].id;

// 3. Find existing project consultant record
const [existing] = await db.execute(
  "SELECT id FROM cpa_project_consultants WHERE cpa_project_id = ? AND consultant_id = ?",
  [cpaProjectId, consultantId]
);
console.log("Existing record:", existing[0] ? `id=${existing[0].id}` : "none");

const designMethod = String(parsed.design_fee.method).toUpperCase();
const supMethod = parsed.supervision_fee?.method
  ? String(parsed.supervision_fee.method).toUpperCase()
  : null;
const supSubmitted = parsed.supervision_fee?.submitted ? 1 : 0;
const designFeeAmount = designMethod === "PERCENTAGE" ? null : (parsed.design_fee.amount ?? null);
const supFeeAmount = supMethod === "PERCENTAGE" ? null : (parsed.supervision_fee?.amount ?? null);
const supDuration = parsed.supervision_fee?.stated_duration_months ?? null;

let pcId;
if (existing[0]) {
  pcId = existing[0].id;
  await db.execute(
    `UPDATE cpa_project_consultants SET
       proposal_date=?, proposal_reference=?,
       design_fee_amount=?, design_fee_method=?, design_fee_percentage=?,
       supervision_fee_amount=?, supervision_fee_method=?, supervision_fee_percentage=?,
       supervision_stated_duration_months=?, supervision_submitted=?,
       import_json=?, status='CONFIRMED'
     WHERE id=?`,
    [
      parsed.proposal_date ?? null,
      parsed.proposal_reference ?? null,
      designFeeAmount, designMethod, null,
      supFeeAmount, supMethod, null,
      supDuration, supSubmitted,
      jsonText, pcId
    ]
  );
  console.log("Updated existing record id:", pcId);
} else {
  const [r] = await db.execute(
    `INSERT INTO cpa_project_consultants
       (cpa_project_id, consultant_id, proposal_date, proposal_reference,
        design_fee_amount, design_fee_method, design_fee_percentage,
        supervision_fee_amount, supervision_fee_method, supervision_fee_percentage,
        supervision_stated_duration_months, supervision_submitted, import_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
    [
      cpaProjectId, consultantId,
      parsed.proposal_date ?? null, parsed.proposal_reference ?? null,
      designFeeAmount, designMethod, null,
      supFeeAmount, supMethod, null,
      supDuration, supSubmitted, jsonText
    ]
  );
  pcId = r.insertId;
  console.log("Inserted new record id:", pcId);
}

// 4. Delete existing scope coverage
await db.execute("DELETE FROM cpa_consultant_scope_coverage WHERE project_consultant_id = ?", [pcId]);

// 5. Import scope coverage
let scopeIncluded = 0, scopeExcluded = 0, scopeNotMentioned = 0;
for (const item of (parsed.scope_coverage || [])) {
  const [scopeRows] = await db.execute(
    "SELECT id FROM cpa_scope_items WHERE item_number = ? AND is_active = 1",
    [item.item_number]
  );
  if (!scopeRows[0]) { console.warn(`Scope item ${item.item_number} not found`); continue; }
  const status = String(item.status).toUpperCase();
  if (status === "INCLUDED") scopeIncluded++;
  else if (status === "EXCLUDED") scopeExcluded++;
  else scopeNotMentioned++;
  await db.execute(
    `INSERT INTO cpa_consultant_scope_coverage (project_consultant_id, scope_item_id, coverage_status, notes)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE coverage_status = VALUES(coverage_status), notes = VALUES(notes)`,
    [pcId, scopeRows[0].id, status, item.note ?? null]
  );
}
console.log(`Scope: included=${scopeIncluded}, excluded=${scopeExcluded}, notMentioned=${scopeNotMentioned}`);

// 6. Delete existing supervision team
await db.execute("DELETE FROM cpa_consultant_supervision_team WHERE project_consultant_id = ?", [pcId]);

// 7. Import supervision team
const teamMembers = parsed.supervision_fee?.team ?? [];
let rolesImported = 0;
for (const member of teamMembers) {
  const [roleRows] = await db.execute(
    "SELECT id FROM cpa_supervision_roles WHERE code = ?",
    [member.role_code]
  );
  if (!roleRows[0]) { console.warn(`Role not found: ${member.role_code}`); continue; }
  const rawAlloc = member.proposed_allocation_pct ?? member.allocation_pct;
  const memberAlloc = rawAlloc === undefined ? 100 : rawAlloc;
  const memberRate = member.proposed_monthly_rate ?? member.monthly_rate ?? null;
  await db.execute(
    `INSERT INTO cpa_consultant_supervision_team (project_consultant_id, supervision_role_id, proposed_allocation_pct, proposed_monthly_rate)
     VALUES (?, ?, ?, ?)`,
    [pcId, roleRows[0].id, memberAlloc, memberRate]
  );
  rolesImported++;
}
console.log(`Supervision team: ${rolesImported} roles imported`);

await db.end();
console.log("\n✅ KIEFERLE import complete!");
console.log(`Design fee: ${designFeeAmount} (${designMethod})`);
console.log(`Supervision: ${supMethod}, duration: ${supDuration} months`);
