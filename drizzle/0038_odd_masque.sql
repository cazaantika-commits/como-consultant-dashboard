CREATE TABLE `evaluationApprovals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`evaluatorName` varchar(100) NOT NULL,
	`isApproved` int NOT NULL DEFAULT 0,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evaluationApprovals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `evaluationApprovals` ADD CONSTRAINT `evaluationApprovals_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;