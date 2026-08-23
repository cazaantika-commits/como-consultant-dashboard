CREATE TABLE `project_market_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`user_id` int NOT NULL,
	`evidence_type` enum('comparable','market_report','transaction','regulatory','assumption','other') NOT NULL,
	`source_type` enum('DLD','market_report','broker','developer','listing_portal','manual','other') NOT NULL,
	`source_name` varchar(255) NOT NULL,
	`source_url` text,
	`source_date` varchar(10),
	`confidence_grade` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`verification_status` enum('draft','verified','excluded') NOT NULL DEFAULT 'draft',
	`market_report_id` int,
	`comparable_name` varchar(255),
	`community` varchar(255),
	`asset_class` enum('residential','retail','office','mixed_use','land','other') NOT NULL DEFAULT 'residential',
	`unit_type` varchar(100),
	`unit_area_sqft` decimal(14,2),
	`price_per_sqft` decimal(14,2),
	`transaction_value` decimal(18,2),
	`payment_plan_summary` text,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_market_evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `market_evidence_project` ON `project_market_evidence` (`project_id`);
--> statement-breakpoint
CREATE INDEX `market_evidence_project_status` ON `project_market_evidence` (`project_id`,`verification_status`);
--> statement-breakpoint
CREATE INDEX `market_evidence_project_source_date` ON `project_market_evidence` (`project_id`,`source_date`);
--> statement-breakpoint
ALTER TABLE `project_market_evidence` ADD CONSTRAINT `project_market_evidence_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `project_market_evidence` ADD CONSTRAINT `project_market_evidence_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE `market_decision_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`user_id` int NOT NULL,
	`decision_status` enum('reviewed','approved','rejected') NOT NULL,
	`decision_snapshot_json` longtext NOT NULL,
	`evidence_snapshot_json` longtext NOT NULL,
	`notes` text,
	`decided_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `market_decision_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `market_decision_approvals_project` ON `market_decision_approvals` (`project_id`,`decided_at`);
--> statement-breakpoint
ALTER TABLE `market_decision_approvals` ADD CONSTRAINT `market_decision_approvals_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `market_decision_approvals` ADD CONSTRAINT `market_decision_approvals_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
