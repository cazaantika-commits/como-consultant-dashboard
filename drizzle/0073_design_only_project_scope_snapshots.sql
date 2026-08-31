-- Clean design-scope input stage.
-- Creates a new DRAFT revision for every current project from the approved
-- 42-item design encyclopedia only. Historical revisions remain intact.
-- Supervision roles, consultant offers, financial inputs, calculation results,
-- and downstream reports are not updated by this migration.

DROP TEMPORARY TABLE IF EXISTS tmp_legacy_to_final_design_scope;
CREATE TEMPORARY TABLE tmp_legacy_to_final_design_scope (
  legacy_code VARCHAR(80) NOT NULL,
  final_code VARCHAR(80) NOT NULL,
  PRIMARY KEY (legacy_code, final_code)
);

INSERT INTO tmp_legacy_to_final_design_scope (legacy_code, final_code) VALUES
  ('ARCH_DESIGN', 'ARCH_DESIGN'),
  ('STRUCTURAL_DESIGN', 'STRUCTURAL_DESIGN'),
  ('MEP_ENGINEERING', 'MEP_ENGINEERING'),
  ('INFRASTRUCTURE', 'INFRASTRUCTURE'),
  ('FLS', 'FLS'),
  ('FLS_SPECIALIST', 'FLS'),
  ('BIM_MANAGEMENT', 'BIM_MANAGEMENT'),
  ('AUTHORITY_SUBMISSIONS', 'AUTHORITY_SUBMISSIONS'),
  ('BUILDING_PERMIT', 'BUILDING_PERMIT'),
  ('TENDER_DOCS', 'TENDER_SERVICES'),
  ('IFC_PACKAGE', 'IFC_CONTRACT_DOCS'),
  ('QS_BOQ', 'QS_BOQ_SPECS'),
  ('TELECOM_ICT_ELV', 'ELV_COORDINATION'),
  ('TELECOM_ICT_ELV', 'TELECOM'),
  ('TELECOM_ICT_ELV', 'ICT_DATA_WIFI'),
  ('TELECOM_ICT_ELV', 'IT_ACTIVE_SYSTEMS'),
  ('TELECOM_ICT_ELV', 'AV_DESIGN'),
  ('TELECOM_ICT_ELV', 'ACCESS_INTERCOM'),
  ('SECURITY_SIRA', 'CCTV_SIRA'),
  ('GREEN_BUILDING', 'GREEN_BUILDING'),
  ('CFD_MODELLING', 'CFD_MODELLING'),
  ('ACOUSTIC', 'ACOUSTIC_VIBRATION'),
  ('VERTICAL_TRANSPORT', 'VERTICAL_TRANSPORT'),
  ('WASTE_MANAGEMENT', 'WASTE_MANAGEMENT'),
  ('FACADE_ENGINEERING', 'FACADE_ENGINEERING'),
  ('FACADE_LIGHTING', 'FACADE_LIGHTING'),
  ('BMU', 'FACADE_ACCESS_BMU'),
  ('WIND_TUNNEL', 'WIND_TUNNEL'),
  ('ID_COMMON_AREAS', 'ID_PUBLIC_AREAS'),
  ('ID_UNIT_PROTOTYPES', 'ID_UNIT_PROTOTYPES'),
  ('LANDSCAPE_WATER', 'LANDSCAPE_DESIGN'),
  ('LANDSCAPE_WATER', 'IRRIGATION_DESIGN'),
  ('LANDSCAPE_WATER', 'WATER_FEATURES'),
  ('SIGNAGE_WAYFINDING', 'WAYFINDING_SIGNAGE'),
  ('PARKING_STRATEGY', 'PARKING_STRATEGY'),
  ('TIS', 'TIS');

DROP TEMPORARY TABLE IF EXISTS tmp_current_project_scope_sets;
CREATE TEMPORARY TABLE tmp_current_project_scope_sets (
  project_id INT NOT NULL,
  previous_set_id INT NOT NULL,
  new_revision_no INT NOT NULL,
  PRIMARY KEY (project_id)
);
INSERT INTO tmp_current_project_scope_sets
  (project_id, previous_set_id, new_revision_no)
SELECT current_set.project_id,
       current_set.id AS previous_set_id,
       current_set.revision_no + 1 AS new_revision_no
FROM project_consultant_requirement_sets current_set
WHERE current_set.status IN ('DRAFT', 'APPROVED')
  AND NOT EXISTS (
    SELECT 1
    FROM project_consultant_requirement_sets newer
    WHERE newer.project_id = current_set.project_id
      AND newer.status IN ('DRAFT', 'APPROVED')
      AND (newer.revision_no > current_set.revision_no
        OR (newer.revision_no = current_set.revision_no AND newer.id > current_set.id))
  )
  AND COALESCE(current_set.notes, '') NOT LIKE 'DESIGN_SCOPE_ENCYCLOPEDIA_V1%';

UPDATE project_consultant_requirement_sets current_set
JOIN tmp_current_project_scope_sets pending
  ON pending.previous_set_id = current_set.id
SET current_set.status = 'REPLACED';

INSERT INTO project_consultant_requirement_sets
  (project_id, title, revision_no, status, notes)
SELECT pending.project_id,
       CONCAT('نطاق التصميم الخاص بالمشروع — مراجعة ', pending.new_revision_no),
       pending.new_revision_no,
       'DRAFT',
       CONCAT(
         'DESIGN_SCOPE_ENCYCLOPEDIA_V1 | 42 بند تصميم فقط | المصدر السابق: ',
         pending.previous_set_id,
         ' | الاختيارات منقولة بالمطابقة الموثقة وتبقى بانتظار اعتماد المالك'
       )
FROM tmp_current_project_scope_sets pending;

DROP TEMPORARY TABLE IF EXISTS tmp_new_project_scope_sets;
CREATE TEMPORARY TABLE tmp_new_project_scope_sets (
  project_id INT NOT NULL,
  previous_set_id INT NOT NULL,
  new_set_id INT NOT NULL,
  PRIMARY KEY (project_id)
);
INSERT INTO tmp_new_project_scope_sets
  (project_id, previous_set_id, new_set_id)
SELECT pending.project_id,
       pending.previous_set_id,
       new_set.id AS new_set_id
FROM tmp_current_project_scope_sets pending
JOIN project_consultant_requirement_sets new_set
  ON new_set.project_id = pending.project_id
 AND new_set.revision_no = pending.new_revision_no
 AND new_set.status = 'DRAFT'
 AND new_set.notes LIKE 'DESIGN_SCOPE_ENCYCLOPEDIA_V1%';

INSERT INTO project_consultant_requirements
  (requirement_set_id, reference_item_id, source_type, workstream,
   requirement_group, code, label, description, is_required,
   gap_value_aed, pricing_basis, duration_months, allocation_pct, sort_order)
SELECT new_set.new_set_id,
       reference_item.id,
       'REFERENCE',
       'DESIGN',
       reference_item.requirement_group,
       reference_item.code,
       reference_item.label,
       reference_item.description,
       CASE WHEN EXISTS (
         SELECT 1
         FROM project_consultant_requirements old_requirement
         JOIN tmp_legacy_to_final_design_scope transition
           ON transition.legacy_code = old_requirement.code
          AND transition.final_code = reference_item.code
         WHERE old_requirement.requirement_set_id = new_set.previous_set_id
           AND old_requirement.is_required = 1
       ) THEN 1 ELSE 0 END,
       reference_item.default_gap_value_aed,
       reference_item.pricing_basis,
       NULL,
       NULL,
       reference_item.sort_order
FROM tmp_new_project_scope_sets new_set
JOIN consultant_requirement_reference_items reference_item
  ON reference_item.is_active = 1
 AND reference_item.workstream = 'DESIGN'
 AND reference_item.source_type = 'LEGACY_SCOPE'
WHERE NOT EXISTS (
  SELECT 1
  FROM project_consultant_requirements existing
  WHERE existing.requirement_set_id = new_set.new_set_id
);

DROP TEMPORARY TABLE IF EXISTS tmp_new_project_scope_sets;
DROP TEMPORARY TABLE IF EXISTS tmp_current_project_scope_sets;
DROP TEMPORARY TABLE IF EXISTS tmp_legacy_to_final_design_scope;
