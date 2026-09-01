-- Owner-approved split of the former combined CCTV/SIRA service.
-- The old combined reference and CPA scope row remain as inactive history.
-- Current DESIGN_SCOPE_ENCYCLOPEDIA_V1 drafts inherit the old selection for
-- both new services; no other project selection or downstream result changes.

SET @cctv_scope_exists = (SELECT COUNT(*) FROM cpa_scope_items WHERE code = 'CCTV_SECURITY_DESIGN');
SET @sira_scope_exists = (SELECT COUNT(*) FROM cpa_scope_items WHERE code = 'SIRA_SUBMISSION');

UPDATE cpa_scope_items item
JOIN cpa_scope_sections section ON section.id = item.section_id
SET item.item_number = item.item_number + 1,
    item.sort_order = item.sort_order + 1
WHERE item.is_active = 1
  AND section.code IN ('ENC_DIGITAL', 'ENC_SPECIALIST', 'ENC_INTERIOR_SITE', 'ENC_RETAIL_DOCS')
  AND item.item_number >= 19
  AND @cctv_scope_exists = 0
  AND @sira_scope_exists = 0;

UPDATE cpa_scope_items
SET is_active = 0
WHERE code = 'CCTV_SIRA';

INSERT INTO cpa_scope_items
  (item_number, code, label, section_id, default_type, description, sort_order, is_active)
SELECT 18,
       'CCTV_SECURITY_DESIGN',
       'CCTV and Security Design',
       section.id,
       'SPECIALIST',
       'تصميم أنظمة المراقبة والأمن والتغطية وغرف المراقبة والتخزين والمخططات الفنية المرتبطة.',
       18,
       1
FROM cpa_scope_sections section
WHERE section.code = 'ENC_DIGITAL'
  AND NOT EXISTS (
    SELECT 1 FROM cpa_scope_items existing WHERE existing.code = 'CCTV_SECURITY_DESIGN'
  );

INSERT INTO cpa_scope_items
  (item_number, code, label, section_id, default_type, description, sort_order, is_active)
SELECT 19,
       'SIRA_SUBMISSION',
       'SIRA Submission and Approval',
       section.id,
       'SPECIALIST',
       'إعداد متطلبات ومخططات SIRA وتقديمها ومتابعة الملاحظات حتى الاعتماد؛ ولا يشمل البند رسوم الجهة الحكومية التي يتحملها المالك.',
       19,
       1
FROM cpa_scope_sections section
WHERE section.code = 'ENC_DIGITAL'
  AND NOT EXISTS (
    SELECT 1 FROM cpa_scope_items existing WHERE existing.code = 'SIRA_SUBMISSION'
  );

SET @cctv_reference_exists = (
  SELECT COUNT(*) FROM consultant_requirement_reference_items WHERE code = 'CCTV_SECURITY_DESIGN'
);
SET @sira_reference_exists = (
  SELECT COUNT(*) FROM consultant_requirement_reference_items WHERE code = 'SIRA_SUBMISSION'
);

UPDATE consultant_requirement_reference_items reference_item
SET reference_item.sort_order = reference_item.sort_order + 1
WHERE reference_item.is_active = 1
  AND reference_item.workstream = 'DESIGN'
  AND reference_item.sort_order >= 19
  AND @cctv_reference_exists = 0
  AND @sira_reference_exists = 0;

UPDATE consultant_requirement_reference_items
SET is_active = 0
WHERE code = 'CCTV_SIRA';

INSERT INTO consultant_requirement_reference_items
  (source_type, legacy_scope_item_id, legacy_supervision_role_id, workstream,
   requirement_group, code, label, description, default_enabled,
   default_gap_value_aed, pricing_basis, default_duration_months,
   default_allocation_pct, sort_order, is_active)
SELECT 'LEGACY_SCOPE', scope_item.id, NULL, 'DESIGN',
       '02 — الأنظمة الرقمية والتيار الخفيف والأمن',
       'CCTV_SECURITY_DESIGN',
       'CCTV and Security Design',
       'تصميم أنظمة المراقبة والأمن والتغطية وغرف المراقبة والتخزين والمخططات الفنية المرتبطة.',
       1, NULL, 'MANUAL', NULL, NULL, 18, 1
FROM cpa_scope_items scope_item
WHERE scope_item.code = 'CCTV_SECURITY_DESIGN'
  AND NOT EXISTS (
    SELECT 1
    FROM consultant_requirement_reference_items existing
    WHERE existing.code = 'CCTV_SECURITY_DESIGN'
  );

INSERT INTO consultant_requirement_reference_items
  (source_type, legacy_scope_item_id, legacy_supervision_role_id, workstream,
   requirement_group, code, label, description, default_enabled,
   default_gap_value_aed, pricing_basis, default_duration_months,
   default_allocation_pct, sort_order, is_active)
SELECT 'LEGACY_SCOPE', scope_item.id, NULL, 'DESIGN',
       '02 — الأنظمة الرقمية والتيار الخفيف والأمن',
       'SIRA_SUBMISSION',
       'SIRA Submission and Approval',
       'إعداد متطلبات ومخططات SIRA وتقديمها ومتابعة الملاحظات حتى الاعتماد؛ ولا يشمل البند رسوم الجهة الحكومية التي يتحملها المالك.',
       1, NULL, 'MANUAL', NULL, NULL, 19, 1
FROM cpa_scope_items scope_item
WHERE scope_item.code = 'SIRA_SUBMISSION'
  AND NOT EXISTS (
    SELECT 1
    FROM consultant_requirement_reference_items existing
    WHERE existing.code = 'SIRA_SUBMISSION'
  );

SET @split_project_rows_exist = (
  SELECT COUNT(*)
  FROM project_consultant_requirements
  WHERE code IN ('CCTV_SECURITY_DESIGN', 'SIRA_SUBMISSION')
);

UPDATE project_consultant_requirements requirement
JOIN project_consultant_requirement_sets requirement_set
  ON requirement_set.id = requirement.requirement_set_id
SET requirement.sort_order = requirement.sort_order + 1
WHERE requirement_set.notes LIKE 'DESIGN_SCOPE_ENCYCLOPEDIA_V1%'
  AND requirement.sort_order >= 19
  AND @split_project_rows_exist = 0;

UPDATE project_consultant_requirements requirement
JOIN project_consultant_requirement_sets requirement_set
  ON requirement_set.id = requirement.requirement_set_id
JOIN consultant_requirement_reference_items reference_item
  ON reference_item.code = 'CCTV_SECURITY_DESIGN'
 AND reference_item.is_active = 1
SET requirement.reference_item_id = reference_item.id,
    requirement.code = 'CCTV_SECURITY_DESIGN',
    requirement.label = 'CCTV and Security Design',
    requirement.description = 'تصميم أنظمة المراقبة والأمن والتغطية وغرف المراقبة والتخزين والمخططات الفنية المرتبطة.',
    requirement.sort_order = 18
WHERE requirement_set.notes LIKE 'DESIGN_SCOPE_ENCYCLOPEDIA_V1%'
  AND requirement.code = 'CCTV_SIRA';

INSERT INTO project_consultant_requirements
  (requirement_set_id, reference_item_id, source_type, workstream,
   requirement_group, code, label, description, is_required,
   gap_value_aed, pricing_basis, duration_months, allocation_pct, sort_order)
SELECT cctv.requirement_set_id,
       reference_item.id,
       'REFERENCE',
       'DESIGN',
       cctv.requirement_group,
       'SIRA_SUBMISSION',
       'SIRA Submission and Approval',
       'إعداد متطلبات ومخططات SIRA وتقديمها ومتابعة الملاحظات حتى الاعتماد؛ ولا يشمل البند رسوم الجهة الحكومية التي يتحملها المالك.',
       cctv.is_required,
       NULL,
       'MANUAL',
       NULL,
       NULL,
       19
FROM project_consultant_requirements cctv
JOIN project_consultant_requirement_sets requirement_set
  ON requirement_set.id = cctv.requirement_set_id
JOIN consultant_requirement_reference_items reference_item
  ON reference_item.code = 'SIRA_SUBMISSION'
 AND reference_item.is_active = 1
WHERE requirement_set.notes LIKE 'DESIGN_SCOPE_ENCYCLOPEDIA_V1%'
  AND cctv.code = 'CCTV_SECURITY_DESIGN'
  AND NOT EXISTS (
    SELECT 1
    FROM project_consultant_requirements existing
    WHERE existing.requirement_set_id = cctv.requirement_set_id
      AND existing.code = 'SIRA_SUBMISSION'
  );

UPDATE project_consultant_requirement_sets
SET notes = REPLACE(notes, '42 بند تصميم فقط', '43 بند تصميم فقط')
WHERE notes LIKE 'DESIGN_SCOPE_ENCYCLOPEDIA_V1%';
