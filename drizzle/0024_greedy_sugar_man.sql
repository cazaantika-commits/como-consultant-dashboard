CREATE TABLE `sent_emails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`toEmail` varchar(320) NOT NULL,
	`toName` varchar(255),
	`subject` varchar(500) NOT NULL,
	`body` longtext NOT NULL,
	`inReplyTo` varchar(500),
	`originalEmailUid` int,
	`cc` varchar(1000),
	`status` enum('sent','failed','pending') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`sentBy` varchar(50) NOT NULL DEFAULT 'salwa',
	`agentName` varchar(50) DEFAULT 'salwa',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sent_emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sent_emails` ADD CONSTRAINT `sent_emails_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;