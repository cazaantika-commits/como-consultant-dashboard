import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/como-consultant-dashboard/.env" });

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Find Nad Al Sheba project
const [projects] = await db.query("SELECT id, name, preConMonths, constructionMonths, handoverMonths, startDate FROM projects WHERE name LIKE '%ند الشبا%' OR name LIKE '%Nad%'");
console.log("Projects found:", projects);

if (projects.length === 0) {
  console.log("No Nad Al Sheba project found. Listing all projects:");
  const [all] = await db.query("SELECT id, name FROM projects");
  console.log(all);
  await db.end();
  process.exit(0);
}

const project = projects[0];
console.log("\n=== Project:", project.name, "(id:", project.id, ") ===");

// Get cf_settings_items for this project (O1 scenario)
const [items] = await db.query(
  "SELECT item_key, section, distribution_method, lump_sum_month, start_month, end_month, custom_json, amount_override, funding_source FROM cf_settings_items WHERE project_id = ? AND scenario = 'offplan_escrow' ORDER BY sort_order",
  [project.id]
);

console.log("\n=== CF Settings Items (O1 offplan_escrow) ===");
console.log("Count:", items.length);

// Compute monthly amounts for each item
const phases = {
  design: { start: 1, duration: project.design_months || 8 },
  offplan: { start: 3, duration: 2 },
  construction: { start: (project.design_months || 8) + 1, duration: project.construction_months || 18 },
  handover: { start: (project.design_months || 8) + (project.construction_months || 18) + 1, duration: project.handover_months || 2 }
};

console.log("\nPhases:", phases);

// Simple distribution function
function distribute(item, phases) {
  const monthly = {};
  const { distribution_method, lump_sum_month, start_month, end_month, custom_json, section, amount_override } = item;
  
  // Determine phase range
  let phaseStart, phaseEnd;
  if (section === "design") { phaseStart = phases.design.start; phaseEnd = phases.design.start + phases.design.duration - 1; }
  else if (section === "offplan") { phaseStart = phases.offplan.start; phaseEnd = phases.offplan.start + phases.offplan.duration - 1; }
  else if (section === "construction") { phaseStart = phases.construction.start; phaseEnd = phases.construction.start + phases.construction.duration - 1; }
  else if (section === "escrow") { phaseStart = phases.offplan.start; phaseEnd = phases.construction.start + phases.construction.duration - 1; }
  else { phaseStart = 1; phaseEnd = 1; }
  
  const amount = amount_override || 0;
  if (!amount) return monthly;
  
  if (distribution_method === "lump_sum") {
    const m = lump_sum_month || phaseStart;
    monthly[m] = (monthly[m] || 0) + amount;
  } else if (distribution_method === "equal") {
    const sM = start_month || phaseStart;
    const eM = end_month || phaseEnd;
    const count = eM - sM + 1;
    if (count > 0) {
      const perMonth = amount / count;
      for (let m = sM; m <= eM; m++) monthly[m] = (monthly[m] || 0) + perMonth;
    }
  } else if (distribution_method === "custom" && custom_json) {
    try {
      const custom = JSON.parse(custom_json);
      for (const [mStr, pct] of Object.entries(custom)) {
        const m = parseInt(mStr);
        monthly[m] = (monthly[m] || 0) + amount * (pct / 100);
      }
    } catch {}
  }
  return monthly;
}

// Aggregate monthly totals
const totalMonthly = {};
let grandTotal = 0;
for (const item of items) {
  if (item.funding_source !== "investor") continue;
  const monthly = distribute(item, phases);
  for (const [m, v] of Object.entries(monthly)) {
    totalMonthly[m] = (totalMonthly[m] || 0) + v;
    grandTotal += v;
  }
}

console.log("\n=== Monthly Investor Totals (O1) ===");
const sortedMonths = Object.keys(totalMonthly).map(Number).sort((a, b) => a - b);
for (const m of sortedMonths) {
  console.log(`  Month ${m}: ${Math.round(totalMonthly[m]).toLocaleString()} AED`);
}
console.log(`\nGrand Total (investor): ${Math.round(grandTotal).toLocaleString()} AED`);

await db.end();
