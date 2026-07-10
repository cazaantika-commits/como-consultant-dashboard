import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Check portfolio_scenarios table
  const [rows] = await conn.execute('SELECT id, user_id, name, is_default, settings, created_at, updated_at FROM portfolio_scenarios ORDER BY updated_at DESC LIMIT 5');
  console.log(`\n=== Portfolio Scenarios (${rows.length} rows) ===`);
  for (const row of rows) {
    console.log(`\nID: ${row.id}, User: ${row.user_id}, Name: ${row.name}, Default: ${row.is_default}`);
    console.log(`  Updated: ${row.updated_at}`);
    try {
      const settings = JSON.parse(row.settings);
      console.log(`  projectOptions: ${JSON.stringify(settings.projectOptions)}`);
      console.log(`  delays: ${JSON.stringify(settings.delays)}`);
      console.log(`  hiddenProjects: ${JSON.stringify(settings.hiddenProjects)}`);
      console.log(`  groupBy: ${settings.groupBy}, viewMode: ${settings.viewMode}`);
    } catch (e) {
      console.log(`  Settings parse error: ${e.message}`);
      console.log(`  Raw settings: ${row.settings?.substring(0, 200)}`);
    }
  }
  
  // Check the API response time
  console.log('\n=== API Performance Check ===');
  const start = Date.now();
  const [projects] = await conn.execute('SELECT COUNT(*) as cnt FROM projects');
  const [settings] = await conn.execute('SELECT COUNT(*) as cnt FROM project_cash_flow_settings');
  const elapsed = Date.now() - start;
  console.log(`  Projects: ${projects[0].cnt}, Settings: ${settings[0].cnt}`);
  console.log(`  DB query time: ${elapsed}ms`);
  
  // Check for any corrupted settings (custom distribution with bad JSON)
  const [badJson] = await conn.execute(`
    SELECT id, project_id, item_key, distribution_method, custom_json 
    FROM project_cash_flow_settings 
    WHERE distribution_method = 'custom' AND (custom_json IS NULL OR custom_json = '' OR custom_json = 'null')
  `);
  console.log(`\n=== Bad Custom Distribution Settings: ${badJson.length} rows ===`);
  for (const row of badJson) {
    console.log(`  ID: ${row.id}, Project: ${row.project_id}, Item: ${row.item_key}, JSON: ${row.custom_json}`);
  }
  
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
