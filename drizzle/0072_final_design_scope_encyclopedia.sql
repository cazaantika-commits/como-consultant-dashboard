-- Final COMO design-scope encyclopedia approved by the owner.
-- The migration changes the active shared design reference only.
-- It does not update project_consultant_requirements, consultant coverage,
-- supervision roles, offer fees, or historical CPA results.

-- The TypeScript schema already supports SPECIALIST, but the live legacy table
-- still has the older four-value enum. Widening the enum is non-destructive.
ALTER TABLE cpa_scope_items
  MODIFY COLUMN default_type ENUM('CORE', 'GREEN', 'RED', 'CONTRACTOR', 'SPECIALIST')
  NOT NULL DEFAULT 'CORE';

INSERT INTO cpa_scope_sections (code, label, sort_order, is_active)
SELECT 'ENC_CORE', '01 — خدمات التصميم الأساسية', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM cpa_scope_sections WHERE code = 'ENC_CORE');

INSERT INTO cpa_scope_sections (code, label, sort_order, is_active)
SELECT 'ENC_DIGITAL', '02 — الأنظمة الرقمية والتيار الخفيف والأمن', 2, 1
WHERE NOT EXISTS (SELECT 1 FROM cpa_scope_sections WHERE code = 'ENC_DIGITAL');

INSERT INTO cpa_scope_sections (code, label, sort_order, is_active)
SELECT 'ENC_SPECIALIST', '03 — الاستدامة والهندسة المتخصصة', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM cpa_scope_sections WHERE code = 'ENC_SPECIALIST');

INSERT INTO cpa_scope_sections (code, label, sort_order, is_active)
SELECT 'ENC_INTERIOR_SITE', '04 — التصميم الداخلي والموقع والهوية والحركة', 4, 1
WHERE NOT EXISTS (SELECT 1 FROM cpa_scope_sections WHERE code = 'ENC_INTERIOR_SITE');

INSERT INTO cpa_scope_sections (code, label, sort_order, is_active)
SELECT 'ENC_RETAIL_DOCS', '05 — وثائق التجزئة والتجهيزات', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM cpa_scope_sections WHERE code = 'ENC_RETAIL_DOCS');

DROP TEMPORARY TABLE IF EXISTS tmp_final_design_encyclopedia;
CREATE TEMPORARY TABLE tmp_final_design_encyclopedia (
  item_number INT NOT NULL,
  code VARCHAR(50) NOT NULL,
  english_name VARCHAR(200) NOT NULL,
  arabic_explanation TEXT NOT NULL,
  section_code VARCHAR(50) NOT NULL,
  requirement_group VARCHAR(200) NOT NULL,
  default_type VARCHAR(20) NOT NULL,
  PRIMARY KEY (code)
);

INSERT INTO tmp_final_design_encyclopedia
  (item_number, code, english_name, arabic_explanation, section_code, requirement_group, default_type)
VALUES
  (1, 'LEAD_AOR', 'Lead Consultant / Architect of Record', 'قيادة فريق التصميم وتنسيق جميع التخصصات وتحمل المسؤولية الرسمية والتوقيع أمام الجهات.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),
  (2, 'ARCH_DESIGN', 'Architectural Design', 'تطوير المخططات والواجهات والقطاعات والتفاصيل والتنسيق المعماري للمشروع.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),
  (3, 'STRUCTURAL_DESIGN', 'Structural Engineering', 'إعداد النظام والتحليل والحسابات والمخططات والتفاصيل الإنشائية.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),
  (4, 'MEP_ENGINEERING', 'MEP Engineering', 'تصميم أعمال التكييف والتهوية والكهرباء والقوى والإنارة العامة والمياه والصرف والخدمات الصحية.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),
  (5, 'INFRASTRUCTURE', 'Infrastructure and Utilities within Plot Boundary', 'تصميم شبكات وخدمات الموقع الخارجية داخل حدود قطعة الأرض وربطها بالمبنى.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),
  (6, 'FLS', 'Fire and Life Safety', 'إعداد استراتيجية الحريق ومسارات الهروب ومتطلبات الدفاع المدني والتنسيق مع الأنظمة المرتبطة.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),
  (7, 'BIM_MANAGEMENT', 'BIM Management and Multidisciplinary Coordination', 'إدارة النماذج الرقمية ومعايير BIM والتنسيق بين التخصصات وكشف التعارضات.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),
  (8, 'AUTHORITY_SUBMISSIONS', 'Authority Submissions and NOCs', 'إعداد ومتابعة تقديمات التصميم والرد على الملاحظات والحصول على موافقات الجهات المطلوبة.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),
  (9, 'BUILDING_PERMIT', 'Building Permit', 'استكمال المتطلبات والإجراءات اللازمة لإصدار رخصة البناء بوصفها مخرجًا مستقلًا.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),
  (10, 'TENDER_SERVICES', 'Tender Documents, Tender Float and Evaluation', 'إعداد وثائق المناقصة وطرحها والرد على الاستفسارات وإصدار تقرير تقييم العروض.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),
  (11, 'IFC_CONTRACT_DOCS', 'Issued for Construction and Contract Documents', 'إصدار الرسومات والمواصفات ووثائق العقد النهائية الصالحة للتنفيذ.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),
  (12, 'QS_BOQ_SPECS', 'QS, BOQ and Specifications', 'إعداد القياسات وجداول الكميات والمواصفات الفنية وربطها بوثائق المناقصة والعقد.', 'ENC_CORE', '01 — خدمات التصميم الأساسية', 'CORE'),

  (13, 'ELV_COORDINATION', 'ELV Systems Integration and Coordination', 'تنسيق أنظمة الجهد المنخفض جدًا ومساراتها وغرفها ونقاط الربط والتكامل بينها.', 'ENC_DIGITAL', '02 — الأنظمة الرقمية والتيار الخفيف والأمن', 'SPECIALIST'),
  (14, 'TELECOM', 'Telecom Systems', 'تصميم الهاتف وربط مزودي الاتصالات وغرف ومسارات وكوابل الاتصال.', 'ENC_DIGITAL', '02 — الأنظمة الرقمية والتيار الخفيف والأمن', 'SPECIALIST'),
  (15, 'ICT_DATA_WIFI', 'ICT, Data Network and Wi-Fi', 'تصميم الكابلات الهيكلية وشبكات البيانات ونقاط الشبكة والتغطية اللاسلكية.', 'ENC_DIGITAL', '02 — الأنظمة الرقمية والتيار الخفيف والأمن', 'SPECIALIST'),
  (16, 'IT_ACTIVE_SYSTEMS', 'IT Infrastructure and Active Systems', 'تحديد الخوادم والمبدلات والتجهيزات والأنظمة النشطة عندما تدخل ضمن نطاق التصميم.', 'ENC_DIGITAL', '02 — الأنظمة الرقمية والتيار الخفيف والأمن', 'SPECIALIST'),
  (17, 'AV_DESIGN', 'Audio Visual Design', 'تصميم أنظمة الصوت والعرض والشاشات والاجتماعات والنداء بحسب احتياج المشروع.', 'ENC_DIGITAL', '02 — الأنظمة الرقمية والتيار الخفيف والأمن', 'SPECIALIST'),
  (18, 'CCTV_SIRA', 'CCTV, Security Design and SIRA Approval', 'تصميم أنظمة المراقبة والأمن وإعداد مخططات ومتطلبات اعتماد SIRA.', 'ENC_DIGITAL', '02 — الأنظمة الرقمية والتيار الخفيف والأمن', 'SPECIALIST'),
  (19, 'ACCESS_INTERCOM', 'Access Control and Intercom', 'تصميم الأبواب والبوابات وقارئات الدخول والإنتركم والتكامل مع الأنظمة الأمنية.', 'ENC_DIGITAL', '02 — الأنظمة الرقمية والتيار الخفيف والأمن', 'SPECIALIST'),

  (20, 'GREEN_BUILDING', 'Mandatory Green Building Compliance', 'تحقيق متطلبات البلدية الإلزامية لكفاءة الطاقة والمياه والمواد والتقارير المرتبطة.', 'ENC_SPECIALIST', '03 — الاستدامة والهندسة المتخصصة', 'GREEN'),
  (21, 'CFD_MODELLING', 'CFD Modelling for Atriums and Car Parking', 'تحليل حركة الهواء والدخان والتهوية في الأتريوم والمواقف عند حاجة المشروع.', 'ENC_SPECIALIST', '03 — الاستدامة والهندسة المتخصصة', 'SPECIALIST'),
  (22, 'ACOUSTIC_VIBRATION', 'Acoustic and Vibration Design', 'تحديد معايير العزل والصدى والضوضاء والاهتزاز وتصميم الحلول الفنية المرتبطة.', 'ENC_SPECIALIST', '03 — الاستدامة والهندسة المتخصصة', 'SPECIALIST'),
  (23, 'VERTICAL_TRANSPORT', 'Vertical Transportation', 'تصميم المصاعد والسلالم والمشايات المتحركة وتحليل الحركة والسعة والانتظار.', 'ENC_SPECIALIST', '03 — الاستدامة والهندسة المتخصصة', 'SPECIALIST'),
  (24, 'WASTE_MANAGEMENT', 'Waste Management — Solid and Liquid', 'تصميم كميات ومسارات وغرف ومعدات جمع ونقل وإدارة النفايات الصلبة والسائلة.', 'ENC_SPECIALIST', '03 — الاستدامة والهندسة المتخصصة', 'SPECIALIST'),
  (25, 'FACADE_ENGINEERING', 'Façade Engineering', 'تصميم أداء وأنظمة ومواد وتفاصيل الواجهات والعزل ومنع تسرب الماء والهواء والتثبيت.', 'ENC_SPECIALIST', '03 — الاستدامة والهندسة المتخصصة', 'SPECIALIST'),
  (26, 'FACADE_LIGHTING', 'Façade Lighting', 'وضع مفهوم وتصميم وتوزيع وتحكم إضاءة الواجهات والتنسيق الكهربائي والمعماري.', 'ENC_SPECIALIST', '03 — الاستدامة والهندسة المتخصصة', 'SPECIALIST'),
  (27, 'INTERIOR_LIGHTING', 'Specialist Interior Lighting', 'تصميم إضاءة المناطق الداخلية العامة والتجزئة والضيافة ومشاهد التحكم المرتبطة.', 'ENC_SPECIALIST', '03 — الاستدامة والهندسة المتخصصة', 'SPECIALIST'),
  (28, 'FACADE_ACCESS_BMU', 'Façade Access / BMU Maintenance System', 'تصميم نظام الوصول والتنظيف والصيانة ومعدات BMU ومساراتها ونقاط تثبيتها.', 'ENC_SPECIALIST', '03 — الاستدامة والهندسة المتخصصة', 'SPECIALIST'),
  (29, 'WIND_TUNNEL', 'Wind Tunnel Study', 'اختبار وتحليل تأثير الرياح على المبنى والواجهات وراحة المشاة عندما يحتاج المشروع.', 'ENC_SPECIALIST', '03 — الاستدامة والهندسة المتخصصة', 'SPECIALIST'),

  (30, 'ID_PUBLIC_AREAS', 'Interior Design — Common and Public Areas', 'تصميم المخططات والمواد والأسقف والتفاصيل للمناطق العامة والمشتركة وتنسيقها.', 'ENC_INTERIOR_SITE', '04 — التصميم الداخلي والموقع والهوية والحركة', 'SPECIALIST'),
  (31, 'ID_UNIT_PROTOTYPES', 'Interior Design — Unit Prototypes', 'تصميم نماذج الشقق أو الفلل أو الوحدات وإعداد تفاصيلها ومواصفاتها النموذجية.', 'ENC_INTERIOR_SITE', '04 — التصميم الداخلي والموقع والهوية والحركة', 'SPECIALIST'),
  (32, 'LANDSCAPE_DESIGN', 'Landscape Design', 'تصميم توزيع المساحات الخارجية والزراعة والمواد والأثاث الخارجي والتفاصيل.', 'ENC_INTERIOR_SITE', '04 — التصميم الداخلي والموقع والهوية والحركة', 'SPECIALIST'),
  (33, 'IRRIGATION_DESIGN', 'Irrigation Design', 'تصميم شبكة الري والحسابات والتحكم والمضخات والاستهلاك والتنسيق مع اللاندسكيب.', 'ENC_INTERIOR_SITE', '04 — التصميم الداخلي والموقع والهوية والحركة', 'SPECIALIST'),
  (34, 'WATER_FEATURES', 'Water Features Design', 'تصميم النوافير والمسابح والعناصر المائية والأنظمة والتجهيزات المرتبطة بها.', 'ENC_INTERIOR_SITE', '04 — التصميم الداخلي والموقع والهوية والحركة', 'SPECIALIST'),
  (35, 'BRANDING', 'Branding', 'تطوير هوية المشروع وتطبيقاتها البصرية ووضع قواعد استخدامها في المشروع.', 'ENC_INTERIOR_SITE', '04 — التصميم الداخلي والموقع والهوية والحركة', 'SPECIALIST'),
  (36, 'WAYFINDING_SIGNAGE', 'Wayfinding and Signage', 'إعداد استراتيجية التوجيه وأنواع ومواقع وتصميم اللوحات الداخلية والخارجية.', 'ENC_INTERIOR_SITE', '04 — التصميم الداخلي والموقع والهوية والحركة', 'SPECIALIST'),
  (37, 'PARKING_STRATEGY', 'Parking Strategy', 'تحديد عدد وتوزيع ومقاسات المواقف والحركة والمداخل والمخارج ومتطلبات التشغيل.', 'ENC_INTERIOR_SITE', '04 — التصميم الداخلي والموقع والهوية والحركة', 'SPECIALIST'),
  (38, 'TIS', 'Traffic Impact Study / Assessment', 'دراسة تأثير المشروع على شبكة الطرق والحركة واقتراح الحلول وإعداد الاعتمادات المطلوبة.', 'ENC_INTERIOR_SITE', '04 — التصميم الداخلي والموقع والهوية والحركة', 'SPECIALIST'),
  (39, 'RETAIL_PLANNING', 'Retail Planning / Specialist Retail Consultant', 'تخطيط استخدامات ووحدات التجزئة والحركة والواجهات ومتطلباتها التشغيلية.', 'ENC_INTERIOR_SITE', '04 — التصميم الداخلي والموقع والهوية والحركة', 'SPECIALIST'),

  (40, 'TENANT_HANDBOOK_DESIGN', 'Tenant''s Handbook — Shopfront and Signage Design Guidelines', 'إعداد ضوابط تصميم واجهات المحلات واللافتات التي تُرفق بعقود الإيجار.', 'ENC_RETAIL_DOCS', '05 — وثائق التجزئة والتجهيزات', 'SPECIALIST'),
  (41, 'TENANT_HANDBOOK_TECH', 'Tenant''s Handbook — Structural and MEP Technical Guidelines', 'إعداد الأحمال والفتحات والخدمات والربط والقيود الفنية لأعمال المستأجرين.', 'ENC_RETAIL_DOCS', '05 — وثائق التجزئة والتجهيزات', 'SPECIALIST'),
  (42, 'LOOSE_FURNITURE_FFE', 'Interior and Exterior Loose Furniture / FF&E', 'اختيار وتوزيع وتوصيف الأثاث والتجهيزات الداخلية والخارجية غير الثابتة.', 'ENC_RETAIL_DOCS', '05 — وثائق التجزئة والتجهيزات', 'SPECIALIST');

-- Reuse compatible legacy scope rows so existing coverage evidence remains connected.
UPDATE cpa_scope_items si
JOIN tmp_final_design_encyclopedia e ON e.code = si.code
JOIN cpa_scope_sections ss ON ss.code = e.section_code
SET si.item_number = e.item_number,
    si.label = e.english_name,
    si.section_id = ss.id,
    si.default_type = e.default_type,
    si.description = e.arabic_explanation,
    si.sort_order = e.item_number,
    si.is_active = 1;

-- Create only services that do not already exist in the legacy CPA scope library.
INSERT INTO cpa_scope_items
  (item_number, code, label, section_id, default_type, description, sort_order, is_active)
SELECT e.item_number, e.code, e.english_name, ss.id, e.default_type,
       e.arabic_explanation, e.item_number, 1
FROM tmp_final_design_encyclopedia e
JOIN cpa_scope_sections ss ON ss.code = e.section_code
WHERE NOT EXISTS (SELECT 1 FROM cpa_scope_items si WHERE si.code = e.code);

-- Update compatible reference rows to the approved presentation and link.
UPDATE consultant_requirement_reference_items r
JOIN tmp_final_design_encyclopedia e ON e.code = r.code
JOIN cpa_scope_items si ON si.code = e.code
SET r.source_type = 'LEGACY_SCOPE',
    r.legacy_scope_item_id = si.id,
    r.legacy_supervision_role_id = NULL,
    r.workstream = 'DESIGN',
    r.requirement_group = e.requirement_group,
    r.label = e.english_name,
    r.description = e.arabic_explanation,
    r.default_enabled = 1,
    r.default_gap_value_aed = NULL,
    r.pricing_basis = 'MANUAL',
    r.default_duration_months = NULL,
    r.default_allocation_pct = NULL,
    r.sort_order = e.item_number,
    r.is_active = 1
WHERE r.source_type <> 'LEGACY_SUPERVISION';

-- Insert missing approved services into the shared reference.
INSERT INTO consultant_requirement_reference_items
  (source_type, legacy_scope_item_id, legacy_supervision_role_id, workstream,
   requirement_group, code, label, description, default_enabled,
   default_gap_value_aed, pricing_basis, default_duration_months,
   default_allocation_pct, sort_order, is_active)
SELECT 'LEGACY_SCOPE', si.id, NULL, 'DESIGN', e.requirement_group,
       e.code, e.english_name, e.arabic_explanation, 1,
       NULL, 'MANUAL', NULL, NULL, e.item_number, 1
FROM tmp_final_design_encyclopedia e
JOIN cpa_scope_items si ON si.code = e.code
WHERE NOT EXISTS (
  SELECT 1 FROM consultant_requirement_reference_items r WHERE r.code = e.code
);

-- Hide former shared design/contract entries from Settings and future projects.
-- Existing project revisions keep their copied rows and reference IDs unchanged.
UPDATE consultant_requirement_reference_items r
SET r.is_active = 0
WHERE r.source_type IN ('LEGACY_SCOPE', 'CUSTOM')
  AND r.workstream <> 'SUPERVISION'
  AND NOT EXISTS (
    SELECT 1 FROM tmp_final_design_encyclopedia e WHERE e.code = r.code
  );

DROP TEMPORARY TABLE IF EXISTS tmp_final_design_encyclopedia;
