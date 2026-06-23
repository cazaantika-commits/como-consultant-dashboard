CREATE TABLE `cost_distribution_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`item_key` varchar(100) NOT NULL,
	`name_ar` varchar(255) NOT NULL,
	`name_en` varchar(255),
	`amount_type` enum('fixed','pct_construction','pct_revenue','pct_land') NOT NULL,
	`fixed_amount` decimal(18,2),
	`pct_value` decimal(8,4),
	`source` enum('investor','escrow') NOT NULL,
	`primary_phase` enum('land','design','offplan','construction','handover') NOT NULL,
	`distribution_method` enum('lump_sum','equal_spread','split_ratio','sales_linked','periodic','custom') NOT NULL,
	`relative_month` int DEFAULT 1,
	`split_ratio_json` text,
	`periodic_interval_months` int,
	`periodic_amount` decimal(18,2),
	`custom_json` text,
	`notes` text,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cost_distribution_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cdr_item_key` ON `cost_distribution_rules` (`item_key`);--> statement-breakpoint
CREATE INDEX `cdr_sort_order` ON `cost_distribution_rules` (`sort_order`);