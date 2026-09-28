-- COMO Next: protected meeting recordings and transcription lifecycle.
-- Additive only. No existing table or financial engine is modified.

CREATE TABLE IF NOT EXISTS `como_next_meeting_recordings` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `meeting_id` int NOT NULL,
  `recording_kind` enum('browser_recording','zoom_recording') NOT NULL,
  `recording_status` enum('uploaded','transcribing','transcribed','failed','discarded') NOT NULL DEFAULT 'uploaded',
  `document_id` bigint NOT NULL,
  `transcript_source_id` bigint,
  `original_file_name` varchar(1000) NOT NULL,
  `mime_type` varchar(255) NOT NULL,
  `byte_size` bigint NOT NULL,
  `duration_seconds` int,
  `sha256` varchar(64) NOT NULL,
  `error_message` text,
  `created_by_user_id` int NOT NULL,
  `source_system` varchar(64) NOT NULL DEFAULT 'como_next',
  `source_record_id` varchar(128),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `como_next_meeting_recordings_pk` PRIMARY KEY (`id`),
  CONSTRAINT `como_next_meeting_recording_meeting_fk` FOREIGN KEY (`meeting_id`) REFERENCES `como_next_meetings`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_recording_document_fk` FOREIGN KEY (`document_id`) REFERENCES `como_next_documents`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_recording_transcript_fk` FOREIGN KEY (`transcript_source_id`) REFERENCES `como_next_meeting_sources`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_recording_user_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_meeting_recording_file_uq` UNIQUE (`meeting_id`, `sha256`),
  CONSTRAINT `como_next_meeting_recording_source_uq` UNIQUE (`source_system`, `source_record_id`),
  INDEX `como_next_meeting_recording_status_idx` (`meeting_id`, `recording_status`, `created_at`)
);
