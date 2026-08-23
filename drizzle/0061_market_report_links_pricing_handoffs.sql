CREATE TABLE `project_market_report_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`report_id` int NOT NULL,
	`user_id` int NOT NULL,
	`relevance_note` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `project_market_report_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `market_report_link_project` ON `project_market_report_links` (`project_id`);
--> statement-breakpoint
CREATE INDEX `market_report_link_report` ON `project_market_report_links` (`report_id`);
--> statement-breakpoint
ALTER TABLE `project_market_report_links` ADD CONSTRAINT `mr_link_project_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `project_market_report_links` ADD CONSTRAINT `mr_link_report_fk` FOREIGN KEY (`report_id`) REFERENCES `market_reports`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `project_market_report_links` ADD CONSTRAINT `mr_link_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE `market_pricing_handoffs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`approval_id` int NOT NULL,
	`user_id` int NOT NULL,
	`pricing_snapshot_json` longtext NOT NULL,
	`handed_off_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `market_pricing_handoffs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `market_pricing_handoff_project` ON `market_pricing_handoffs` (`project_id`);
--> statement-breakpoint
CREATE INDEX `market_pricing_handoff_approval` ON `market_pricing_handoffs` (`approval_id`);
--> statement-breakpoint
ALTER TABLE `market_pricing_handoffs` ADD CONSTRAINT `mph_project_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `market_pricing_handoffs` ADD CONSTRAINT `mph_approval_fk` FOREIGN KEY (`approval_id`) REFERENCES `market_decision_approvals`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `market_pricing_handoffs` ADD CONSTRAINT `mph_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
