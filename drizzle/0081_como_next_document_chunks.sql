-- COMO Next document chunks for resumable large-file storage
-- Additive only. No operational, project, or financial table is altered.

CREATE TABLE IF NOT EXISTS `como_next_document_chunks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `document_id` bigint NOT NULL,
  `chunk_index` int NOT NULL,
  `byte_size` int NOT NULL,
  `sha256` varchar(64) NOT NULL,
  `storage_key` varchar(1000) NOT NULL,
  `storage_url` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_document_chunk_order_uq` (`document_id`,`chunk_index`),
  UNIQUE KEY `como_next_document_chunk_key_uq` (`storage_key`),
  KEY `como_next_document_chunk_document_idx` (`document_id`),
  CONSTRAINT `como_next_document_chunk_document_fk` FOREIGN KEY (`document_id`) REFERENCES `como_next_documents` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
