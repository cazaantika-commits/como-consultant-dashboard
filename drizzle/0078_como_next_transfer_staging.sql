-- COMO Next transfer staging
-- Additive only. No operational, project, or financial table is altered.
-- Staging batches can be removed atomically; source rows are not active records.

CREATE TABLE `como_next_import_batches` (
  `id` int AUTO_INCREMENT NOT NULL,
  `batch_id` varchar(100) NOT NULL,
  `source_system` varchar(64) NOT NULL,
  `source_fingerprint` varchar(64) NOT NULL,
  `mapping_version` int NOT NULL,
  `mapping_sha256` varchar(64) NOT NULL,
  `plan_sha256` varchar(64) NOT NULL,
  `batch_status` enum('staged','reviewed','promoted','rolled_back') NOT NULL DEFAULT 'staged',
  `source_record_count` int NOT NULL,
  `staged_record_count` int NOT NULL DEFAULT 0,
  `skipped_record_count` int NOT NULL DEFAULT 0,
  `staged_file_count` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `como_next_import_batches_pk` PRIMARY KEY (`id`),
  CONSTRAINT `como_next_import_batch_id_uq` UNIQUE (`batch_id`),
  KEY `como_next_import_source_status_idx` (`source_system`,`batch_status`)
);

CREATE TABLE `como_next_import_rows` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `import_batch_id` int NOT NULL,
  `source_table` varchar(120) NOT NULL,
  `source_record_id` varchar(128) NOT NULL,
  `source_project_id` varchar(128),
  `source_consultant_id` varchar(128),
  `disposition` enum('map_existing','create_candidate','create_work_file','create_event','create_entry','create_meeting','create_child','archive_history','skip_reference','reject_secret','blocked') NOT NULL,
  `target_type` varchar(120) NOT NULL,
  `target_id` bigint,
  `stage_status` enum('staged','skipped','rejected') NOT NULL,
  `disposition_reason` text NOT NULL,
  `payload_sha256` varchar(64) NOT NULL,
  `payload_json` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `como_next_import_rows_pk` PRIMARY KEY (`id`),
  CONSTRAINT `como_next_import_row_source_uq` UNIQUE (`import_batch_id`,`source_table`,`source_record_id`),
  KEY `como_next_import_row_status_idx` (`import_batch_id`,`stage_status`,`disposition`),
  KEY `como_next_import_row_project_idx` (`import_batch_id`,`source_project_id`),
  CONSTRAINT `como_next_import_row_batch_fk` FOREIGN KEY (`import_batch_id`) REFERENCES `como_next_import_batches` (`id`) ON DELETE CASCADE
);

CREATE TABLE `como_next_import_files` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `import_batch_id` int NOT NULL,
  `source_index` int NOT NULL,
  `original_name` varchar(1000),
  `stored_name` varchar(1000) NOT NULL,
  `source_url` text,
  `byte_size` bigint NOT NULL DEFAULT 0,
  `sha256` varchar(64),
  `canonical_stored_name` varchar(1000),
  `file_status` enum('verified_unique','verified_duplicate','reference_only','skipped') NOT NULL,
  `staged_storage_url` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `como_next_import_files_pk` PRIMARY KEY (`id`),
  CONSTRAINT `como_next_import_file_source_uq` UNIQUE (`import_batch_id`,`source_index`),
  KEY `como_next_import_file_sha_idx` (`sha256`),
  CONSTRAINT `como_next_import_file_batch_fk` FOREIGN KEY (`import_batch_id`) REFERENCES `como_next_import_batches` (`id`) ON DELETE CASCADE
);
