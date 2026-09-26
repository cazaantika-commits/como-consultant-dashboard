-- COMO Next: canonical market-decision governance metadata.
-- Additive only. No financial, cash-flow, contract, or project rows are changed.

ALTER TABLE project_market_search_profiles
  ADD COLUMN profile_version INT NOT NULL DEFAULT 1;

ALTER TABLE project_market_search_profiles
  ADD COLUMN profile_hash VARCHAR(64) NULL;

CREATE UNIQUE INDEX market_profile_project_unique
  ON project_market_search_profiles (project_id);

ALTER TABLE market_decision_approvals
  ADD COLUMN source_schema_version VARCHAR(50) NULL;

ALTER TABLE market_decision_approvals
  ADD COLUMN profile_id INT NULL;

ALTER TABLE market_decision_approvals
  ADD COLUMN profile_version INT NULL;

ALTER TABLE market_decision_approvals
  ADD COLUMN profile_hash VARCHAR(64) NULL;

ALTER TABLE market_decision_approvals
  ADD COLUMN evidence_set_hash VARCHAR(64) NULL;

ALTER TABLE market_decision_approvals
  ADD COLUMN verified_evidence_count INT NULL;

CREATE UNIQUE INDEX market_pricing_handoff_approval_unique
  ON market_pricing_handoffs (approval_id);
