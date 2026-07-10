/**
 * S-Curve Distribution Fix Script
 * 
 * Changes construction cost (contractor_payments and contractor_payments_20) distribution
 * from equal_spread to S-Curve (custom) for all 6 projects across all scenarios.
 * 
 * S-Curve logic:
 * - Uses beta distribution PDF (alpha=2.5, beta=4.0) to model construction spending
 * - Slow start (foundations/excavation) → peak around 30-40% → taper end (finishes)
 * - The percentages in customJson represent monthly % of the total amount
 * - Sum of all percentages = 100%
 * 
 * Does NOT change:
 * - Total amounts (amountOverride stays null or unchanged)
 * - contractor_advance (10% lump sum at start — already correct)
 * - startMonth / endMonth (construction phase timing stays the same)
 */

import mysql from 'mysql2/promise';

/**
 * Generate S-Curve monthly percentages using Beta distribution PDF
 * alpha=2.5, beta=4.0 gives:
 *   - Peak around 30% of duration (month ~9 of 30)
 *   - Slow ramp up first 20% (foundations, excavation)
 *   - Heavy middle 20-60% (structure, MEP rough-in)
 *   - Gradual taper 60-100% (finishes, testing, handover prep)
 */
function generateSCurve(numMonths) {
  const alpha = 2.5;
  const beta = 4.0;
  
  // Compute beta PDF value at midpoint of each month interval
  const weights = [];
  for (let i = 0; i < numMonths; i++) {
    const t = (i + 0.5) / numMonths; // midpoint of month i in [0,1]
    // Beta PDF: t^(a-1) * (1-t)^(b-1)
    const w = Math.pow(t, alpha - 1) * Math.pow(1 - t, beta - 1);
    weights.push(w);
  }
  
  // Normalize to sum = 100%
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const percentages = weights.map(w => Math.round((w / totalWeight) * 10000) / 100);
  
  // Fix rounding error: adjust peak month so sum = exactly 100
  const sum = percentages.reduce((a, b) => a + b, 0);
  const diff = Math.round((100 - sum) * 100) / 100;
  if (diff !== 0) {
    // Find peak month and adjust
    const maxIdx = percentages.indexOf(Math.max(...percentages));
    percentages[maxIdx] = Math.round((percentages[maxIdx] + diff) * 100) / 100;
  }
  
  return percentages;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    // Get all contractor_payments and contractor_payments_20 rows for projects 1-6
    const [rows] = await conn.execute(`
      SELECT id, project_id, scenario, item_key, distribution_method, start_month, end_month
      FROM project_cash_flow_settings 
      WHERE item_key IN ('contractor_payments', 'contractor_payments_20')
      AND project_id <= 6
      ORDER BY project_id, scenario, item_key
    `);
    
    console.log(`Found ${rows.length} rows to update`);
    
    let updated = 0;
    
    for (const row of rows) {
      const startMonth = row.start_month;
      const endMonth = row.end_month;
      
      if (!startMonth || !endMonth) {
        console.log(`  Skipping id=${row.id} (P${row.project_id}/${row.scenario}/${row.item_key}) — no start/end month`);
        continue;
      }
      
      const numMonths = endMonth - startMonth + 1;
      if (numMonths < 2) {
        console.log(`  Skipping id=${row.id} — only ${numMonths} month(s)`);
        continue;
      }
      
      // Generate S-Curve percentages for this duration
      const scurve = generateSCurve(numMonths);
      const customJson = JSON.stringify(scurve);
      
      // Verify sum ≈ 100
      const sum = scurve.reduce((a, b) => a + b, 0);
      
      // Update the row: change distribution_method to 'custom' and set custom_json
      await conn.execute(`
        UPDATE project_cash_flow_settings 
        SET distribution_method = 'custom', custom_json = ?
        WHERE id = ?
      `, [customJson, row.id]);
      
      console.log(`  ✓ id=${row.id} P${row.project_id}/${row.scenario}/${row.item_key}: ${numMonths}mo, sum=${sum.toFixed(2)}%`);
      updated++;
    }
    
    console.log(`\n✅ Done! Updated ${updated} rows to S-Curve distribution.`);
    
    // Print sample S-curves for verification
    console.log('\n--- Sample S-Curve (30 months — P1, P2): ---');
    const s30 = generateSCurve(30);
    console.log(s30.map((p, i) => `M${i+1}:${p.toFixed(2)}%`).join(' | '));
    console.log(`Sum: ${s30.reduce((a, b) => a + b, 0).toFixed(2)}%`);
    
    console.log('\n--- Sample S-Curve (20 months — P5): ---');
    const s20 = generateSCurve(20);
    console.log(s20.map((p, i) => `M${i+1}:${p.toFixed(2)}%`).join(' | '));
    console.log(`Sum: ${s20.reduce((a, b) => a + b, 0).toFixed(2)}%`);
    
    console.log('\n--- Sample S-Curve (18 months — P3, P4): ---');
    const s18 = generateSCurve(18);
    console.log(s18.map((p, i) => `M${i+1}:${p.toFixed(2)}%`).join(' | '));
    console.log(`Sum: ${s18.reduce((a, b) => a + b, 0).toFixed(2)}%`);
    
    console.log('\n--- Sample S-Curve (14 months — P6): ---');
    const s14 = generateSCurve(14);
    console.log(s14.map((p, i) => `M${i+1}:${p.toFixed(2)}%`).join(' | '));
    console.log(`Sum: ${s14.reduce((a, b) => a + b, 0).toFixed(2)}%`);
    
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
