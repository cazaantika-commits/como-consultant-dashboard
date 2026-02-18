CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`project` varchar(255) NOT NULL,
	`category` varchar(100),
	`owner` varchar(255) NOT NULL,
	`priority` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`status` enum('new','progress','hold','done','cancelled') NOT NULL DEFAULT 'new',
	`progress` int NOT NULL DEFAULT 0,
	`dueDate` varchar(20),
	`attachment` text,
	`source` enum('manual','agent','command') NOT NULL DEFAULT 'manual',
	`sourceAgent` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
