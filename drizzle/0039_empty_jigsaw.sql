CREATE TABLE `cf_cost_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cfProjectId` int NOT NULL,
	`name` varchar(500) NOT NULL,
	`category` enum('land','consultant_design','authority_fees','contractor','supervision','marketing_sales','developer_fee','contingency','other') NOT NULL,
	`totalAmount` bigint NOT NULL,
	`paymentType` enum('lump_sum','milestone','monthly_fixed','progress_based','sales_linked') NOT NULL,
	`paymentParams` text,
	`phaseAllocation` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cf_cost_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cf_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cfProjectId` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`category` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cf_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cf_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`userId` int NOT NULL,
	`name` varchar(500) NOT NULL,
	`startDate` varchar(20) NOT NULL,
	`designApprovalMonths` int NOT NULL DEFAULT 6,
	`reraSetupMonths` int NOT NULL DEFAULT 3,
	`constructionMonths` int NOT NULL DEFAULT 24,
	`handoverMonths` int NOT NULL DEFAULT 3,
	`salesEnabled` boolean NOT NULL DEFAULT false,
	`salesStartMonth` int,
	`salesVelocityUnits` int,
	`salesVelocityAed` bigint,
	`salesVelocityType` enum('units','aed') DEFAULT 'aed',
	`totalSalesRevenue` bigint,
	`buyerPlanBookingPct` decimal(5,2) DEFAULT '20',
	`buyerPlanConstructionPct` decimal(5,2) DEFAULT '30',
	`buyerPlanHandoverPct` decimal(5,2) DEFAULT '50',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cf_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cf_scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cfProjectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`salesStartMonthDelta` int DEFAULT 0,
	`constructionDurationDelta` int DEFAULT 0,
	`mobilizationPctOverride` decimal(5,2),
	`buyerPlanBookingPct` decimal(5,2),
	`buyerPlanConstructionPct` decimal(5,2),
	`buyerPlanHandoverPct` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cf_scenarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cf_cost_items` ADD CONSTRAINT `cf_cost_items_cfProjectId_cf_projects_id_fk` FOREIGN KEY (`cfProjectId`) REFERENCES `cf_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cf_files` ADD CONSTRAINT `cf_files_cfProjectId_cf_projects_id_fk` FOREIGN KEY (`cfProjectId`) REFERENCES `cf_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cf_projects` ADD CONSTRAINT `cf_projects_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cf_projects` ADD CONSTRAINT `cf_projects_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cf_scenarios` ADD CONSTRAINT `cf_scenarios_cfProjectId_cf_projects_id_fk` FOREIGN KEY (`cfProjectId`) REFERENCES `cf_projects`(`id`) ON DELETE cascade ON UPDATE no action;