-- COMO Next project opportunity opening gate
-- Additive only. Official projects remain unchanged until an owner-reviewed opportunity is promoted.

CREATE TABLE IF NOT EXISTS `como_next_project_opportunities` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `opportunity_status` ENUM('under_study','under_review','ready_for_approval','approved','archived') NOT NULL DEFAULT 'under_study',
  `provisional_name` VARCHAR(255) NULL,
  `owner_relationship` ENUM('owned','potential_purchase','land_for_units','other_partnership','development_management','undecided') NULL,
  `development_strategy` ENUM('offplan_escrow','offplan_construction','build_for_sale','build_for_rent','joint_venture_land_for_units','undecided') NULL,
  `objective` TEXT NULL,
  `approved_project_id` INT NULL,
  `approved_by_user_id` INT NULL,
  `approved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_project_opportunity_project_uq` (`approved_project_id`),
  KEY `como_next_project_opportunity_owner_status_idx` (`user_id`,`opportunity_status`,`updated_at`),
  CONSTRAINT `como_next_project_opportunity_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_project_opportunity_project_fk` FOREIGN KEY (`approved_project_id`) REFERENCES `projects` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_project_opportunity_approver_fk` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS `como_next_project_opportunity_documents` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `opportunity_id` BIGINT NOT NULL,
  `document_id` BIGINT NOT NULL,
  `document_role` ENUM('land_document','developer_contract','fact_sheet','other_land_evidence') NOT NULL DEFAULT 'land_document',
  `analysis_status` ENUM('pending','processing','draft','reviewed','manual_reviewed','failed') NOT NULL DEFAULT 'pending',
  `uploaded_by_user_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_project_opportunity_document_uq` (`opportunity_id`,`document_id`),
  KEY `como_next_project_opportunity_document_status_idx` (`opportunity_id`,`analysis_status`,`created_at`),
  CONSTRAINT `como_next_project_opportunity_document_opportunity_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `como_next_project_opportunities` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_project_opportunity_document_document_fk` FOREIGN KEY (`document_id`) REFERENCES `como_next_documents` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_project_opportunity_document_uploader_fk` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS `como_next_project_document_extractions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `opportunity_id` BIGINT NOT NULL,
  `opportunity_document_id` BIGINT NOT NULL,
  `request_key` VARCHAR(128) NOT NULL,
  `input_sha256` VARCHAR(64) NOT NULL,
  `schema_version` VARCHAR(32) NOT NULL DEFAULT 'v1',
  `model_id` VARCHAR(128) NULL,
  `extraction_status` ENUM('processing','draft','failed') NOT NULL DEFAULT 'processing',
  `proposed_name` VARCHAR(255) NULL,
  `executive_summary` TEXT NULL,
  `facts_json` LONGTEXT NULL,
  `conflicts_json` LONGTEXT NULL,
  `missing_requirements_json` LONGTEXT NULL,
  `raw_text_sha256` VARCHAR(64) NULL,
  `raw_text_length` INT NOT NULL DEFAULT 0,
  `error_message` TEXT NULL,
  `requested_by_user_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_project_document_extraction_request_uq` (`request_key`),
  KEY `como_next_project_document_extraction_opportunity_idx` (`opportunity_id`,`extraction_status`,`created_at`),
  CONSTRAINT `como_next_project_document_extraction_opportunity_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `como_next_project_opportunities` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_project_document_extraction_document_fk` FOREIGN KEY (`opportunity_document_id`) REFERENCES `como_next_project_opportunity_documents` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_project_document_extraction_requester_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS `como_next_project_opportunity_facts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `opportunity_id` BIGINT NOT NULL,
  `field_key` VARCHAR(80) NOT NULL,
  `field_label` VARCHAR(255) NOT NULL,
  `current_value` TEXT NULL,
  `value_type` ENUM('text','number','date') NOT NULL DEFAULT 'text',
  `source_extraction_id` BIGINT NULL,
  `source_document_id` BIGINT NULL,
  `source_excerpt` TEXT NULL,
  `confidence` ENUM('high','medium','low') NULL,
  `review_status` ENUM('proposed','approved','edited','rejected','conflict') NOT NULL DEFAULT 'proposed',
  `review_note` TEXT NULL,
  `reviewed_by_user_id` INT NULL,
  `reviewed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_project_opportunity_fact_uq` (`opportunity_id`,`field_key`),
  KEY `como_next_project_opportunity_fact_review_idx` (`opportunity_id`,`review_status`,`updated_at`),
  CONSTRAINT `como_next_project_opportunity_fact_opportunity_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `como_next_project_opportunities` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_project_opportunity_fact_extraction_fk` FOREIGN KEY (`source_extraction_id`) REFERENCES `como_next_project_document_extractions` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_project_opportunity_fact_document_fk` FOREIGN KEY (`source_document_id`) REFERENCES `como_next_documents` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_project_opportunity_fact_reviewer_fk` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS `como_next_project_opportunity_events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `opportunity_id` BIGINT NOT NULL,
  `sequence_no` INT NOT NULL,
  `actor_type` ENUM('human','manus','system') NOT NULL DEFAULT 'human',
  `actor_user_id` INT NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `summary` VARCHAR(1000) NOT NULL,
  `payload_json` TEXT NULL,
  `idempotency_key` VARCHAR(128) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `como_next_project_opportunity_event_sequence_uq` (`opportunity_id`,`sequence_no`),
  UNIQUE KEY `como_next_project_opportunity_event_idempotency_uq` (`idempotency_key`),
  KEY `como_next_project_opportunity_event_time_idx` (`opportunity_id`,`created_at`),
  CONSTRAINT `como_next_project_opportunity_event_opportunity_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `como_next_project_opportunities` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `como_next_project_opportunity_event_actor_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
);
