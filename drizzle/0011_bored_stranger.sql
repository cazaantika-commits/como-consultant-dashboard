CREATE TABLE `agentAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agent` varchar(50) NOT NULL,
	`userMessage` text NOT NULL,
	`toolUsed` varchar(100) NOT NULL,
	`toolArgs` text,
	`toolResult` text,
	`assignmentStatus` enum('executing','completed','failed') NOT NULL DEFAULT 'executing',
	`agentResponse` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `agentAssignments_id` PRIMARY KEY(`id`)
);
