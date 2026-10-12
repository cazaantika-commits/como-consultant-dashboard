-- COMO Manus durable dispatch. Additive only; applying this file creates no job,
-- sends no event, and stores no endpoint. Operators may later configure singleton id=1.
CREATE TABLE IF NOT EXISTS `como_manus_dispatch_config` (
  `id` TINYINT NOT NULL PRIMARY KEY,
  `webhook_url` TEXT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `como_manus_dispatch_config_singleton_ck` CHECK (`id` = 1)
);

CREATE TABLE IF NOT EXISTS `como_manus_dispatches` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `directive_id` BIGINT NOT NULL,
  `state` ENUM('queued','delivered','running','completed','failed','delivery_unknown') NOT NULL DEFAULT 'queued',
  `queued_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `delivered_at` TIMESTAMP NULL,
  `started_at` TIMESTAMP NULL,
  `last_progress_at` TIMESTAMP NULL,
  `completed_at` TIMESTAMP NULL,
  `delivery_attempts` INT NOT NULL DEFAULT 0,
  `error` TEXT NULL,
  `claim_token` VARCHAR(96) NULL,
  `target_metadata` LONGTEXT NOT NULL,
  `execution_summary` LONGTEXT NULL,
  `result_json` LONGTEXT NULL,
  `update_id` BIGINT NULL,
  `communication_draft_id` BIGINT NULL,
  `mailbox_draft_ref` VARCHAR(500) NULL,
  `work_product_id` BIGINT NULL,
  `next_action_id` BIGINT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX `como_manus_dispatch_directive_uq` (`directive_id`),
  INDEX `como_manus_dispatch_state_queue_idx` (`state`, `queued_at`),
  INDEX `como_manus_dispatch_progress_idx` (`last_progress_at`),
  CONSTRAINT `como_manus_dispatch_directive_fk`
    FOREIGN KEY (`directive_id`) REFERENCES `como_next_staged_directives` (`id`) ON DELETE RESTRICT
);
