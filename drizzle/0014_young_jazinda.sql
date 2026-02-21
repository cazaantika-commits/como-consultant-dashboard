CREATE TABLE `meetingFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileType` varchar(50) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`extractedText` text,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meetingFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meetingMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingId` int NOT NULL,
	`speakerId` varchar(100) NOT NULL,
	`speakerType` enum('user','agent') NOT NULL,
	`messageText` text NOT NULL,
	`audioUrl` varchar(1000),
	`replyToId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meetingMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meetingParticipants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingId` int NOT NULL,
	`agentId` int NOT NULL,
	`participantRole` enum('participant','observer') NOT NULL DEFAULT 'participant',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meetingParticipants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`topic` text,
	`meetingStatus` enum('preparing','in_progress','completed','cancelled') NOT NULL DEFAULT 'preparing',
	`createdBy` varchar(100) NOT NULL DEFAULT 'user',
	`startedAt` timestamp,
	`endedAt` timestamp,
	`minutesSummary` text,
	`decisionsJson` text,
	`extractedTasksJson` text,
	`knowledgeItemsJson` text,
	`audioRecordingUrl` varchar(1000),
	`fullTranscript` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `meetingFiles` ADD CONSTRAINT `meetingFiles_meetingId_meetings_id_fk` FOREIGN KEY (`meetingId`) REFERENCES `meetings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `meetingMessages` ADD CONSTRAINT `meetingMessages_meetingId_meetings_id_fk` FOREIGN KEY (`meetingId`) REFERENCES `meetings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `meetingParticipants` ADD CONSTRAINT `meetingParticipants_meetingId_meetings_id_fk` FOREIGN KEY (`meetingId`) REFERENCES `meetings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `meetingParticipants` ADD CONSTRAINT `meetingParticipants_agentId_agents_id_fk` FOREIGN KEY (`agentId`) REFERENCES `agents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `meetings` ADD CONSTRAINT `meetings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;