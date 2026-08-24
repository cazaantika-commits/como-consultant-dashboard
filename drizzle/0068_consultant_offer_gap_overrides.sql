CREATE TABLE IF NOT EXISTS consultant_offer_gap_overrides (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_consultant_id INT NOT NULL,
  project_requirement_set_id INT NOT NULL,
  project_requirement_id INT NOT NULL,
  gap_value_aed DECIMAL(15,2) NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY cogo_unique_item (project_consultant_id, project_requirement_set_id, project_requirement_id),
  INDEX cogo_requirement_set (project_requirement_set_id)
);
