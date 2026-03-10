import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [svc] = await conn.execute('SELECT DISTINCT serviceCode FROM lifecycle_services ORDER BY serviceCode');
const [req] = await conn.execute('SELECT DISTINCT serviceCode FROM lifecycle_requirements ORDER BY serviceCode');

const svcCodes = new Set(svc.map(r => r.serviceCode));
const reqCodes = new Set(req.map(r => r.serviceCode));

const inReqNotSvc = [...reqCodes].filter(c => !svcCodes.has(c));
const inSvcNotReq = [...svcCodes].filter(c => !reqCodes.has(c));

console.log('In requirements but NOT in services:', JSON.stringify(inReqNotSvc));
console.log('In services but NOT in requirements:', JSON.stringify(inSvcNotReq));
console.log('Total services:', svcCodes.size, '| Total req serviceCodes:', reqCodes.size);

await conn.end();
