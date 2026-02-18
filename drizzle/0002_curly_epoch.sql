CREATE TABLE `consultantNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultantId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`content` text NOT NULL,
	`category` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultantNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultantProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultantId` int NOT NULL,
	`companyNameAr` varchar(255),
	`founded` varchar(50),
	`headquarters` varchar(255),
	`website` varchar(500),
	`employeeCount` varchar(100),
	`specializations` text,
	`keyProjects` text,
	`certifications` text,
	`overview` text,
	`strengths` text,
	`weaknesses` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultantProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `consultantProfiles_consultantId_unique` UNIQUE(`consultantId`)
);
--> statement-breakpoint
ALTER TABLE `consultantNotes` ADD CONSTRAINT `consultantNotes_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consultantNotes` ADD CONSTRAINT `consultantNotes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consultantProfiles` ADD CONSTRAINT `consultantProfiles_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE cascade ON UPDATE no action;