CREATE TABLE `commandCenterChat` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` varchar(50) NOT NULL,
	`chatRole` enum('member','salwa') NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commandCenterChat_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commandCenterEvaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(100) NOT NULL,
	`projectId` int NOT NULL,
	`consultantId` int NOT NULL,
	`memberId` varchar(50) NOT NULL,
	`scoresJson` text NOT NULL,
	`totalScore` decimal(5,2),
	`notes` text,
	`isComplete` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commandCenterEvaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commandCenterItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bubbleType` enum('reports','requests','meeting_minutes','evaluations','announcements') NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` longtext,
	`summary` text,
	`itemPriority` enum('normal','important','urgent') NOT NULL DEFAULT 'normal',
	`itemStatus` enum('active','archived','pending_response','resolved') NOT NULL DEFAULT 'active',
	`createdByMemberId` varchar(50) NOT NULL,
	`targetMemberIds` text,
	`requiresResponse` int NOT NULL DEFAULT 0,
	`responseDeadline` timestamp,
	`attachments` text,
	`projectId` int,
	`consultantId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commandCenterItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commandCenterMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameAr` varchar(255) NOT NULL,
	`memberRole` enum('admin','executive') NOT NULL,
	`memberId` varchar(50) NOT NULL,
	`accessToken` varchar(128) NOT NULL,
	`greeting` varchar(500),
	`avatarUrl` varchar(1000),
	`isActive` int NOT NULL DEFAULT 1,
	`lastAccessAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commandCenterMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `commandCenterMembers_memberId_unique` UNIQUE(`memberId`),
	CONSTRAINT `commandCenterMembers_accessToken_unique` UNIQUE(`accessToken`)
);
--> statement-breakpoint
CREATE TABLE `commandCenterNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` varchar(50) NOT NULL,
	`title` varchar(500) NOT NULL,
	`message` text,
	`notificationType` enum('new_item','response','evaluation','urgent','system') NOT NULL DEFAULT 'system',
	`relatedItemId` int,
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commandCenterNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commandCenterResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`memberId` varchar(50) NOT NULL,
	`responseText` text NOT NULL,
	`responseType` enum('approval','rejection','comment','question') NOT NULL DEFAULT 'comment',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commandCenterResponses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evaluationSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(100) NOT NULL,
	`projectId` int NOT NULL,
	`consultantId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`isRevealed` int NOT NULL DEFAULT 0,
	`completedCount` int NOT NULL DEFAULT 0,
	`requiredCount` int NOT NULL DEFAULT 3,
	`createdByMemberId` varchar(50) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evaluationSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `evaluationSessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
ALTER TABLE `commandCenterEvaluations` ADD CONSTRAINT `commandCenterEvaluations_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commandCenterEvaluations` ADD CONSTRAINT `commandCenterEvaluations_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commandCenterItems` ADD CONSTRAINT `commandCenterItems_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commandCenterItems` ADD CONSTRAINT `commandCenterItems_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commandCenterResponses` ADD CONSTRAINT `commandCenterResponses_itemId_commandCenterItems_id_fk` FOREIGN KEY (`itemId`) REFERENCES `commandCenterItems`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluationSessions` ADD CONSTRAINT `evaluationSessions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluationSessions` ADD CONSTRAINT `evaluationSessions_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE no action ON UPDATE no action;