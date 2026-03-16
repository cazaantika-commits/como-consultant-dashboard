import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
config();

const CPA_PROJECT_ID = 150001;
const FILES = [
  '/home/ubuntu/upload/AAEC.json',
  '/home/ubuntu/upload/DEC.json',
  '/home/ubuntu/upload/KIEFERLE.json',
  '/home/ubuntu/upload/LACASA.json',
  '/home/ubuntu/upload/XYZ.json',
];

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  console.log('Connected to DB');

  for (const filePath of FILES) {
    const jsonText = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(jsonText);
    const code = parsed.consultant_code;
    console.log(`\n=== Importing ${code} ===`);

    // Get consultant ID
    const [consultants] = await conn.query(
      'SELECT id FROM cpa_consultants_master WHERE code = ? AND is_active = 1',
      [code]
    );
    if (!consultants[0]) {
      console.log(`  ERROR: consultant code "${code}" not found`);
      continue;
    }
    const consultantId = consultants[0].id;
    console.log(`  consultant_id: ${consultantId}`);

    // Parse fee data
    const designMethod = String(parsed.design_fee.method).toUpperCase();
    const supMethod = parsed.supervision_fee?.method
      ? String(parsed.supervision_fee.method).toUpperCase()
      : null;
    const supSubmitted = parsed.supervision_fee?.submitted ? 1 : 0;

    const rawDesignPct = parsed.design_fee.percentage ?? null;
    const normalizedDesignPct = rawDesignPct !== null ? (rawDesignPct < 1 ? rawDesignPct * 100 : rawDesignPct) : null;
    const rawSupPct = parsed.supervision_fee?.percentage ?? null;
    const normalizedSupPct = rawSupPct !== null ? (rawSupPct < 1 ? rawSupPct * 100 : rawSupPct) : null;
    const designFeeAmount = designMethod === 'PERCENTAGE' ? null : (parsed.design_fee.amount ?? null);
    const supFeeAmount = supMethod === 'PERCENTAGE' ? null : (parsed.supervision_fee?.amount ?? null);

    console.log(`  designMethod: ${designMethod}, designFeeAmount: ${designFeeAmount}, designPct: ${normalizedDesignPct}`);
    console.log(`  supMethod: ${supMethod}, supFeeAmount: ${supFeeAmount}, supSubmitted: ${supSubmitted}`);

    // Check if exists
    const [existing] = await conn.query(
      'SELECT id FROM cpa_project_consultants WHERE cpa_project_id = ? AND consultant_id = ?',
      [CPA_PROJECT_ID, consultantId]
    );

    let pcId;
    if (existing[0]) {
      pcId = existing[0].id;
      await conn.query(
        `UPDATE cpa_project_consultants SET
          proposal_date=?, proposal_reference=?,
          design_fee_amount=?, design_fee_method=?, design_fee_percentage=?,
          supervision_fee_amount=?, supervision_fee_method=?, supervision_fee_percentage=?,
          supervision_stated_duration_months=?, supervision_submitted=?,
          import_json=?, status='CONFIRMED'
        WHERE id=?`,
        [
          parsed.proposal_date ?? null, parsed.proposal_reference ?? null,
          designFeeAmount, designMethod, normalizedDesignPct,
          supFeeAmount, supMethod, normalizedSupPct,
          parsed.supervision_fee?.stated_duration_months ?? null, supSubmitted,
          jsonText, pcId
        ]
      );
      console.log(`  Updated existing record id=${pcId}`);
    } else {
      const [result] = await conn.query(
        `INSERT INTO cpa_project_consultants
          (cpa_project_id, consultant_id, proposal_date, proposal_reference,
           design_fee_amount, design_fee_method, design_fee_percentage,
           supervision_fee_amount, supervision_fee_method, supervision_fee_percentage,
           supervision_stated_duration_months, supervision_submitted, import_json, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
        [
          CPA_PROJECT_ID, consultantId,
          parsed.proposal_date ?? null, parsed.proposal_reference ?? null,
          designFeeAmount, designMethod, normalizedDesignPct,
          supFeeAmount, supMethod, normalizedSupPct,
          parsed.supervision_fee?.stated_duration_months ?? null, supSubmitted,
          jsonText
        ]
      );
      pcId = result.insertId;
      console.log(`  Inserted new record id=${pcId}`);
    }

    // Import scope coverage
    await conn.query('DELETE FROM cpa_consultant_scope_coverage WHERE project_consultant_id = ?', [pcId]);
    let scopeCount = 0;
    for (const item of (parsed.scope_coverage || [])) {
      let scopeRows;
      if (item.item_code) {
        [scopeRows] = await conn.query('SELECT id FROM cpa_scope_items WHERE code = ? AND is_active = 1', [item.item_code]);
      } else if (item.item_number != null) {
        [scopeRows] = await conn.query('SELECT id FROM cpa_scope_items WHERE item_number = ? AND is_active = 1', [item.item_number]);
      }
      if (!scopeRows?.[0]) continue;
      const status = String(item.status).toUpperCase();
      const itemNote = item.note ?? null;
      await conn.query(
        `INSERT INTO cpa_consultant_scope_coverage (project_consultant_id, scope_item_id, coverage_status, notes)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE coverage_status=VALUES(coverage_status), notes=VALUES(notes)`,
        [pcId, scopeRows[0].id, status, itemNote]
      );
      scopeCount++;
    }
    console.log(`  Scope coverage: ${scopeCount} items imported`);

    // Import supervision team
    await conn.query('DELETE FROM cpa_consultant_supervision_team WHERE project_consultant_id = ?', [pcId]);
    const teamMembers = parsed.supervision_team ?? parsed.supervision_fee?.team ?? [];
    let teamCount = 0;
    for (const member of teamMembers) {
      const roleCode = member.role_code;
      const [roleRows] = await conn.query('SELECT id FROM cpa_supervision_roles WHERE code = ? AND is_active = 1', [roleCode]);
      if (!roleRows[0]) { console.log(`  WARNING: role not found: ${roleCode}`); continue; }
      const rawAlloc = member.proposed_allocation_pct ?? member.allocation_pct;
      const memberAlloc = rawAlloc === undefined ? 100 : rawAlloc;
      const memberRate = member.proposed_monthly_rate ?? member.monthly_rate ?? null;
      await conn.query(
        'INSERT INTO cpa_consultant_supervision_team (project_consultant_id, supervision_role_id, proposed_allocation_pct, proposed_monthly_rate) VALUES (?, ?, ?, ?)',
        [pcId, roleRows[0].id, memberAlloc, memberRate]
      );
      teamCount++;
    }
    console.log(`  Supervision team: ${teamCount} members imported`);
  }

  await conn.end();
  console.log('\n✅ All imports done');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
