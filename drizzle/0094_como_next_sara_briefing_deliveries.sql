-- COMO Next: Sara briefing delivery ledger.
-- Additive only. Stores delivery state and fingerprints; no operational or financial data is modified.

CREATE TABLE como_next_sara_briefing_deliveries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  member_id VARCHAR(64) NOT NULL,
  briefing_kind ENUM('full','today','changes') NOT NULL,
  period_kind ENUM('morning','day','evening','manual') NOT NULL,
  delivery_status ENUM('started','completed','interrupted') NOT NULL DEFAULT 'started',
  content_sha256 VARCHAR(64) NOT NULL,
  source_cursor_at TIMESTAMP NULL,
  source_cursor_id BIGINT NULL,
  item_count INT NOT NULL DEFAULT 0,
  session_id VARCHAR(200) NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT como_next_sara_delivery_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX como_next_sara_delivery_member_time_idx (member_id, started_at),
  INDEX como_next_sara_delivery_user_status_idx (user_id, delivery_status, started_at)
);
