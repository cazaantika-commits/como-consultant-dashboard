CREATE TABLE `taskExecutionLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int,
	`meetingId` int,
	`agent` varchar(50) NOT NULL,
	`taskTitle` varchar(500) NOT NULL,
	`actionPlanJson` text,
	`totalSteps` int NOT NULL DEFAULT 0,
	`completedSteps` int NOT NULL DEFAULT 0,
	`executionStatus` enum('planning','executing','verifying','completed','partial','failed','retrying') NOT NULL DEFAULT 'planning',
	`attempt` int NOT NULL DEFAULT 1,
	`maxAttempts` int NOT NULL DEFAULT 2,
	`toolsUsedJson` text,
	`toolCallCount` int NOT NULL DEFAULT 0,
	`writeToolCount` int NOT NULL DEFAULT 0,
	`stepResultsJson` text,
	`verified` int NOT NULL DEFAULT 0,
	`verificationDetails` text,
	`dataChangesJson` text,
	`agentResponse` text,
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskExecutionLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `taskExecutionLogs` ADD CONSTRAINT `taskExecutionLogs_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskExecutionLogs` ADD CONSTRAINT `taskExecutionLogs_meetingId_meetings_id_fk` FOREIGN KEY (`meetingId`) REFERENCES `meetings`(`id`) ON DELETE no action ON UPDATE no action;