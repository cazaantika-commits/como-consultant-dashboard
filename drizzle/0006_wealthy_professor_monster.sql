CREATE TABLE `committeeDecisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`selectedConsultantId` int,
	`decisionType` varchar(50),
	`negotiationTarget` text,
	`committeeNotes` text,
	`aiAnalysis` text,
	`aiRecommendation` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `committeeDecisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultantDetails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultantId` int NOT NULL,
	`phone2` varchar(20),
	`location` varchar(255),
	`classification` varchar(100),
	`weight` varchar(100),
	`yearsOfExperience` int,
	`numberOfEngineers` int,
	`notableClients` text,
	`contactPerson` varchar(255),
	`contactPersonPhone` varchar(20),
	`contactPersonEmail` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultantDetails_id` PRIMARY KEY(`id`),
	CONSTRAINT `consultantDetails_consultantId_unique` UNIQUE(`consultantId`)
);
--> statement-breakpoint
CREATE TABLE `evaluatorScores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`consultantId` int NOT NULL,
	`criterionId` int NOT NULL,
	`evaluatorName` varchar(100) NOT NULL,
	`score` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evaluatorScores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD CONSTRAINT `committeeDecisions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD CONSTRAINT `committeeDecisions_selectedConsultantId_consultants_id_fk` FOREIGN KEY (`selectedConsultantId`) REFERENCES `consultants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consultantDetails` ADD CONSTRAINT `consultantDetails_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluatorScores` ADD CONSTRAINT `evaluatorScores_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluatorScores` ADD CONSTRAINT `evaluatorScores_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE cascade ON UPDATE no action;