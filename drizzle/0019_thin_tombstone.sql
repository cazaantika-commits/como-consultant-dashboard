CREATE TABLE `contractTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`code` varchar(50),
	`category` varchar(100),
	`description` text,
	`isDefault` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contractTypes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectContracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`contractTypeId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`contractNumber` varchar(100),
	`partyA` varchar(255),
	`partyB` varchar(255),
	`contractValue` decimal(15,2),
	`currency` varchar(10) DEFAULT 'AED',
	`signDate` varchar(50),
	`startDate` varchar(50),
	`endDate` varchar(50),
	`fileUrl` varchar(1000),
	`fileKey` varchar(500),
	`fileName` varchar(255),
	`driveFileId` varchar(100),
	`contractStatus` enum('draft','active','expired','terminated','renewed','pending') NOT NULL DEFAULT 'draft',
	`contractAnalysisStatus` enum('not_analyzed','analyzing','completed','failed') NOT NULL DEFAULT 'not_analyzed',
	`analysisSummary` text,
	`analysisKeyDates` text,
	`analysisPenalties` text,
	`analysisObligations` text,
	`analysisRisks` text,
	`analysisParties` text,
	`analysisTermination` text,
	`analysisNotes` text,
	`analysisFullJson` text,
	`analyzedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectContracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contractTypes` ADD CONSTRAINT `contractTypes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectContracts` ADD CONSTRAINT `projectContracts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectContracts` ADD CONSTRAINT `projectContracts_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectContracts` ADD CONSTRAINT `projectContracts_contractTypeId_contractTypes_id_fk` FOREIGN KEY (`contractTypeId`) REFERENCES `contractTypes`(`id`) ON DELETE no action ON UPDATE no action;