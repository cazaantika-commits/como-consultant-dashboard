import mysql from 'mysql2/promise';

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

const [rows] = await conn.execute(
  `SELECT item_key, name_ar, amount_override, distribution_method, lump_sum_month, start_month, end_month, funding_source 
   FROM project_cash_flow_settings 
   WHERE project_id = 2 AND scenario = 'offplan_escrow' 
   ORDER BY sort_order`
);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
