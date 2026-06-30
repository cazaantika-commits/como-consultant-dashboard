/**
 * Recalculate all CPA projects via the HTTP API
 * Run: node scripts/recalculate-all.mjs
 */
import http from 'http';

const BASE_URL = 'http://localhost:3000';
const PROJECT_IDS = [180001, 210001, 240001, 240002, 270001, 300001];

async function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(path, BASE_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  for (const pid of PROJECT_IDS) {
    try {
      const res = await post(`/api/cpa/recalculate/${pid}`, {});
      console.log(`Project ${pid}: status=${res.status}`, JSON.stringify(res.body).substring(0, 120));
    } catch (e) {
      console.error(`Project ${pid}: ERROR`, e.message);
    }
  }
  console.log('All done.');
}

main();
