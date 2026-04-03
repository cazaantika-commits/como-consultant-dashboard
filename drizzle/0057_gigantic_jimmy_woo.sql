ALTER TABLE `payment_requests` MODIFY COLUMN `status` enum('new','pending_wael','pending_sheikh','approved','rejected','needs_revision','disbursed') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `payment_requests` ADD `disbursed_at` timestamp;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD `disbursed_by` int;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD `disbursement_note` text;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_disbursed_by_users_id_fk` FOREIGN KEY (`disbursed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;