-- COMO Next: Draft-only contextual acknowledgment activation and durable idempotency ledger.
-- Additive only. This migration creates two new tables and indexes; it does not
-- alter, backfill, delete, send, or otherwise mutate existing user/mailbox data.
-- Review before applying: the only runtime effect after application is dormant
-- storage because settings default disabled and the sole delivery mode is draft_only.

CREATE TABLE IF NOT EXISTS `como_next_contextual_acknowledgment_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `mailbox_key` varchar(64) NOT NULL,
  `is_enabled` tinyint NOT NULL DEFAULT 0,
  `delivery_mode` enum('draft_only') NOT NULL DEFAULT 'draft_only',
  `activation_started_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `como_next_context_ack_setting_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_context_ack_setting_user_mailbox_uq` UNIQUE (`user_id`, `mailbox_key`),
  INDEX `como_next_context_ack_setting_enabled_idx` (`is_enabled`, `updated_at`)
);

CREATE TABLE IF NOT EXISTS `como_next_contextual_acknowledgment_ledger` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `idempotency_key` varchar(128) NOT NULL,
  `user_id` int NOT NULL,
  `email_message_id` bigint NOT NULL,
  `project_id` int NULL,
  `work_file_id` int NULL,
  `activation_started_at` timestamp NOT NULL,
  `status` enum('claimed','skipped','manual_review','draft_ready','draft_and_sara_ready','failed') NOT NULL DEFAULT 'claimed',
  `claim_token` varchar(64) NULL,
  `claimed_at` timestamp NULL,
  `disposition` enum('auto_ack_candidate','draft_and_notify_sara','manual_review','skip') NULL,
  `reason` varchar(96) NULL,
  `sent_reviewed_at` timestamp NULL,
  `sent_review_outcome` enum('no_relevant_owner_reply','owner_reply_present','ambiguous','not_reviewed') NOT NULL DEFAULT 'not_reviewed',
  `communication_id` bigint NULL,
  `mailbox_draft_ref` varchar(500) NULL,
  `sara_proposal_id` bigint NULL,
  `last_error` text NULL,
  `completed_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `como_next_context_ack_idempotency_uq` UNIQUE (`idempotency_key`),
  CONSTRAINT `como_next_context_ack_email_uq` UNIQUE (`email_message_id`),
  CONSTRAINT `como_next_context_ack_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_context_ack_email_fk` FOREIGN KEY (`email_message_id`) REFERENCES `como_next_email_messages` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_context_ack_project_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_context_ack_file_fk` FOREIGN KEY (`project_id`, `work_file_id`) REFERENCES `como_next_work_files` (`project_id`, `id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_context_ack_communication_fk` FOREIGN KEY (`communication_id`) REFERENCES `como_next_communications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_context_ack_sara_proposal_fk` FOREIGN KEY (`sara_proposal_id`) REFERENCES `como_next_intake_proposals` (`id`) ON DELETE RESTRICT,
  INDEX `como_next_context_ack_user_status_idx` (`user_id`, `status`, `updated_at`),
  INDEX `como_next_context_ack_claim_expiry_idx` (`status`, `claimed_at`),
  INDEX `como_next_context_ack_project_file_idx` (`project_id`, `work_file_id`, `updated_at`)
);
