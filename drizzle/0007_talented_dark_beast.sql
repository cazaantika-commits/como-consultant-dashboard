CREATE TABLE `consultantPortfolio` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultantId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`imageUrl` varchar(500),
	`projectType` varchar(100),
	`location` varchar(255),
	`year` varchar(10),
	`area` varchar(100),
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultantPortfolio_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `consultantPortfolio` ADD CONSTRAINT `consultantPortfolio_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE cascade ON UPDATE no action;