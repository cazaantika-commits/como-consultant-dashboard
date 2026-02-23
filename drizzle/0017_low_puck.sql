CREATE TABLE `oauthTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(50) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` timestamp,
	`scope` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oauthTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauthTokens_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `oauthTokens` ADD CONSTRAINT `oauthTokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;