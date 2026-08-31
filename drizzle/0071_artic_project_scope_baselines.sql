-- ARTEC project-specific design-scope baselines extracted from:
-- Schedule of Design Fees — All Plots (owner-provided source).
--
-- Rules:
-- 1. Create a new auditable revision instead of overwriting the prior project scope.
-- 2. Preserve the comprehensive reference library unchanged.
-- 3. Select only existing reference items that directly map to a discipline shown
--    as Included in ARTEC's schedule for that exact plot.
-- 4. Do not import the quoted percentages/amounts here; this migration changes
--    project scope only, not consultant financial offer data.
-- 5. Mark ARTEC as Included for every initially selected baseline item so its
--    initial gap is zero. Later owner edits remain authoritative and independent.

INSERT INTO project_consultant_requirement_sets
  (project_id, title, revision_no, status, notes)
SELECT
  cp.project_id,
  CONCAT('نطاق ARTEC النموذجي — قطعة ', cp.plot_number),
  COALESCE((
    SELECT MAX(existing.revision_no)
    FROM project_consultant_requirement_sets existing
    WHERE existing.project_id = cp.project_id
  ), 0) + 1,
  'DRAFT',
  CONCAT('ARTEC_SCOPE_BASELINE_V1 | مصدر النطاق: Schedule of Design Fees — All Plots | رقم القطعة: ', cp.plot_number)
FROM cpa_projects cp
WHERE cp.plot_number IN ('6457956', '6457879', '6182776', '6185392', '3260885', '6180578')
  AND NOT EXISTS (
    SELECT 1
    FROM project_consultant_requirement_sets existing
    WHERE existing.project_id = cp.project_id
      AND existing.notes LIKE 'ARTEC_SCOPE_BASELINE_V1%'
  );

INSERT INTO project_consultant_requirements
  (requirement_set_id, reference_item_id, source_type, workstream, requirement_group,
   code, label, description, is_required, gap_value_aed, pricing_basis,
   duration_months, allocation_pct, sort_order)
SELECT
  artic_set.id,
  ref.id,
  'REFERENCE',
  ref.workstream,
  ref.requirement_group,
  ref.code,
  ref.label,
  COALESCE(previous_req.description, ref.description),
  CASE
    -- The supplied ARTEC schedule is a design-fee schedule. It does not define
    -- supervision staffing, so existing project-specific supervision selections
    -- are carried forward unchanged rather than silently removed.
    WHEN ref.source_type = 'LEGACY_SUPERVISION' THEN COALESCE(previous_req.is_required, 0)

    -- Disciplines included by ARTEC for all six plots.
    WHEN ref.code IN (
      'ARCH_DESIGN', 'STRUCTURAL_DESIGN', 'MEP_ENGINEERING', 'FLS',
      'SIGNAGE_WAYFINDING', 'QS_BOQ', 'TENDER_DOCS',
      'AUTHORITY_SUBMISSIONS', 'BUILDING_PERMIT', 'BIM_MANAGEMENT', 'PI_INSURANCE'
    ) THEN 1

    -- SIRA is Included for every plot except the villas, where ARTEC states N/A.
    WHEN ref.code = 'SECURITY_SIRA' AND cp.plot_number <> '6180578' THEN 1

    -- TIS, vertical transportation and acoustics are Included only for the two
    -- Majan projects; ARTEC states N/A for the other four plots.
    WHEN ref.code IN ('TIS', 'VERTICAL_TRANSPORT', 'ACOUSTIC')
      AND cp.plot_number IN ('6457956', '6457879') THEN 1

    -- Interior, landscape, facade and lighting are Included for the shopping
    -- centre, Majan mixed-use and Nad Al Sheba Plot 1. They are Excluded for
    -- Plot 2, Al Jaddaf and the villas in the supplied schedule.
    WHEN ref.code IN (
      'ID_COMMON_AREAS', 'ID_UNIT_PROTOTYPES', 'LANDSCAPE_WATER',
      'FACADE_ENGINEERING', 'FACADE_LIGHTING'
    ) AND cp.plot_number IN ('6457956', '6457879', '6185392') THEN 1

    ELSE 0
  END,
  COALESCE(previous_req.gap_value_aed, ref.default_gap_value_aed),
  COALESCE(previous_req.pricing_basis, ref.pricing_basis),
  COALESCE(previous_req.duration_months, ref.default_duration_months),
  COALESCE(previous_req.allocation_pct, ref.default_allocation_pct),
  ref.sort_order
FROM project_consultant_requirement_sets artic_set
JOIN cpa_projects cp ON cp.project_id = artic_set.project_id
JOIN consultant_requirement_reference_items ref ON ref.is_active = 1
LEFT JOIN project_consultant_requirement_sets previous_set
  ON previous_set.project_id = artic_set.project_id
 AND previous_set.revision_no = artic_set.revision_no - 1
LEFT JOIN project_consultant_requirements previous_req
  ON previous_req.requirement_set_id = previous_set.id
 AND previous_req.reference_item_id = ref.id
WHERE artic_set.notes LIKE 'ARTEC_SCOPE_BASELINE_V1%'
  AND NOT EXISTS (
    SELECT 1
    FROM project_consultant_requirements existing_req
    WHERE existing_req.requirement_set_id = artic_set.id
  );

UPDATE project_consultant_requirement_sets previous_set
SET previous_set.status = 'REPLACED'
WHERE previous_set.status IN ('DRAFT', 'APPROVED')
  AND previous_set.notes NOT LIKE 'ARTEC_SCOPE_BASELINE_V1%'
  AND EXISTS (
    SELECT 1
    FROM project_consultant_requirement_sets artic_set
    WHERE artic_set.project_id = previous_set.project_id
      AND artic_set.notes LIKE 'ARTEC_SCOPE_BASELINE_V1%'
      AND artic_set.revision_no > previous_set.revision_no
  );

UPDATE cpa_consultant_scope_coverage coverage
JOIN cpa_project_consultants project_consultant
  ON project_consultant.id = coverage.project_consultant_id
JOIN cpa_projects cp ON cp.id = project_consultant.cpa_project_id
JOIN project_consultant_requirement_sets artic_set
  ON artic_set.project_id = cp.project_id
 AND artic_set.notes LIKE 'ARTEC_SCOPE_BASELINE_V1%'
JOIN project_consultant_requirements requirement
  ON requirement.requirement_set_id = artic_set.id
 AND requirement.is_required = 1
JOIN consultant_requirement_reference_items ref
  ON ref.id = requirement.reference_item_id
 AND ref.source_type = 'LEGACY_SCOPE'
 AND ref.legacy_scope_item_id = coverage.scope_item_id
SET coverage.coverage_status = 'INCLUDED',
    coverage.notes = CONCAT(
      'مشمول حسب نطاق ARTEC النموذجي المقدم لهذا المشروع',
      ' | الحالة السابقة: ', coverage.coverage_status,
      CASE
        WHEN coverage.notes IS NOT NULL AND coverage.notes <> ''
          THEN CONCAT(' | الملاحظة السابقة: ', coverage.notes)
        ELSE ''
      END
    )
WHERE project_consultant.consultant_id = 4
  AND COALESCE(coverage.notes, '') NOT LIKE 'مشمول حسب نطاق ARTEC النموذجي%';

INSERT INTO cpa_consultant_scope_coverage
  (project_consultant_id, scope_item_id, coverage_status, notes)
SELECT
  project_consultant.id,
  ref.legacy_scope_item_id,
  'INCLUDED',
  'مشمول حسب نطاق ARTEC النموذجي المقدم لهذا المشروع'
FROM cpa_project_consultants project_consultant
JOIN cpa_projects cp ON cp.id = project_consultant.cpa_project_id
JOIN project_consultant_requirement_sets artic_set
  ON artic_set.project_id = cp.project_id
 AND artic_set.notes LIKE 'ARTEC_SCOPE_BASELINE_V1%'
JOIN project_consultant_requirements requirement
  ON requirement.requirement_set_id = artic_set.id
 AND requirement.is_required = 1
JOIN consultant_requirement_reference_items ref
  ON ref.id = requirement.reference_item_id
 AND ref.source_type = 'LEGACY_SCOPE'
WHERE project_consultant.consultant_id = 4
  AND NOT EXISTS (
    SELECT 1
    FROM cpa_consultant_scope_coverage existing_coverage
    WHERE existing_coverage.project_consultant_id = project_consultant.id
      AND existing_coverage.scope_item_id = ref.legacy_scope_item_id
  );
