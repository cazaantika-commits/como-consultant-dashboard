-- COMO Next: owner-reviewed Manus directives captured by Sara or entered manually.
-- Additive only. No existing table or operational record is modified.

CREATE TABLE como_next_staged_directives (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  project_id INT NOT NULL,
  work_file_id INT NOT NULL,
  action_id INT NULL,
  current_decision_id INT NULL,
  source ENUM('sara','manual') NOT NULL,
  source_member_id VARCHAR(64) NULL,
  stage_key VARCHAR(128) NOT NULL,
  directive_text LONGTEXT NOT NULL,
  status ENUM('pending','submitting','submitted','cancelled','failed') NOT NULL DEFAULT 'pending',
  submission_claimed_at TIMESTAMP NULL,
  submitted_at TIMESTAMP NULL,
  update_id BIGINT NULL,
  communication_draft_id BIGINT NULL,
  mailbox_draft_ref VARCHAR(500) NULL,
  work_product_id BIGINT NULL,
  execution_summary LONGTEXT NULL,
  result_json LONGTEXT NULL,
  failure_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT como_next_staged_directive_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT como_next_staged_directive_file_fk FOREIGN KEY (project_id, work_file_id) REFERENCES como_next_work_files(project_id, id) ON DELETE RESTRICT,
  CONSTRAINT como_next_staged_directive_action_fk FOREIGN KEY (project_id, action_id) REFERENCES como_next_actions(project_id, id) ON DELETE RESTRICT,
  CONSTRAINT como_next_staged_directive_decision_fk FOREIGN KEY (current_decision_id) REFERENCES como_next_decisions(id) ON DELETE RESTRICT,
  UNIQUE INDEX como_next_staged_directive_user_key_uq (user_id, stage_key),
  INDEX como_next_staged_directive_file_status_idx (work_file_id, status, updated_at),
  INDEX como_next_staged_directive_user_status_idx (user_id, status, updated_at)
);
