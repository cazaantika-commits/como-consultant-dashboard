CREATE TABLE `designsAndPermits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`architecturalDesignStatus` varchar(100),
	`architecturalDesignDate` varchar(50),
	`architecturalDesignFileUrl` varchar(1000),
	`architecturalDesignFileKey` varchar(500),
	`engineeringDesignStatus` varchar(100),
	`engineeringDesignDate` varchar(50),
	`engineeringDesignFileUrl` varchar(1000),
	`engineeringDesignFileKey` varchar(500),
	`buildingPermitStatus` varchar(100),
	`buildingPermitNumber` varchar(100),
	`buildingPermitDate` varchar(50),
	`buildingPermitExpiryDate` varchar(50),
	`buildingPermitFileUrl` varchar(1000),
	`buildingPermitFileKey` varchar(500),
	`municipalityDesignApprovalStatus` varchar(100),
	`municipalityDesignApprovalDate` varchar(50),
	`designRequirements` text,
	`buildingConditions` text,
	`designConsultationFees` int,
	`buildingPermitFees` int,
	`municipalityDesignReviewFees` int,
	`designNotes` text,
	`consultantAnalysis` text,
	`completionStatus` varchar(100) DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `designsAndPermits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `legalSetupRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`titleDeedStatus` varchar(100),
	`titleDeedNumber` varchar(100),
	`titleDeedDate` varchar(50),
	`ddaRegistrationStatus` varchar(100),
	`ddaRegistrationNumber` varchar(100),
	`ddaRegistrationDate` varchar(50),
	`municipalityApprovalStatus` varchar(100),
	`municipalityApprovalNumber` varchar(100),
	`municipalityApprovalDate` varchar(50),
	`legalObligations` text,
	`restrictionsAndConditions` text,
	`registrationFees` int,
	`legalConsultationFees` int,
	`governmentFeesTotal` int,
	`legalNotes` text,
	`farouqAnalysis` text,
	`completionStatus` varchar(100) DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `legalSetupRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `designsAndPermits` ADD CONSTRAINT `designsAndPermits_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `designsAndPermits` ADD CONSTRAINT `designsAndPermits_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legalSetupRecords` ADD CONSTRAINT `legalSetupRecords_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legalSetupRecords` ADD CONSTRAINT `legalSetupRecords_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;