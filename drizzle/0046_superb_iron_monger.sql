CREATE TABLE `project_cash_flow_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`scenario` enum('offplan_escrow','offplan_construction','no_offplan') NOT NULL DEFAULT 'offplan_escrow',
	`item_key` varchar(100) NOT NULL,
	`name_ar` varchar(255) NOT NULL,
	`category` enum('land','design','offplan_reg','construction','marketing_sales','admin','developer_fee','revenue','other') NOT NULL DEFAULT 'other',
	`is_active` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`amount_override` decimal(18,2),
	`distribution_method` enum('lump_sum','equal_spread','custom') NOT NULL DEFAULT 'equal_spread',
	`lump_sum_month` int,
	`start_month` int,
	`end_month` int,
	`custom_json` text,
	`funding_source` enum('investor','escrow') NOT NULL DEFAULT 'investor',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_cash_flow_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `project_cash_flow_settings` ADD CONSTRAINT `project_cash_flow_settings_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pcfs_project_scenario` ON `project_cash_flow_settings` (`project_id`,`scenario`);--> statement-breakpoint
CREATE INDEX `pcfs_item_key` ON `project_cash_flow_settings` (`item_key`);