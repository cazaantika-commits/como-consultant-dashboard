ALTER TABLE `feasibilityStudies` ADD `projectId` int;--> statement-breakpoint
ALTER TABLE `feasibilityStudies` ADD `scenarioName` varchar(255);--> statement-breakpoint
ALTER TABLE `feasibilityStudies` ADD `aiSummary` text;--> statement-breakpoint
ALTER TABLE `feasibilityStudies` ADD `marketAnalysis` text;--> statement-breakpoint
ALTER TABLE `feasibilityStudies` ADD `competitorAnalysis` text;--> statement-breakpoint
ALTER TABLE `feasibilityStudies` ADD `priceRecommendation` text;--> statement-breakpoint
ALTER TABLE `feasibilityStudies` ADD CONSTRAINT `feasibilityStudies_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;