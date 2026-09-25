-- COMO Next executive decision register
-- Additive only. No operational, project, or financial table is altered.

CREATE TABLE IF NOT EXISTS `como_next_decisions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `project_id` int NOT NULL,
  `work_file_id` int NOT NULL,
  `title` varchar(500) NOT NULL,
  `question` text NOT NULL,
  `context_summary` longtext,
  `recommendation` longtext,
  `decision_status` enum('required','approved','rejected','deferred','superseded') NOT NULL DEFAULT 'required',
  `decision_authority` enum('abdulrahman','wael','sheikh_issa','joint','other') NOT NULL DEFAULT 'abdulrahman',
  `decision_text` longtext,
  `evidence_reference` text,
  `due_at` timestamp NULL,
  `decided_by_user_id` int NULL,
  `decided_at` timestamp NULL,
  `source_system` varchar(64) NOT NULL DEFAULT 'como_next',
  `source_record_id` varchar(128) NULL,
  `import_batch_id` varchar(100) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_decision_source_uq` (`source_system`,`source_record_id`),
  KEY `como_next_decision_project_status_idx` (`project_id`,`decision_status`,`due_at`),
  KEY `como_next_decision_file_status_idx` (`work_file_id`,`decision_status`,`due_at`),
  KEY `como_next_decision_user_fk` (`user_id`),
  KEY `como_next_decision_decided_by_fk` (`decided_by_user_id`),
  CONSTRAINT `como_next_decision_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_decision_decided_by_fk` FOREIGN KEY (`decided_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_decision_work_file_fk` FOREIGN KEY (`project_id`,`work_file_id`) REFERENCES `como_next_work_files` (`project_id`,`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
