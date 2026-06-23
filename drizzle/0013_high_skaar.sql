CREATE TABLE `consultantProposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`consultantId` int,
	`projectId` int,
	`title` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`aiSummary` text,
	`aiKeyPoints` text,
	`aiStrengths` text,
	`aiWeaknesses` text,
	`aiRecommendation` text,
	`aiScore` int,
	`extractedText` text,
	`analysisStatus` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`analysisError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultantProposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeBase` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`knowledgeType` enum('decision','evaluation','pattern','insight','lesson') NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`summary` text,
	`tags` text,
	`relatedProjectId` int,
	`relatedConsultantId` int,
	`relatedAgentAssignmentId` int,
	`sourceAgent` varchar(50),
	`importance` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`viewCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledgeBase_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposalComparisons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`title` varchar(500) NOT NULL,
	`proposalIds` text NOT NULL,
	`comparisonResult` text,
	`aiRecommendation` text,
	`winnerProposalId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proposalComparisons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `consultantProposals` ADD CONSTRAINT `consultantProposals_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consultantProposals` ADD CONSTRAINT `consultantProposals_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledgeBase` ADD CONSTRAINT `knowledgeBase_relatedProjectId_projects_id_fk` FOREIGN KEY (`relatedProjectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledgeBase` ADD CONSTRAINT `knowledgeBase_relatedConsultantId_consultants_id_fk` FOREIGN KEY (`relatedConsultantId`) REFERENCES `consultants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledgeBase` ADD CONSTRAINT `knowledgeBase_relatedAgentAssignmentId_agentAssignments_id_fk` FOREIGN KEY (`relatedAgentAssignmentId`) REFERENCES `agentAssignments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proposalComparisons` ADD CONSTRAINT `proposalComparisons_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proposalComparisons` ADD CONSTRAINT `proposalComparisons_winnerProposalId_consultantProposals_id_fk` FOREIGN KEY (`winnerProposalId`) REFERENCES `consultantProposals`(`id`) ON DELETE no action ON UPDATE no action;