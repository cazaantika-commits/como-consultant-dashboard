-- COMO Next promoted documents
-- Additive only. No operational, project, or financial table is altered.

CREATE TABLE IF NOT EXISTS `como_next_documents` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(1000) NOT NULL,
  `file_name` varchar(1000) NOT NULL,
  `mime_type` varchar(255) NOT NULL,
  `byte_size` bigint NOT NULL,
  `sha256` varchar(64) NOT NULL,
  `storage_key` varchar(1000) NOT NULL,
  `storage_url` text NOT NULL,
  `source_system` varchar(64) NOT NULL DEFAULT 'como_next',
  `source_key` varchar(1000) DEFAULT NULL,
  `source_url` text DEFAULT NULL,
  `import_batch_id` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_document_sha_uq` (`sha256`),
  UNIQUE KEY `como_next_document_storage_key_uq` (`storage_key`),
  KEY `como_next_document_batch_idx` (`import_batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `como_next_work_memory_documents` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `work_file_id` int NOT NULL,
  `memory_id` bigint NOT NULL,
  `document_id` bigint NOT NULL,
  `relation_type` enum('attachment','source','evidence') NOT NULL DEFAULT 'attachment',
  `source_system` varchar(64) NOT NULL DEFAULT 'como_next',
  `source_record_id` varchar(128) DEFAULT NULL,
  `import_batch_id` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_memory_document_uq` (`memory_id`,`document_id`),
  KEY `como_next_memory_document_file_idx` (`work_file_id`,`memory_id`),
  KEY `como_next_memory_document_batch_idx` (`import_batch_id`),
  CONSTRAINT `como_next_memory_document_memory_fk` FOREIGN KEY (`memory_id`) REFERENCES `como_next_work_memory` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_memory_document_document_fk` FOREIGN KEY (`document_id`) REFERENCES `como_next_documents` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_memory_document_file_fk` FOREIGN KEY (`project_id`,`work_file_id`) REFERENCES `como_next_work_files` (`project_id`,`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
