CREATE TABLE IF NOT EXISTS project_consultant_requirement_sets (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  title VARCHAR(300) NOT NULL DEFAULT 'متطلبات الاستشاريين للمشروع',
  revision_no INT NOT NULL DEFAULT 1,
  status ENUM('DRAFT', 'APPROVED', 'REPLACED') NOT NULL DEFAULT 'DRAFT',
  notes TEXT NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX pcrs_project_revision (project_id, revision_no),
  INDEX pcrs_project_status (project_id, status)
);

CREATE TABLE IF NOT EXISTS project_consultant_requirements (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requirement_set_id INT NOT NULL,
  reference_item_id INT NULL,
  source_type ENUM('REFERENCE', 'CUSTOM') NOT NULL DEFAULT 'REFERENCE',
  workstream ENUM('DESIGN', 'ENGINEERING', 'SUPERVISION', 'GENERAL') NOT NULL DEFAULT 'GENERAL',
  requirement_group VARCHAR(200) NOT NULL DEFAULT 'متطلبات عامة',
  code VARCHAR(80) NULL,
  label VARCHAR(300) NOT NULL,
  description TEXT NULL,
  is_required TINYINT NOT NULL DEFAULT 1,
  gap_value_aed DECIMAL(15,2) NULL,
  pricing_basis ENUM('FIXED', 'MONTHLY', 'PERCENT_OF_FEE', 'MANUAL') NOT NULL DEFAULT 'FIXED',
  duration_months INT NULL,
  allocation_pct DECIMAL(5,2) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX pcr_set_sort (requirement_set_id, sort_order),
  INDEX pcr_set_required (requirement_set_id, is_required),
  INDEX pcr_reference (reference_item_id)
);
