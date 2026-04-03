ALTER TABLE `payment_requests` ADD `is_archived` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD `archived_at` timestamp;