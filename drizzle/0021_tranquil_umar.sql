CREATE TABLE `aiAdvisoryScores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`consultantId` int NOT NULL,
	`criterionId` int NOT NULL,
	`suggestedScore` int,
	`reasoning` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiAdvisoryScores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD `decisionBasis` varchar(100);--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD `justification` text;--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD `negotiationConditions` text;--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD `aiPostDecisionAnalysis` text;--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD `isConfirmed` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD `confirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD `confirmedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `aiAdvisoryScores` ADD CONSTRAINT `aiAdvisoryScores_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `aiAdvisoryScores` ADD CONSTRAINT `aiAdvisoryScores_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE cascade ON UPDATE no action;