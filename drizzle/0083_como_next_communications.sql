-- COMO Next project-scoped communication register
-- Additive only. This migration creates one table and does not alter operational,
-- project, financial, study, escrow, sales, or source-staging tables.

CREATE TABLE `como_next_communications` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `project_id` int NOT NULL,
  `work_file_id` int NOT NULL,
  `project_party_id` int,
  `source_memory_id` bigint,
  `channel` enum('email','whatsapp','letter','phone_note','internal') NOT NULL DEFAULT 'email',
  `direction` enum('inbound','outbound','internal') NOT NULL,
  `communication_status` enum('received','draft','approved_for_send','sent','cancelled','archived') NOT NULL,
  `approval_status` enum('not_required','pending','approved','rejected') NOT NULL DEFAULT 'not_required',
  `subject` varchar(1000) NOT NULL,
  `body` longtext NOT NULL,
  `from_text` text,
  `to_text` text,
  `cc_text` text,
  `external_message_ref` varchar(500),
  `evidence_reference` text,
  `review_note` text,
  `approved_by_user_id` int,
  `approved_at` timestamp,
  `occurred_at` timestamp NOT NULL,
  `sent_at` timestamp,
  `source_system` varchar(64) NOT NULL DEFAULT 'como_next',
  `source_record_id` varchar(128),
  `import_batch_id` varchar(100),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `como_next_communications_id` PRIMARY KEY (`id`),
  CONSTRAINT `como_next_communication_source_uq` UNIQUE (`source_system`,`source_record_id`),
  CONSTRAINT `como_next_communication_memory_uq` UNIQUE (`source_memory_id`),
  CONSTRAINT `como_next_communication_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_communication_approved_by_fk` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_communication_work_file_fk` FOREIGN KEY (`project_id`,`work_file_id`) REFERENCES `como_next_work_files`(`project_id`,`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_communication_project_party_fk` FOREIGN KEY (`project_id`,`project_party_id`) REFERENCES `como_next_project_parties`(`project_id`,`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_communication_source_memory_fk` FOREIGN KEY (`source_memory_id`) REFERENCES `como_next_work_memory`(`id`) ON DELETE RESTRICT
);

CREATE INDEX `como_next_communication_file_time_idx` ON `como_next_communications` (`work_file_id`,`occurred_at`);
CREATE INDEX `como_next_communication_project_status_idx` ON `como_next_communications` (`project_id`,`communication_status`,`occurred_at`);
