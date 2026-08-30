-- One-time, idempotent snapshot of each existing consultant project's effective
-- legacy scope. The comprehensive reference library and legacy matrices remain
-- unchanged; subsequent project edits use only the copied requirement rows.

INSERT INTO project_consultant_requirement_sets
  (project_id, title, revision_no, status, notes)
SELECT
  cp.project_id,
  'نطاق الاستشاريين الخاص بالمشروع',
  COALESCE((
    SELECT MAX(existing.revision_no)
    FROM project_consultant_requirement_sets existing
    WHERE existing.project_id = cp.project_id
  ), 0) + 1,
  'DRAFT',
  'تهيئة مستقلة من النطاق الفعلي السابق للمشروع؛ التصنيف القديم لا يقود هذا النطاق بعد النسخ'
FROM cpa_projects cp
WHERE NOT EXISTS (
  SELECT 1
  FROM project_consultant_requirement_sets current_set
  WHERE current_set.project_id = cp.project_id
    AND current_set.status IN ('DRAFT', 'APPROVED')
);

INSERT INTO project_consultant_requirements
  (requirement_set_id, reference_item_id, source_type, workstream, requirement_group,
   code, label, description, is_required, gap_value_aed, pricing_basis,
   duration_months, allocation_pct, sort_order)
SELECT
  requirement_set.id,
  reference_item.id,
  'REFERENCE',
  reference_item.workstream,
  reference_item.requirement_group,
  reference_item.code,
  reference_item.label,
  reference_item.description,
  CASE
    WHEN reference_item.source_type = 'LEGACY_SCOPE' AND EXISTS (
      SELECT 1
      FROM cpa_scope_category_matrix scope_matrix
      WHERE scope_matrix.building_category_id = cpa_project.building_category_id
        AND scope_matrix.scope_item_id = reference_item.legacy_scope_item_id
        AND scope_matrix.status <> 'NOT_REQUIRED'
    ) THEN 1
    WHEN reference_item.source_type = 'LEGACY_SUPERVISION' AND EXISTS (
      SELECT 1
      FROM cpa_supervision_baseline supervision_baseline
      WHERE supervision_baseline.building_category_id = cpa_project.building_category_id
        AND supervision_baseline.supervision_role_id = reference_item.legacy_supervision_role_id
        AND supervision_baseline.required_allocation_pct > 0
    ) THEN 1
    ELSE 0
  END,
  CASE
    WHEN reference_item.source_type = 'LEGACY_SCOPE' THEN (
      SELECT MAX(reference_cost.cost_aed)
      FROM cpa_scope_reference_costs reference_cost
      WHERE reference_cost.building_category_id = cpa_project.building_category_id
        AND reference_cost.scope_item_id = reference_item.legacy_scope_item_id
    )
    ELSE reference_item.default_gap_value_aed
  END,
  reference_item.pricing_basis,
  reference_item.default_duration_months,
  CASE
    WHEN reference_item.source_type = 'LEGACY_SUPERVISION' THEN (
      SELECT MAX(supervision_baseline.required_allocation_pct)
      FROM cpa_supervision_baseline supervision_baseline
      WHERE supervision_baseline.building_category_id = cpa_project.building_category_id
        AND supervision_baseline.supervision_role_id = reference_item.legacy_supervision_role_id
    )
    ELSE reference_item.default_allocation_pct
  END,
  reference_item.sort_order
FROM project_consultant_requirement_sets requirement_set
JOIN cpa_projects cpa_project ON cpa_project.project_id = requirement_set.project_id
JOIN consultant_requirement_reference_items reference_item ON reference_item.is_active = 1
WHERE requirement_set.status IN ('DRAFT', 'APPROVED')
  AND NOT EXISTS (
    SELECT 1
    FROM project_consultant_requirements existing_requirement
    WHERE existing_requirement.requirement_set_id = requirement_set.id
  );
