CREATE TABLE IF NOT EXISTS consultant_requirement_reference_items (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_type ENUM('LEGACY_SCOPE', 'LEGACY_SUPERVISION', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM',
  legacy_scope_item_id INT NULL,
  legacy_supervision_role_id INT NULL,
  workstream ENUM('DESIGN', 'ENGINEERING', 'SUPERVISION', 'GENERAL') NOT NULL DEFAULT 'GENERAL',
  requirement_group VARCHAR(200) NOT NULL DEFAULT 'متطلبات عامة',
  code VARCHAR(80) NULL,
  label VARCHAR(300) NOT NULL,
  description TEXT NULL,
  default_enabled TINYINT NOT NULL DEFAULT 1,
  default_gap_value_aed DECIMAL(15,2) NULL,
  pricing_basis ENUM('FIXED', 'MONTHLY', 'PERCENT_OF_FEE', 'MANUAL') NOT NULL DEFAULT 'FIXED',
  default_duration_months INT NULL,
  default_allocation_pct DECIMAL(5,2) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX crr_source_scope (legacy_scope_item_id),
  INDEX crr_source_supervision (legacy_supervision_role_id),
  INDEX crr_workstream (workstream),
  INDEX crr_active_sort (is_active, sort_order)
);

INSERT INTO consultant_requirement_reference_items
  (source_type, legacy_scope_item_id, workstream, requirement_group, code, label, description, default_enabled, default_gap_value_aed, pricing_basis, sort_order, is_active)
SELECT
  'LEGACY_SCOPE',
  si.id,
  'GENERAL',
  COALESCE(ss.label, 'متطلبات عامة'),
  si.code,
  si.label,
  si.description,
  1,
  NULL,
  'FIXED',
  si.sort_order,
  1
FROM cpa_scope_items si
LEFT JOIN cpa_scope_sections ss ON ss.id = si.section_id
WHERE si.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM consultant_requirement_reference_items r
    WHERE r.source_type = 'LEGACY_SCOPE' AND r.legacy_scope_item_id = si.id
  );

INSERT INTO consultant_requirement_reference_items
  (source_type, legacy_supervision_role_id, workstream, requirement_group, code, label, description, default_enabled, default_gap_value_aed, pricing_basis, default_allocation_pct, sort_order, is_active)
SELECT
  'LEGACY_SUPERVISION',
  sr.id,
  'SUPERVISION',
  CASE WHEN sr.team_type = 'HEAD_OFFICE' THEN 'أدوار الإشراف — المكتب الرئيسي' ELSE 'أدوار الإشراف — الموقع' END,
  sr.code,
  sr.label,
  sr.grade,
  0,
  sr.monthly_rate_aed,
  'MONTHLY',
  NULL,
  1000 + sr.sort_order,
  1
FROM cpa_supervision_roles sr
WHERE sr.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM consultant_requirement_reference_items r
    WHERE r.source_type = 'LEGACY_SUPERVISION' AND r.legacy_supervision_role_id = sr.id
  );
