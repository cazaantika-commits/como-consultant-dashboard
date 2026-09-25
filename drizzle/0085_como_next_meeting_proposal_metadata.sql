-- COMO Next meeting-proposal review metadata
-- Additive columns on the newly introduced COMO Next proposal table only.

ALTER TABLE `como_next_meeting_proposals`
  ADD COLUMN `priority` enum('critical','high','normal') NOT NULL DEFAULT 'normal' AFTER `audience`;

ALTER TABLE `como_next_meeting_proposals`
  ADD COLUMN `is_required` tinyint NOT NULL DEFAULT 0 AFTER `priority`;
