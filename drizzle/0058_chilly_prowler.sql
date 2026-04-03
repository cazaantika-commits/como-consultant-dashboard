CREATE TABLE `general_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`request_number` varchar(50) NOT NULL,
	`request_type` enum('proposal_approval','contract_approval','meeting_request','zoom_meeting','inquiry','decision_request','other') NOT NULL,
	`subject` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`project_name` varchar(255),
	`related_party` varchar(255),
	`attachment_url` text,
	`attachment_name` varchar(255),
	`proposed_date` varchar(100),
	`gr_status` enum('new','pending_wael','pending_sheikh','approved','rejected','needs_revision') NOT NULL DEFAULT 'new',
	`wael_reviewed_at` timestamp,
	`gr_wael_decision` enum('approved','rejected','needs_revision'),
	`wael_notes` text,
	`sheikh_reviewed_at` timestamp,
	`gr_sheikh_decision` enum('approved','rejected','needs_revision'),
	`sheikh_notes` text,
	`finance_email_sent_at` timestamp,
	`submitted_by` int,
	`is_archived` tinyint NOT NULL DEFAULT 0,
	`archived_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE `general_requests` ADD CONSTRAINT `general_requests_submitted_by_users_id_fk` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;