CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameEn` varchar(100),
	`role` varchar(255) NOT NULL,
	`roleEn` varchar(255),
	`description` text,
	`color` varchar(20),
	`icon` varchar(50),
	`agentStatus` enum('active','inactive','maintenance') NOT NULL DEFAULT 'active',
	`capabilities` text,
	`isCoordinator` int NOT NULL DEFAULT 0,
	`gender` enum('male','female') NOT NULL DEFAULT 'male',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agents_name_unique` UNIQUE(`name`)
);
