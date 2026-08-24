CREATE TABLE IF NOT EXISTS consultant_offer_readings (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_consultant_id INT NOT NULL,
  project_requirement_set_id INT NOT NULL,
  source_proposal_id INT NULL,
  status ENUM('DRAFT', 'REVIEWED', 'SUPERSEDED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
  model_id VARCHAR(100) NULL,
  input_snapshot LONGTEXT NOT NULL,
  extraction_json LONGTEXT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX cor_project_consultant (project_consultant_id, created_at),
  INDEX cor_requirement_set (project_requirement_set_id),
  INDEX cor_source_proposal (source_proposal_id),
  INDEX cor_status (status)
);
