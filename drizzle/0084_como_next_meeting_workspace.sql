-- COMO Next controlled meeting workspace
-- Additive only. This migration creates meeting-control tables and does not alter,
-- update, or delete project, financial, study, source-staging, or promoted history.

CREATE TABLE IF NOT EXISTS `como_next_meeting_consents` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `meeting_id` int NOT NULL,
  `consent_scope` enum('recording','transcription') NOT NULL,
  `consent_status` enum('pending','granted','declined','not_required') NOT NULL DEFAULT 'pending',
  `consent_basis` text,
  `evidence_reference` text,
  `recorded_by_user_id` int NOT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `source_system` varchar(64) NOT NULL DEFAULT 'como_next',
  `source_record_id` varchar(128),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `como_next_meeting_consents_id` PRIMARY KEY (`id`),
  CONSTRAINT `como_next_meeting_consent_scope_uq` UNIQUE (`meeting_id`,`consent_scope`),
  CONSTRAINT `como_next_meeting_consent_source_uq` UNIQUE (`source_system`,`source_record_id`),
  CONSTRAINT `como_next_meeting_consent_meeting_fk` FOREIGN KEY (`meeting_id`) REFERENCES `como_next_meetings`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_consent_user_fk` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS `como_next_meeting_sources` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `meeting_id` int NOT NULL,
  `source_kind` enum('preparation','notes','transcript') NOT NULL,
  `visibility` enum('meeting_record','internal_only') NOT NULL DEFAULT 'meeting_record',
  `title` varchar(1000) NOT NULL,
  `raw_text` longtext NOT NULL,
  `source_document_id` bigint,
  `consent_id` bigint,
  `source_sha256` varchar(64) NOT NULL,
  `source_status` enum('captured','ready_for_analysis','archived') NOT NULL DEFAULT 'captured',
  `created_by_user_id` int NOT NULL,
  `source_system` varchar(64) NOT NULL DEFAULT 'como_next',
  `source_record_id` varchar(128),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `como_next_meeting_sources_id` PRIMARY KEY (`id`),
  CONSTRAINT `como_next_meeting_source_external_uq` UNIQUE (`source_system`,`source_record_id`),
  CONSTRAINT `como_next_meeting_source_meeting_fk` FOREIGN KEY (`meeting_id`) REFERENCES `como_next_meetings`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_source_document_fk` FOREIGN KEY (`source_document_id`) REFERENCES `como_next_documents`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_source_consent_fk` FOREIGN KEY (`consent_id`) REFERENCES `como_next_meeting_consents`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_source_user_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_source_transcript_consent_ck` CHECK (`source_kind` <> 'transcript' OR `consent_id` IS NOT NULL)
);

CREATE INDEX `como_next_meeting_source_meeting_idx` ON `como_next_meeting_sources` (`meeting_id`,`source_status`,`created_at`);

CREATE TABLE IF NOT EXISTS `como_next_meeting_analyses` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `meeting_id` int NOT NULL,
  `source_id` bigint NOT NULL,
  `analysis_type` enum('preparation','evidence_extraction') NOT NULL,
  `analysis_status` enum('draft','reviewed','applied','rejected') NOT NULL DEFAULT 'draft',
  `summary` longtext NOT NULL,
  `open_questions_json` longtext,
  `model_id` varchar(120) NOT NULL,
  `evidence_bound` tinyint NOT NULL DEFAULT 1,
  `request_key` varchar(128) NOT NULL,
  `requested_by_user_id` int NOT NULL,
  `reviewed_by_user_id` int,
  `reviewed_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `como_next_meeting_analyses_id` PRIMARY KEY (`id`),
  CONSTRAINT `como_next_meeting_analysis_request_uq` UNIQUE (`request_key`),
  CONSTRAINT `como_next_meeting_analysis_meeting_fk` FOREIGN KEY (`meeting_id`) REFERENCES `como_next_meetings`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_analysis_source_fk` FOREIGN KEY (`source_id`) REFERENCES `como_next_meeting_sources`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_analysis_requested_by_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_analysis_reviewed_by_fk` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_analysis_evidence_ck` CHECK (`evidence_bound` = 1)
);

CREATE INDEX `como_next_meeting_analysis_meeting_idx` ON `como_next_meeting_analyses` (`meeting_id`,`analysis_status`,`created_at`);

CREATE TABLE IF NOT EXISTS `como_next_meeting_proposals` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `analysis_id` bigint NOT NULL,
  `meeting_id` int NOT NULL,
  `ordinal` int NOT NULL,
  `proposal_kind` enum('question','check','decision','action','external_commitment','risk','note') NOT NULL,
  `title` varchar(1000) NOT NULL,
  `content` longtext,
  `assigned_to` varchar(255),
  `due_at` timestamp,
  `evidence_excerpt` text NOT NULL,
  `audience` enum('meeting_record','internal_only') NOT NULL DEFAULT 'meeting_record',
  `review_status` enum('pending','applied','dismissed') NOT NULL DEFAULT 'pending',
  `applied_as` enum('agenda_item','decision','action','external_commitment','risk','note','communication_draft'),
  `target_id` bigint,
  `review_note` text,
  `reviewed_by_user_id` int,
  `reviewed_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `como_next_meeting_proposals_id` PRIMARY KEY (`id`),
  CONSTRAINT `como_next_meeting_proposal_order_uq` UNIQUE (`analysis_id`,`ordinal`),
  CONSTRAINT `como_next_meeting_proposal_analysis_fk` FOREIGN KEY (`analysis_id`) REFERENCES `como_next_meeting_analyses`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_proposal_meeting_fk` FOREIGN KEY (`meeting_id`) REFERENCES `como_next_meetings`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_proposal_reviewed_by_fk` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT
);

CREATE INDEX `como_next_meeting_proposal_review_idx` ON `como_next_meeting_proposals` (`meeting_id`,`review_status`,`created_at`);

CREATE TABLE IF NOT EXISTS `como_next_meeting_minutes` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `meeting_id` int NOT NULL,
  `version` int NOT NULL,
  `minutes_status` enum('draft','approved','rejected','superseded') NOT NULL DEFAULT 'draft',
  `summary` longtext NOT NULL,
  `content` longtext NOT NULL,
  `prepared_by_user_id` int NOT NULL,
  `reviewed_by_user_id` int,
  `review_note` text,
  `approved_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `como_next_meeting_minutes_id` PRIMARY KEY (`id`),
  CONSTRAINT `como_next_meeting_minutes_version_uq` UNIQUE (`meeting_id`,`version`),
  CONSTRAINT `como_next_meeting_minutes_meeting_fk` FOREIGN KEY (`meeting_id`) REFERENCES `como_next_meetings`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_minutes_prepared_by_fk` FOREIGN KEY (`prepared_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_minutes_reviewed_by_fk` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_minutes_approval_ck` CHECK (`minutes_status` <> 'approved' OR (`reviewed_by_user_id` IS NOT NULL AND `approved_at` IS NOT NULL))
);

CREATE INDEX `como_next_meeting_minutes_status_idx` ON `como_next_meeting_minutes` (`meeting_id`,`minutes_status`,`version`);
