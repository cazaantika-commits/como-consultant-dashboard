import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT optStudioPrice, opt1BrPrice, opt2BrPrice, opt3BrPrice, baseStudioPrice, base1BrPrice, base2BrPrice, base3BrPrice, consStudioPrice, cons1BrPrice, cons2BrPrice, cons3BrPrice, activeScenario FROM competition_pricing WHERE projectId = 4');
console.log(JSON.stringify(rows[0], null, 2));
await conn.end();
