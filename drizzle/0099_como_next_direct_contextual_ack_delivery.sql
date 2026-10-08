-- COMO Next: independent, direct-SMTP contextual courtesy delivery path.
-- ADDITIVE ONLY. Do not apply automatically. This creates disabled-by-default
-- settings and a ledger that reserves a Message-ID before SMTP. It neither
-- sends email, creates Drafts, backfills, updates existing data, nor changes
-- the legacy COMO_OUTBOUND_EMAIL_ENABLED policy.

CREATE TABLE IF NOT EXISTS `como_next_direct_contextual_ack_delivery_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `mailbox_key` varchar(64) NOT NULL,
  `is_enabled` tinyint NOT NULL DEFAULT 0,
  `delivery_mode` enum('direct_courtesy_only') NOT NULL DEFAULT 'direct_courtesy_only',
  `activation_started_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `como_next_direct_ack_delivery_setting_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_direct_ack_delivery_setting_user_mailbox_uq` UNIQUE (`user_id`, `mailbox_key`),
  INDEX `como_next_direct_ack_delivery_setting_enabled_idx` (`is_enabled`, `updated_at`)
);

CREATE TABLE IF NOT EXISTS `como_next_direct_contextual_ack_delivery_ledger` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `idempotency_key` varchar(128) NOT NULL,
  `user_id` int NOT NULL,
  `email_message_id` bigint NOT NULL,
  `project_id` int NULL,
  `work_file_id` int NULL,
  `activation_started_at` timestamp NOT NULL,
  `status` enum('claimed','skipped','manual_review','draft_ready','draft_and_sara_ready','sending','sent','send_uncertain','failed') NOT NULL DEFAULT 'claimed',
  `claim_token` varchar(64) NULL,
  `claimed_at` timestamp NULL,
  `disposition` enum('direct_send_courtesy','draft_and_notify_sara','manual_review','skip') NULL,
  `reason` varchar(96) NULL,
  `sent_reviewed_at` timestamp NULL,
  `sent_review_outcome` enum('no_relevant_owner_reply','owner_reply_present','ambiguous','not_reviewed') NOT NULL DEFAULT 'not_reviewed',
  `communication_id` bigint NULL,
  `mailbox_draft_ref` varchar(500) NULL,
  `sara_proposal_id` bigint NULL,
  `outbound_message_id` varchar(320) NULL,
  `send_started_at` timestamp NULL,
  `smtp_accepted_at` timestamp NULL,
  `smtp_response` text NULL,
  `sent_record_ref` varchar(500) NULL,
  `last_error` text NULL,
  `completed_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `como_next_direct_ack_delivery_idempotency_uq` UNIQUE (`idempotency_key`),
  CONSTRAINT `como_next_direct_ack_delivery_email_uq` UNIQUE (`email_message_id`),
  CONSTRAINT `como_next_direct_ack_delivery_message_id_uq` UNIQUE (`outbound_message_id`),
  CONSTRAINT `como_next_direct_ack_delivery_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_direct_ack_delivery_email_fk` FOREIGN KEY (`email_message_id`) REFERENCES `como_next_email_messages` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_direct_ack_delivery_project_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_direct_ack_delivery_file_fk` FOREIGN KEY (`project_id`, `work_file_id`) REFERENCES `como_next_work_files` (`project_id`, `id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_direct_ack_delivery_communication_fk` FOREIGN KEY (`communication_id`) REFERENCES `como_next_communications` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_direct_ack_delivery_sara_proposal_fk` FOREIGN KEY (`sara_proposal_id`) REFERENCES `como_next_intake_proposals` (`id`) ON DELETE RESTRICT,
  INDEX `como_next_direct_ack_delivery_user_status_idx` (`user_id`, `status`, `updated_at`),
  INDEX `como_next_direct_ack_delivery_claim_expiry_idx` (`status`, `claimed_at`),
  INDEX `como_next_direct_ack_delivery_project_file_idx` (`project_id`, `work_file_id`, `updated_at`)
);
