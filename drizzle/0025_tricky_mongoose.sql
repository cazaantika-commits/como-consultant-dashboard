CREATE TABLE `email_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`email_uid` int NOT NULL,
	`from_email` varchar(255) NOT NULL,
	`from_name` varchar(255),
	`subject` varchar(500) NOT NULL,
	`preview` text,
	`received_at` bigint NOT NULL,
	`is_read` int DEFAULT 0,
	`is_dismissed` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_notifications_id` PRIMARY KEY(`id`)
);
