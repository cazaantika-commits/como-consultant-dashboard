CREATE TABLE `stage_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stageItemId` int NOT NULL,
	`projectId` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stage_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stage_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`phaseNumber` int NOT NULL,
	`sectionKey` varchar(20) NOT NULL,
	`itemIndex` int NOT NULL,
	`title` text NOT NULL,
	`status` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
	`isCustom` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stage_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `stage_documents` ADD CONSTRAINT `stage_documents_stageItemId_stage_items_id_fk` FOREIGN KEY (`stageItemId`) REFERENCES `stage_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stage_documents` ADD CONSTRAINT `stage_documents_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stage_items` ADD CONSTRAINT `stage_items_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;