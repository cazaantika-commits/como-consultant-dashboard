-- COMO Next: project-specific initial program governance.
-- Additive only. No changes to financial, cash-flow, contract, or market records.

CREATE UNIQUE INDEX `psi_project_service_unique`
  ON `project_service_instances` (`projectId`, `serviceCode`);

CREATE UNIQUE INDEX `prs_project_service_requirement_unique`
  ON `project_requirement_status` (`projectId`, `serviceCode`, `requirementCode`);

CREATE UNIQUE INDEX `pss_project_stage_unique`
  ON `project_stage_status` (`projectId`, `stageCode`);

CREATE UNIQUE INDEX `psfv_project_service_field_unique`
  ON `project_stage_field_values` (`projectId`, `serviceCode`, `fieldKey`);

CREATE TABLE IF NOT EXISTS `project_program_approvals` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `project_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `decision_status` ENUM('reviewed','approved','rejected') NOT NULL,
  `source_schema_version` VARCHAR(50) NOT NULL,
  `program_hash` VARCHAR(64) NOT NULL,
  `service_count` INT NOT NULL,
  `stage_count` INT NOT NULL,
  `earliest_start_date` VARCHAR(10) NULL,
  `latest_due_date` VARCHAR(10) NULL,
  `program_snapshot_json` LONGTEXT NOT NULL,
  `notes` TEXT NULL,
  `decided_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_program_approvals_project_time_idx` (`project_id`, `decided_at`),
  CONSTRAINT `project_program_approvals_project_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `project_program_approvals_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
);
