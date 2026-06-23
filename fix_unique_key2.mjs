import mysql from "mysql2/promise";

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Keep removing duplicates until none remain
let round = 0;
while (true) {
  round++;
  const [dups] = await db.execute(`
    SELECT MIN(id) as old_id FROM cpa_scope_category_matrix 
    GROUP BY scope_item_id, building_category_id 
    HAVING COUNT(*) > 1
  `);
  if (dups.length === 0) {
    console.log(`Round ${round}: No more duplicates!`);
    break;
  }
  console.log(`Round ${round}: Removing ${dups.length} duplicates...`);
  for (const d of dups) {
    await db.execute("DELETE FROM cpa_scope_category_matrix WHERE id = ?", [d.old_id]);
  }
}

// Add unique constraint
try {
  await db.execute("ALTER TABLE cpa_scope_category_matrix ADD UNIQUE KEY uq_scope_cat (scope_item_id, building_category_id)");
  console.log("UNIQUE KEY added successfully!");
} catch (e) {
  if (e.sqlMessage && e.sqlMessage.includes("Duplicate key name")) {
    console.log("UNIQUE KEY already exists");
  } else {
    console.error("Error adding key:", e.sqlMessage);
  }
}

// Final verification
const [check] = await db.execute(`
  SELECT bc.code, si.code as svc, scm.status 
  FROM cpa_scope_category_matrix scm 
  JOIN cpa_building_categories bc ON bc.id = scm.building_category_id 
  JOIN cpa_scope_items si ON si.id = scm.scope_item_id 
  WHERE si.code IN ('COST_MANAGEMENT', 'VALUE_ENGINEERING')
  ORDER BY bc.id
`);
console.log("\nFinal status:");
check.forEach(x => console.log(x.code, x.svc, "->", x.status));

await db.end();
