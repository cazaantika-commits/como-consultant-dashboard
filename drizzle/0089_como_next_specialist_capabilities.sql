-- COMO Next governed specialist capabilities
-- Additive only. Specialists analyse on explicit owner request and produce review-only drafts.

CREATE TABLE IF NOT EXISTS como_next_specialist_capabilities (
  id INT NOT NULL AUTO_INCREMENT,
  capability_code VARCHAR(64) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  scope_summary TEXT NOT NULL,
  operating_mode ENUM('on_demand_only') NOT NULL DEFAULT 'on_demand_only',
  authority_mode ENUM('draft_review_only') NOT NULL DEFAULT 'draft_review_only',
  is_enabled TINYINT NOT NULL DEFAULT 1,
  prompt_version VARCHAR(64) NOT NULL DEFAULT 'v1',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY como_next_specialist_capability_code_uq (capability_code),
  KEY como_next_specialist_enabled_idx (is_enabled, capability_code)
);

CREATE TABLE IF NOT EXISTS como_next_specialist_reviews (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  project_id INT NOT NULL,
  work_file_id INT NULL,
  capability_code VARCHAR(64) NOT NULL,
  request_text LONGTEXT NOT NULL,
  request_key VARCHAR(128) NOT NULL,
  context_sha256 CHAR(64) NOT NULL,
  model_id VARCHAR(128) NULL,
  review_status ENUM('requested','draft','reviewed','dismissed','failed') NOT NULL DEFAULT 'requested',
  risk_level ENUM('normal','attention','urgent') NULL,
  executive_summary TEXT NULL,
  output_json LONGTEXT NULL,
  error_message TEXT NULL,
  reviewed_by_user_id INT NULL,
  review_note TEXT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY como_next_specialist_request_uq (user_id, request_key),
  KEY como_next_specialist_project_idx (project_id, capability_code, review_status, created_at),
  KEY como_next_specialist_work_file_idx (work_file_id, review_status, created_at),
  CONSTRAINT como_next_specialist_review_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT como_next_specialist_review_reviewer_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT como_next_specialist_review_capability_fk FOREIGN KEY (capability_code) REFERENCES como_next_specialist_capabilities(capability_code) ON DELETE RESTRICT,
  CONSTRAINT como_next_specialist_review_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
  CONSTRAINT como_next_specialist_review_work_file_fk FOREIGN KEY (project_id, work_file_id) REFERENCES como_next_work_files(project_id, id) ON DELETE RESTRICT
);

INSERT IGNORE INTO como_next_specialist_capabilities
  (capability_code, display_name, scope_summary, operating_mode, authority_mode, is_enabled, prompt_version)
VALUES
  ('project_monitor', 'مراقب المشروع والمتابعة التنفيذية', 'يراجع موضع المشروع، المتأخرات، الاعتماديات، الالتزامات، القرارات المفتوحة، والاجتماعات والمراسلات ليعد مسودة متابعة موثقة لعبد الرحمن.', 'on_demand_only', 'draft_review_only', 1, 'v1'),
  ('contract_manager', 'مدير العقود', 'يراجع العقود والتسليمات والالتزامات والإشعارات والتغييرات والمخاطر التجارية من سجل المشروع ووثائقه ليعد مسودة موقف تعاقدي للمراجعة.', 'on_demand_only', 'draft_review_only', 1, 'v1');
