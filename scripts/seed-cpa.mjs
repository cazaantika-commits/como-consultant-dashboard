import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function run() {
  console.log('=== Seeding CPA Initial Data ===');

  // ─── 1. CLEAR existing CPA seed data ───
  await conn.execute('DELETE FROM cpa_supervision_baseline');
  await conn.execute('DELETE FROM cpa_scope_reference_costs');
  await conn.execute('DELETE FROM cpa_scope_category_matrix');
  await conn.execute('DELETE FROM cpa_supervision_roles');
  await conn.execute('DELETE FROM cpa_scope_items');
  await conn.execute('DELETE FROM cpa_building_categories');
  await conn.execute('DELETE FROM cpa_consultants_master');
  // Reset auto-increment
  for (const t of ['cpa_supervision_baseline','cpa_scope_reference_costs','cpa_scope_category_matrix','cpa_supervision_roles','cpa_scope_items','cpa_building_categories','cpa_consultants_master']) {
    try { await conn.execute(`ALTER TABLE ${t} AUTO_INCREMENT = 1`); } catch(e) {}
  }
  console.log('Cleared old seed data');

  // ─── 2. BUILDING CATEGORIES ───
  const categories = [
    { code: 'VILLA',  label: 'فيلا / تاون هاوس',         bua_min: 0,       bua_max: 5000,    sort_order: 1, desc: 'مباني سكنية منخفضة الارتفاع حتى 5,000 قدم مربع' },
    { code: 'SMALL',  label: 'مبنى صغير',                 bua_min: 5001,    bua_max: 30000,   sort_order: 2, desc: 'مباني من 5,001 إلى 30,000 قدم مربع' },
    { code: 'MEDIUM', label: 'مبنى متوسط',                bua_min: 30001,   bua_max: 100000,  sort_order: 3, desc: 'مباني من 30,001 إلى 100,000 قدم مربع' },
    { code: 'LARGE',  label: 'مبنى كبير',                 bua_min: 100001,  bua_max: 300000,  sort_order: 4, desc: 'مباني من 100,001 إلى 300,000 قدم مربع' },
    { code: 'MEGA',   label: 'مشروع ضخم / متكامل',        bua_min: 300001,  bua_max: 9999999, sort_order: 5, desc: 'مشاريع أكثر من 300,000 قدم مربع' },
  ];
  const catIds = {};
  for (const c of categories) {
    const [res] = await conn.execute(
      'INSERT INTO cpa_building_categories (code, label, bua_min_sqft, bua_max_sqft, description, sort_order, is_active) VALUES (?,?,?,?,?,?,1)',
      [c.code, c.label, c.bua_min, c.bua_max, c.desc, c.sort_order]
    );
    catIds[c.code] = res.insertId;
  }
  console.log(`Inserted ${categories.length} building categories`, catIds);

  // ─── 3. SCOPE ITEMS ───
  const items = [
    { code: 'ARCH_DESIGN',           label: 'التصميم المعماري',                          default_type: 'CORE', num: 1,  sort: 1 },
    { code: 'STRUCTURAL_DESIGN',     label: 'التصميم الإنشائي',                          default_type: 'CORE', num: 2,  sort: 2 },
    { code: 'MEP_DESIGN',            label: 'تصميم الميكانيكا والكهرباء والسباكة (MEP)', default_type: 'CORE', num: 3,  sort: 3 },
    { code: 'INTERIOR_DESIGN',       label: 'التصميم الداخلي',                           default_type: 'CORE', num: 4,  sort: 4 },
    { code: 'LANDSCAPE_DESIGN',      label: 'تصميم المناظر الطبيعية',                    default_type: 'CORE', num: 5,  sort: 5 },
    { code: 'BIM',                   label: 'نمذجة معلومات البناء (BIM)',                default_type: 'GREEN', num: 6, sort: 6 },
    { code: 'PERMIT_DRAWINGS',       label: 'رسومات الترخيص',                            default_type: 'CORE', num: 7,  sort: 7 },
    { code: 'SHOP_DRAWINGS',         label: 'رسومات التنفيذ (Shop Drawings)',            default_type: 'CORE', num: 8,  sort: 8 },
    { code: 'SITE_SUPERVISION',      label: 'الإشراف الميداني',                          default_type: 'CORE', num: 9,  sort: 9 },
    { code: 'STRUCTURAL_AUDIT',      label: 'التدقيق الإنشائي',                          default_type: 'GREEN', num: 10, sort: 10 },
    { code: 'GREEN_BUILDING',        label: 'الاستدامة والمباني الخضراء',                default_type: 'GREEN', num: 11, sort: 11 },
    { code: 'SECURITY_SIRA',         label: 'الأمن والسلامة (SIRA)',                     default_type: 'GREEN', num: 12, sort: 12 },
    { code: 'VERTICAL_TRANSPORT',    label: 'النقل الرأسي (مصاعد / سلالم كهربائية)',    default_type: 'GREEN', num: 13, sort: 13 },
    { code: 'AV_ELV',               label: 'الصوت والصورة والأنظمة الذكية (AV/ELV)',   default_type: 'GREEN', num: 14, sort: 14 },
    { code: 'FACADE_LIGHTING',       label: 'إضاءة الواجهات',                            default_type: 'GREEN', num: 15, sort: 15 },
    { code: 'FLS',                   label: 'نظام الإنذار والإطفاء (FLS)',               default_type: 'GREEN', num: 16, sort: 16 },
    { code: 'TESTING_COMMISSIONING', label: 'الاختبار والتشغيل',                         default_type: 'RED',   num: 17, sort: 17 },
    { code: 'AS_BUILT',              label: 'رسومات ما تم تنفيذه (As-Built)',            default_type: 'RED',   num: 18, sort: 18 },
  ];

  const itemIds = {};
  for (const item of items) {
    const [res] = await conn.execute(
      'INSERT INTO cpa_scope_items (item_number, code, label, default_type, sort_order, is_active) VALUES (?,?,?,?,?,1)',
      [item.num, item.code, item.label, item.default_type, item.sort]
    );
    itemIds[item.code] = res.insertId;
  }
  console.log(`Inserted ${items.length} scope items`);

  // ─── 4. SUPERVISION ROLES ───
  const roles = [
    { code: 'RE',              label: 'مهندس مقيم (Resident Engineer)',         grade: 'SENIOR', team: 'SITE', rate: 35000, sort: 1 },
    { code: 'CIVIL_INSPECTOR', label: 'مفتش مدني',                              grade: 'MID',    team: 'SITE', rate: 18000, sort: 2 },
    { code: 'MEP_INSPECTOR',   label: 'مفتش ميكانيكا وكهرباء',                  grade: 'MID',    team: 'SITE', rate: 18000, sort: 3 },
    { code: 'HSE_OFFICER',     label: 'مسؤول الصحة والسلامة والبيئة (HSE)',      grade: 'MID',    team: 'SITE', rate: 15000, sort: 4 },
    { code: 'DOC_CONTROLLER',  label: 'مراقب الوثائق',                           grade: 'JUNIOR', team: 'SITE', rate: 10000, sort: 5 },
    { code: 'QA_QC',           label: 'مراقب الجودة (QA/QC)',                    grade: 'MID',    team: 'SITE', rate: 18000, sort: 6 },
    { code: 'HO_STRUCTURAL',   label: 'مراجع هيكلي - المكتب الرئيسي',           grade: 'SENIOR', team: 'HEAD_OFFICE', rate: 20000, sort: 7 },
    { code: 'HO_ARCH',         label: 'مراجع معماري - المكتب الرئيسي',           grade: 'SENIOR', team: 'HEAD_OFFICE', rate: 20000, sort: 8 },
    { code: 'HO_MECHANICAL',   label: 'مراجع ميكانيكي - المكتب الرئيسي',        grade: 'SENIOR', team: 'HEAD_OFFICE', rate: 18000, sort: 9 },
    { code: 'HO_ELECTRICAL',   label: 'مراجع كهربائي - المكتب الرئيسي',         grade: 'SENIOR', team: 'HEAD_OFFICE', rate: 18000, sort: 10 },
    { code: 'ADMIN',           label: 'مساعد إداري',                             grade: 'JUNIOR', team: 'SITE', rate: 8000,  sort: 11 },
  ];

  const roleIds = {};
  for (const role of roles) {
    const [res] = await conn.execute(
      'INSERT INTO cpa_supervision_roles (code, label, grade, team_type, monthly_rate_aed, sort_order, is_active) VALUES (?,?,?,?,?,?,1)',
      [role.code, role.label, role.grade, role.team, role.rate, role.sort]
    );
    roleIds[role.code] = res.insertId;
  }
  console.log(`Inserted ${roles.length} supervision roles`);

  // ─── 5. SCOPE CATEGORY MATRIX ───
  const matrixData = [
    // VILLA
    ['ARCH_DESIGN','VILLA','INCLUDED'],['STRUCTURAL_DESIGN','VILLA','INCLUDED'],['MEP_DESIGN','VILLA','INCLUDED'],
    ['INTERIOR_DESIGN','VILLA','GREEN'],['LANDSCAPE_DESIGN','VILLA','GREEN'],['BIM','VILLA','NOT_REQUIRED'],
    ['PERMIT_DRAWINGS','VILLA','INCLUDED'],['SHOP_DRAWINGS','VILLA','INCLUDED'],['SITE_SUPERVISION','VILLA','INCLUDED'],
    ['STRUCTURAL_AUDIT','VILLA','GREEN'],['GREEN_BUILDING','VILLA','NOT_REQUIRED'],['SECURITY_SIRA','VILLA','NOT_REQUIRED'],
    ['VERTICAL_TRANSPORT','VILLA','NOT_REQUIRED'],['AV_ELV','VILLA','GREEN'],['FACADE_LIGHTING','VILLA','NOT_REQUIRED'],
    ['FLS','VILLA','INCLUDED'],['TESTING_COMMISSIONING','VILLA','RED'],['AS_BUILT','VILLA','RED'],
    // SMALL
    ['ARCH_DESIGN','SMALL','INCLUDED'],['STRUCTURAL_DESIGN','SMALL','INCLUDED'],['MEP_DESIGN','SMALL','INCLUDED'],
    ['INTERIOR_DESIGN','SMALL','GREEN'],['LANDSCAPE_DESIGN','SMALL','GREEN'],['BIM','SMALL','GREEN'],
    ['PERMIT_DRAWINGS','SMALL','INCLUDED'],['SHOP_DRAWINGS','SMALL','INCLUDED'],['SITE_SUPERVISION','SMALL','INCLUDED'],
    ['STRUCTURAL_AUDIT','SMALL','GREEN'],['GREEN_BUILDING','SMALL','GREEN'],['SECURITY_SIRA','SMALL','INCLUDED'],
    ['VERTICAL_TRANSPORT','SMALL','GREEN'],['AV_ELV','SMALL','GREEN'],['FACADE_LIGHTING','SMALL','GREEN'],
    ['FLS','SMALL','INCLUDED'],['TESTING_COMMISSIONING','SMALL','RED'],['AS_BUILT','SMALL','RED'],
    // MEDIUM
    ['ARCH_DESIGN','MEDIUM','INCLUDED'],['STRUCTURAL_DESIGN','MEDIUM','INCLUDED'],['MEP_DESIGN','MEDIUM','INCLUDED'],
    ['INTERIOR_DESIGN','MEDIUM','GREEN'],['LANDSCAPE_DESIGN','MEDIUM','INCLUDED'],['BIM','MEDIUM','INCLUDED'],
    ['PERMIT_DRAWINGS','MEDIUM','INCLUDED'],['SHOP_DRAWINGS','MEDIUM','INCLUDED'],['SITE_SUPERVISION','MEDIUM','INCLUDED'],
    ['STRUCTURAL_AUDIT','MEDIUM','INCLUDED'],['GREEN_BUILDING','MEDIUM','GREEN'],['SECURITY_SIRA','MEDIUM','INCLUDED'],
    ['VERTICAL_TRANSPORT','MEDIUM','INCLUDED'],['AV_ELV','MEDIUM','GREEN'],['FACADE_LIGHTING','MEDIUM','GREEN'],
    ['FLS','MEDIUM','INCLUDED'],['TESTING_COMMISSIONING','MEDIUM','RED'],['AS_BUILT','MEDIUM','RED'],
    // LARGE
    ['ARCH_DESIGN','LARGE','INCLUDED'],['STRUCTURAL_DESIGN','LARGE','INCLUDED'],['MEP_DESIGN','LARGE','INCLUDED'],
    ['INTERIOR_DESIGN','LARGE','INCLUDED'],['LANDSCAPE_DESIGN','LARGE','INCLUDED'],['BIM','LARGE','INCLUDED'],
    ['PERMIT_DRAWINGS','LARGE','INCLUDED'],['SHOP_DRAWINGS','LARGE','INCLUDED'],['SITE_SUPERVISION','LARGE','INCLUDED'],
    ['STRUCTURAL_AUDIT','LARGE','INCLUDED'],['GREEN_BUILDING','LARGE','INCLUDED'],['SECURITY_SIRA','LARGE','INCLUDED'],
    ['VERTICAL_TRANSPORT','LARGE','INCLUDED'],['AV_ELV','LARGE','GREEN'],['FACADE_LIGHTING','LARGE','GREEN'],
    ['FLS','LARGE','INCLUDED'],['TESTING_COMMISSIONING','LARGE','RED'],['AS_BUILT','LARGE','RED'],
    // MEGA
    ['ARCH_DESIGN','MEGA','INCLUDED'],['STRUCTURAL_DESIGN','MEGA','INCLUDED'],['MEP_DESIGN','MEGA','INCLUDED'],
    ['INTERIOR_DESIGN','MEGA','INCLUDED'],['LANDSCAPE_DESIGN','MEGA','INCLUDED'],['BIM','MEGA','INCLUDED'],
    ['PERMIT_DRAWINGS','MEGA','INCLUDED'],['SHOP_DRAWINGS','MEGA','INCLUDED'],['SITE_SUPERVISION','MEGA','INCLUDED'],
    ['STRUCTURAL_AUDIT','MEGA','INCLUDED'],['GREEN_BUILDING','MEGA','INCLUDED'],['SECURITY_SIRA','MEGA','INCLUDED'],
    ['VERTICAL_TRANSPORT','MEGA','INCLUDED'],['AV_ELV','MEGA','INCLUDED'],['FACADE_LIGHTING','MEGA','INCLUDED'],
    ['FLS','MEGA','INCLUDED'],['TESTING_COMMISSIONING','MEGA','RED'],['AS_BUILT','MEGA','RED'],
  ];

  for (const [itemCode, catCode, status] of matrixData) {
    await conn.execute(
      'INSERT INTO cpa_scope_category_matrix (scope_item_id, building_category_id, status) VALUES (?,?,?)',
      [itemIds[itemCode], catIds[catCode], status]
    );
  }
  console.log(`Inserted ${matrixData.length} scope category matrix entries`);

  // ─── 6. SCOPE REFERENCE COSTS ───
  const refCosts = [
    // VILLA
    ['ARCH_DESIGN','VILLA',25000],['STRUCTURAL_DESIGN','VILLA',15000],['MEP_DESIGN','VILLA',12000],
    ['INTERIOR_DESIGN','VILLA',20000],['LANDSCAPE_DESIGN','VILLA',10000],['PERMIT_DRAWINGS','VILLA',5000],
    ['SHOP_DRAWINGS','VILLA',8000],['SITE_SUPERVISION','VILLA',15000],['STRUCTURAL_AUDIT','VILLA',8000],
    ['AV_ELV','VILLA',8000],['FLS','VILLA',6000],
    // SMALL
    ['ARCH_DESIGN','SMALL',80000],['STRUCTURAL_DESIGN','SMALL',50000],['MEP_DESIGN','SMALL',40000],
    ['INTERIOR_DESIGN','SMALL',60000],['LANDSCAPE_DESIGN','SMALL',25000],['BIM','SMALL',30000],
    ['PERMIT_DRAWINGS','SMALL',15000],['SHOP_DRAWINGS','SMALL',25000],['SITE_SUPERVISION','SMALL',40000],
    ['STRUCTURAL_AUDIT','SMALL',20000],['GREEN_BUILDING','SMALL',35000],['SECURITY_SIRA','SMALL',20000],
    ['VERTICAL_TRANSPORT','SMALL',15000],['AV_ELV','SMALL',20000],['FACADE_LIGHTING','SMALL',15000],['FLS','SMALL',18000],
    // MEDIUM
    ['ARCH_DESIGN','MEDIUM',200000],['STRUCTURAL_DESIGN','MEDIUM',120000],['MEP_DESIGN','MEDIUM',100000],
    ['INTERIOR_DESIGN','MEDIUM',150000],['LANDSCAPE_DESIGN','MEDIUM',60000],['BIM','MEDIUM',80000],
    ['PERMIT_DRAWINGS','MEDIUM',35000],['SHOP_DRAWINGS','MEDIUM',60000],['SITE_SUPERVISION','MEDIUM',100000],
    ['STRUCTURAL_AUDIT','MEDIUM',50000],['GREEN_BUILDING','MEDIUM',80000],['SECURITY_SIRA','MEDIUM',50000],
    ['VERTICAL_TRANSPORT','MEDIUM',40000],['AV_ELV','MEDIUM',45000],['FACADE_LIGHTING','MEDIUM',35000],['FLS','MEDIUM',45000],
    // LARGE
    ['ARCH_DESIGN','LARGE',500000],['STRUCTURAL_DESIGN','LARGE',300000],['MEP_DESIGN','LARGE',250000],
    ['INTERIOR_DESIGN','LARGE',400000],['LANDSCAPE_DESIGN','LARGE',150000],['BIM','LARGE',200000],
    ['PERMIT_DRAWINGS','LARGE',80000],['SHOP_DRAWINGS','LARGE',150000],['SITE_SUPERVISION','LARGE',250000],
    ['STRUCTURAL_AUDIT','LARGE',120000],['GREEN_BUILDING','LARGE',200000],['SECURITY_SIRA','LARGE',120000],
    ['VERTICAL_TRANSPORT','LARGE',100000],['AV_ELV','LARGE',100000],['FACADE_LIGHTING','LARGE',80000],['FLS','LARGE',100000],
    // MEGA
    ['ARCH_DESIGN','MEGA',1500000],['STRUCTURAL_DESIGN','MEGA',900000],['MEP_DESIGN','MEGA',750000],
    ['INTERIOR_DESIGN','MEGA',1200000],['LANDSCAPE_DESIGN','MEGA',450000],['BIM','MEGA',600000],
    ['PERMIT_DRAWINGS','MEGA',200000],['SHOP_DRAWINGS','MEGA',400000],['SITE_SUPERVISION','MEGA',750000],
    ['STRUCTURAL_AUDIT','MEGA',350000],['GREEN_BUILDING','MEGA',600000],['SECURITY_SIRA','MEGA',350000],
    ['VERTICAL_TRANSPORT','MEGA',300000],['AV_ELV','MEGA',300000],['FACADE_LIGHTING','MEGA',250000],['FLS','MEGA',300000],
  ];

  for (const [itemCode, catCode, cost] of refCosts) {
    await conn.execute(
      'INSERT INTO cpa_scope_reference_costs (scope_item_id, building_category_id, cost_aed) VALUES (?,?,?)',
      [itemIds[itemCode], catIds[catCode], cost]
    );
  }
  console.log(`Inserted ${refCosts.length} scope reference costs`);

  // ─── 7. SUPERVISION BASELINE ───
  const baselineData = [
    // VILLA
    ['RE','VILLA',50],['CIVIL_INSPECTOR','VILLA',50],['HO_STRUCTURAL','VILLA',20],['HO_ARCH','VILLA',20],
    // SMALL
    ['RE','SMALL',100],['CIVIL_INSPECTOR','SMALL',50],['MEP_INSPECTOR','SMALL',50],['DOC_CONTROLLER','SMALL',50],
    ['HO_STRUCTURAL','SMALL',30],['HO_ARCH','SMALL',30],['HO_MECHANICAL','SMALL',20],['HO_ELECTRICAL','SMALL',20],
    // MEDIUM
    ['RE','MEDIUM',100],['CIVIL_INSPECTOR','MEDIUM',70],['MEP_INSPECTOR','MEDIUM',60],['HSE_OFFICER','MEDIUM',50],
    ['DOC_CONTROLLER','MEDIUM',100],['QA_QC','MEDIUM',50],['HO_STRUCTURAL','MEDIUM',30],['HO_ARCH','MEDIUM',30],
    ['HO_MECHANICAL','MEDIUM',30],['HO_ELECTRICAL','MEDIUM',30],['ADMIN','MEDIUM',50],
    // LARGE
    ['RE','LARGE',100],['CIVIL_INSPECTOR','LARGE',100],['MEP_INSPECTOR','LARGE',100],['HSE_OFFICER','LARGE',100],
    ['DOC_CONTROLLER','LARGE',100],['QA_QC','LARGE',100],['HO_STRUCTURAL','LARGE',50],['HO_ARCH','LARGE',50],
    ['HO_MECHANICAL','LARGE',50],['HO_ELECTRICAL','LARGE',50],['ADMIN','LARGE',100],
    // MEGA
    ['RE','MEGA',100],['CIVIL_INSPECTOR','MEGA',100],['MEP_INSPECTOR','MEGA',100],['HSE_OFFICER','MEGA',100],
    ['DOC_CONTROLLER','MEGA',100],['QA_QC','MEGA',100],['HO_STRUCTURAL','MEGA',100],['HO_ARCH','MEGA',100],
    ['HO_MECHANICAL','MEGA',100],['HO_ELECTRICAL','MEGA',100],['ADMIN','MEGA',100],
  ];

  for (const [roleCode, catCode, pct] of baselineData) {
    await conn.execute(
      'INSERT INTO cpa_supervision_baseline (supervision_role_id, building_category_id, required_allocation_pct) VALUES (?,?,?)',
      [roleIds[roleCode], catIds[catCode], pct]
    );
  }
  console.log(`Inserted ${baselineData.length} supervision baseline entries`);

  // ─── 8. SYNC CONSULTANTS from platform ───
  const [platformConsultants] = await conn.execute(
    'SELECT c.id, c.name, c.email, c.phone, cp.companyNameAr, cp.specializations FROM consultants c LEFT JOIN consultantProfiles cp ON cp.consultantId = c.id ORDER BY c.id'
  );

  for (const pc of platformConsultants) {
    const words = pc.name.split(' ');
    let code = '';
    if (words.length === 1) {
      code = words[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 8);
    } else {
      code = words.filter(w => w.length > 2).map(w => w[0].toUpperCase()).join('').substring(0, 8);
      if (code.length < 3) code = words[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 8);
    }
    const tradeName = pc.companyNameAr || pc.name;
    await conn.execute(
      'INSERT INTO cpa_consultants_master (code, legal_name, trade_name, specialties, contact_email, contact_phone, is_active) VALUES (?,?,?,?,?,?,1)',
      [code, pc.name, tradeName, pc.specializations || null, pc.email || null, pc.phone || null]
    );
  }
  console.log(`Synced ${platformConsultants.length} consultants from platform`);

  console.log('\n=== Seed Complete ===');
  await conn.end();
}

run().catch(e => {
  console.error('Seed failed:', e.message);
  console.error(e.stack);
  process.exit(1);
});
