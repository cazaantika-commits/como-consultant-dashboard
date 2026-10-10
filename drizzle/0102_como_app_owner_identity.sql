-- Additive owner identity binding only. Full generation paused on unrelated
-- legacy cpa_projects rename prompts; no legacy migration was applied.
CREATE TABLE IF NOT EXISTS como_app_owner_identity (
  id INT NOT NULL PRIMARY KEY,
  user_id INT NOT NULL,
  open_id VARCHAR(64) NOT NULL,
  is_active INT NOT NULL DEFAULT 1,
  evidence_reference TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX como_app_owner_identity_user_uq (user_id),
  UNIQUE INDEX como_app_owner_identity_open_id_uq (open_id),
  CONSTRAINT como_app_owner_identity_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);
