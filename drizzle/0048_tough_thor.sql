ALTER TABLE `competition_pricing` ADD `approvedRevenue` bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE `projects` ADD `separationFeePerSqft` decimal(10,2);--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `separationFeePerM2`;