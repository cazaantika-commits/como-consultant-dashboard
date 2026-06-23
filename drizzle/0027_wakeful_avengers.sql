CREATE TABLE `projectKpis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(500) NOT NULL,
	`nameAr` varchar(500),
	`description` text,
	`kpiCategory` enum('financial','timeline','quality','safety','sales','customer','operational') NOT NULL DEFAULT 'operational',
	`targetValue` decimal(15,2),
	`currentValue` decimal(15,2),
	`unit` varchar(50),
	`kpiTrend` enum('up','down','stable','na') NOT NULL DEFAULT 'na',
	`kpiStatus` enum('on_track','at_risk','off_track','achieved','not_started') NOT NULL DEFAULT 'not_started',
	`lastUpdatedBy` varchar(255),
	`notes` text,
	`createdByMemberId` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectKpis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectMilestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`titleAr` varchar(500),
	`description` text,
	`milestoneCategory` enum('planning','design','permits','construction','handover','sales','other') NOT NULL DEFAULT 'other',
	`plannedStartDate` varchar(50),
	`plannedEndDate` varchar(50),
	`actualStartDate` varchar(50),
	`actualEndDate` varchar(50),
	`progressPercent` int NOT NULL DEFAULT 0,
	`milestoneStatus` enum('not_started','in_progress','delayed','completed','on_hold','cancelled') NOT NULL DEFAULT 'not_started',
	`milestonePriority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`sortOrder` int NOT NULL DEFAULT 0,
	`assignedTo` varchar(255),
	`notes` text,
	`createdByMemberId` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectMilestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectKpis` ADD CONSTRAINT `projectKpis_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectMilestones` ADD CONSTRAINT `projectMilestones_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;