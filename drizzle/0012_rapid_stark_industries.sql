CREATE TABLE `taskCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`color` varchar(50) DEFAULT '#8b5cf6',
	`icon` varchar(50),
	`isActive` enum('true','false') NOT NULL DEFAULT 'true',
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `taskCategories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `taskProjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`color` varchar(50) DEFAULT '#6366f1',
	`icon` varchar(50),
	`isActive` enum('true','false') NOT NULL DEFAULT 'true',
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskProjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `taskProjects_name_unique` UNIQUE(`name`)
);
