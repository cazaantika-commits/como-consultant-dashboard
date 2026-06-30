import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
config({ path: "/home/ubuntu/como-consultant-dashboard/.env" });

const db = await createConnection(process.env.DATABASE_URL);

const roles = [
  { code: "HO_MECHANICAL", rate: 43197.00 },
  { code: "MEP_INSPECTOR", rate: 22627.00 },
  { code: "HO_ELECTRICAL", rate: 43197.00 },
];

for (const r of roles) {
  const [rows] = await db.execute("SELECT id FROM cpa_supervision_roles WHERE code = ?", [r.code]);
  if (!rows[0]) { console.log(`Role ${r.code} not found`); continue; }
  await db.execute(
    "INSERT INTO cpa_consultant_supervision_team (project_consultant_id, supervision_role_id, proposed_allocation_pct, proposed_monthly_rate) VALUES (?, ?, ?, ?)",
    [210005, rows[0].id, 100, r.rate]
  );
  console.log(`Added ${r.code} rate=${r.rate}`);
}

// Verify
const [team] = await db.execute(
  `SELECT r.code, t.proposed_monthly_rate FROM cpa_consultant_supervision_team t
   JOIN cpa_supervision_roles r ON r.id = t.supervision_role_id
   WHERE t.project_consultant_id = 210005 ORDER BY r.sort_order`
);
console.log("\nFinal team:");
team.forEach(m => console.log(` - ${m.code}: ${m.proposed_monthly_rate}`));

await db.end();
console.log("\n✅ Done");
