-- COMO Next unified project memory
-- Additive only. Existing project, financial, communication, decision, action,
-- meeting, and document records remain untouched.

CREATE TABLE IF NOT EXISTS `como_next_project_dossiers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `executive_context` longtext NOT NULL,
  `current_position` longtext NOT NULL,
  `lifecycle_phases_json` longtext NOT NULL,
  `key_parties_json` longtext NOT NULL,
  `dependencies_json` longtext NOT NULL,
  `open_threads_json` longtext NOT NULL,
  `memory_gaps_json` longtext NOT NULL,
  `brief_status` enum('reviewed','superseded') NOT NULL DEFAULT 'reviewed',
  `source_system` varchar(64) NOT NULL DEFAULT 'como_next',
  `source_record_id` varchar(128) NOT NULL,
  `source_sha256` varchar(64) NOT NULL,
  `reviewed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_project_dossier_project_uq` (`project_id`),
  UNIQUE KEY `como_next_project_dossier_source_uq` (`source_system`,`source_record_id`),
  KEY `como_next_project_dossier_status_idx` (`brief_status`,`updated_at`),
  CONSTRAINT `como_next_project_dossier_project_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS `como_next_memory_annotations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `memory_id` bigint NOT NULL,
  `confidence` enum('medium','high') NOT NULL,
  `sensitivity` enum('internal_only') NOT NULL DEFAULT 'internal_only',
  `evidence_refs_json` longtext NOT NULL,
  `source_report_sha256` varchar(64) NOT NULL,
  `reviewed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_memory_annotation_memory_uq` (`memory_id`),
  KEY `como_next_memory_annotation_confidence_idx` (`confidence`,`reviewed_at`),
  CONSTRAINT `como_next_memory_annotation_memory_fk` FOREIGN KEY (`memory_id`) REFERENCES `como_next_work_memory` (`id`) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS `como_next_owner_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` varchar(64) NOT NULL,
  `preference_key` varchar(128) NOT NULL,
  `title` varchar(500) NOT NULL,
  `body` longtext NOT NULL,
  `sensitivity` enum('internal_only') NOT NULL DEFAULT 'internal_only',
  `evidence_refs_json` longtext NOT NULL,
  `source_system` varchar(64) NOT NULL DEFAULT 'como_next',
  `source_record_id` varchar(128) NOT NULL,
  `source_sha256` varchar(64) NOT NULL,
  `is_current` tinyint NOT NULL DEFAULT 1,
  `reviewed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_owner_preference_member_key_uq` (`member_id`,`preference_key`),
  UNIQUE KEY `como_next_owner_preference_source_uq` (`source_system`,`source_record_id`),
  KEY `como_next_owner_preference_current_idx` (`member_id`,`is_current`,`updated_at`)
);
