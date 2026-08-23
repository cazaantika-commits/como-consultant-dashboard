ALTER TABLE `project_market_evidence`
	ADD `transaction_purpose` enum('sale','rent') NOT NULL DEFAULT 'sale',
	ADD `product_form` enum('apartment','villa','townhouse','plot','retail_unit','office_unit','mixed_use_unit','other') NOT NULL DEFAULT 'other',
	ADD `development_status` enum('offplan','ready','any') NOT NULL DEFAULT 'any';
--> statement-breakpoint
CREATE TABLE `project_market_search_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`user_id` int NOT NULL,
	`transaction_purpose` enum('sale','rent') NOT NULL DEFAULT 'sale',
	`evidence_mode` enum('active_listing','closed_transaction','new_project','market_report','mixed') NOT NULL DEFAULT 'closed_transaction',
	`asset_class` enum('residential','retail','office','mixed_use','land','other') NOT NULL,
	`product_form` enum('apartment','villa','townhouse','plot','retail_unit','office_unit','mixed_use_unit','other') NOT NULL,
	`unit_types_json` text,
	`primary_community` varchar(255) NOT NULL,
	`alternative_communities_json` text,
	`development_status` enum('offplan','ready','any') NOT NULL DEFAULT 'any',
	`min_area_sqft` decimal(14,2),
	`max_area_sqft` decimal(14,2),
	`min_price_per_sqft` decimal(14,2),
	`max_price_per_sqft` decimal(14,2),
	`transaction_date_from` varchar(10),
	`transaction_date_to` varchar(10),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_market_search_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `market_profile_project` ON `project_market_search_profiles` (`project_id`);
--> statement-breakpoint
ALTER TABLE `project_market_search_profiles` ADD CONSTRAINT `project_market_search_profiles_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `project_market_search_profiles` ADD CONSTRAINT `project_market_search_profiles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
