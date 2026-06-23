import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL || '';
// Parse: mysql://user:pass@host:port/db?ssl=...
const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):(\d+)\/([^?]+)/);
if (!m) { console.log('Cannot parse DATABASE_URL:', url.substring(0, 50)); process.exit(1); }

const conn = await createConnection({
  host: m[3], port: +m[4], user: m[1], password: m[2], database: m[5],
  ssl: { rejectUnauthorized: false }
});

console.log('=== cpa_evaluation_results for project 180001 ===');
const [cols] = await conn.execute('DESCRIBE cpa_evaluation_results');
console.log('Columns:', JSON.stringify(cols.map(c => c.Field)));
const [r] = await conn.execute('SELECT * FROM cpa_evaluation_results LIMIT 3');
console.log(JSON.stringify(r, null, 2));

console.log('\n=== financialData for project 2 ===');
const [fd] = await conn.execute(
  'SELECT * FROM financial_data WHERE project_id = 2 LIMIT 10'
);
console.log(JSON.stringify(fd, null, 2));

await conn.end();
