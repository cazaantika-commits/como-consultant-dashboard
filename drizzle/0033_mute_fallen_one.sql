ALTER TABLE `projects` ADD `landPrice` decimal(14,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `agentCommissionLandPct` decimal(5,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `estimatedConstructionPricePerSqft` decimal(14,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `designFeePct` decimal(5,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `supervisionFeePct` decimal(5,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `separationFeePerM2` decimal(10,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `salesCommissionPct` decimal(5,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `marketingPct` decimal(5,2);--> statement-breakpoint
ALTER TABLE `projects` ADD `developerFeePhase1Pct` decimal(5,2) DEFAULT '2';--> statement-breakpoint
ALTER TABLE `projects` ADD `developerFeePhase2Pct` decimal(5,2) DEFAULT '3';