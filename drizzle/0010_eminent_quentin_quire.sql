CREATE TABLE `modelUsageLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agent` varchar(50) NOT NULL,
	`model` varchar(100) NOT NULL,
	`responseTimeMs` int NOT NULL,
	`success` enum('true','false') NOT NULL DEFAULT 'true',
	`isFallback` enum('true','false') NOT NULL DEFAULT 'false',
	`inputTokens` int,
	`outputTokens` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `modelUsageLog_id` PRIMARY KEY(`id`)
);
