CREATE TABLE `actual_outcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`predictionId` int,
	`outcome_type` enum('price_per_sqft','total_revenue','absorption_rate','sell_out_months','demand_units','construction_cost','roi','irr') NOT NULL,
	`actualValue` decimal(15,2) NOT NULL,
	`actualUnit` varchar(50),
	`recordedDate` timestamp NOT NULL,
	`source` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `actual_outcomes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultants_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryName` varchar(100) NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `consultants_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultants_registry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`category` varchar(100) NOT NULL,
	`contactPerson` varchar(255),
	`mobileNumber` varchar(20),
	`emailAddress` varchar(255),
	`website` varchar(255),
	`status` enum('quoted_only','under_review','appointed','not_selected') NOT NULL DEFAULT 'quoted_only',
	`notes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultants_registry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultants_registry_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultantId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(500) NOT NULL,
	`fileType` varchar(50),
	`fileSizeBytes` int,
	`uploadedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `consultants_registry_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_building_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`label` varchar(100) NOT NULL,
	`buaMinSqft` decimal(12,2),
	`buaMaxSqft` decimal(12,2),
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_building_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_consultant_scope_coverage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectConsultantId` int NOT NULL,
	`scopeItemId` int NOT NULL,
	`cpa_csc_status` enum('INCLUDED','EXCLUDED','NOT_MENTIONED') NOT NULL DEFAULT 'NOT_MENTIONED',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_consultant_scope_coverage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_consultant_supervision_team` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectConsultantId` int NOT NULL,
	`supervisionRoleId` int NOT NULL,
	`proposedAllocationPct` decimal(5,2) NOT NULL DEFAULT '0',
	`proposedMonthlyRate` decimal(12,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_consultant_supervision_team_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_consultants_master` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`legalName` varchar(300) NOT NULL,
	`tradeName` varchar(300),
	`registrationNo` varchar(100),
	`specialties` text,
	`contactEmail` varchar(200),
	`contactPhone` varchar(50),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_consultants_master_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_evaluation_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectConsultantId` int NOT NULL,
	`quotedDesignFee` decimal(15,2),
	`designScopeGapCost` decimal(15,2),
	`trueDesignFee` decimal(15,2),
	`quotedSupervisionFee` decimal(15,2),
	`supervisionGapCost` decimal(15,2),
	`adjustedSupervisionFee` decimal(15,2),
	`totalTrueCost` decimal(15,2),
	`evalRank` int,
	`canRank` tinyint NOT NULL DEFAULT 1,
	`calculationNotes` longtext,
	`calculatedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_evaluation_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_project_consultants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cpaProjectId` int NOT NULL,
	`consultantId` int NOT NULL,
	`proposalDate` varchar(20),
	`proposalReference` varchar(200),
	`designFeeAmount` decimal(15,2),
	`cpa_pc_dfm` enum('LUMP_SUM','PERCENTAGE','MONTHLY_RATE'),
	`designFeePercentage` decimal(7,4),
	`supervisionFeeAmount` decimal(15,2),
	`cpa_pc_sfm` enum('LUMP_SUM','PERCENTAGE','MONTHLY_RATE'),
	`supervisionFeePercentage` decimal(7,4),
	`supervisionStatedDurationMonths` int,
	`supervisionSubmitted` tinyint NOT NULL DEFAULT 0,
	`importJson` longtext,
	`cpa_pc_status` enum('DRAFT','CONFIRMED','EVALUATED') DEFAULT 'DRAFT',
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_project_consultants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`plotNumber` varchar(50) NOT NULL,
	`location` varchar(300),
	`cpa_proj_type` enum('RESIDENTIAL','COMMERCIAL','MIXED_USE','OTHER') DEFAULT 'RESIDENTIAL',
	`description` varchar(500),
	`buaSqft` decimal(12,2) NOT NULL,
	`buildingCategoryId` int,
	`constructionCostPerSqft` decimal(10,2) NOT NULL,
	`durationMonths` int NOT NULL,
	`cpa_proj_status` enum('ACTIVE','COMPLETED','CANCELLED') DEFAULT 'ACTIVE',
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_scope_category_matrix` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scopeItemId` int NOT NULL,
	`buildingCategoryId` int NOT NULL,
	`cpa_scm_status` enum('INCLUDED','GREEN','RED','CONTRACTOR','NOT_REQUIRED') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_scope_category_matrix_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_scope_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemNumber` int NOT NULL,
	`code` varchar(50) NOT NULL,
	`label` varchar(200) NOT NULL,
	`sectionId` int,
	`cpa_si_defaultType` enum('CORE','GREEN','RED','CONTRACTOR') NOT NULL DEFAULT 'CORE',
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_scope_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_scope_reference_costs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scopeItemId` int NOT NULL,
	`buildingCategoryId` int NOT NULL,
	`costAed` decimal(15,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_scope_reference_costs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_scope_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`label` varchar(200) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_scope_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_supervision_baseline` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supervisionRoleId` int NOT NULL,
	`buildingCategoryId` int NOT NULL,
	`requiredAllocationPct` decimal(5,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_supervision_baseline_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpa_supervision_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`label` varchar(200) NOT NULL,
	`grade` varchar(50),
	`cpa_sr_teamType` enum('SITE','HEAD_OFFICE') NOT NULL DEFAULT 'SITE',
	`monthlyRateAed` decimal(12,2) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpa_supervision_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dashboardData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dataKey` varchar(255) NOT NULL,
	`dataValue` longtext,
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `emailCheckLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('success','failed') DEFAULT 'success',
	`emailCount` int DEFAULT 0,
	`error` text,
	`checkedAt` timestamp DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `emailLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` varchar(500),
	`fromEmail` varchar(255) NOT NULL,
	`subject` varchar(500),
	`preview` text,
	`attachmentCount` int DEFAULT 0,
	`status` enum('received','approved','replied','archived') DEFAULT 'received',
	`receivedAt` timestamp DEFAULT 'CURRENT_TIMESTAMP',
	`processedAt` timestamp
);
--> statement-breakpoint
CREATE TABLE `evaluationResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`projectId` int NOT NULL,
	`consultantId` int NOT NULL,
	`technicalScoreAverage` decimal(5,2),
	`financialScore` decimal(5,2),
	`finalScore` decimal(5,2),
	`rank` int,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `evaluationSessionMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`evaluatorName` varchar(100) NOT NULL,
	`status` enum('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
	`completedAt` timestamp
);
--> statement-breakpoint
CREATE TABLE `joelle_analysis_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`stageNumber` int NOT NULL,
	`stageName` varchar(255) NOT NULL,
	`stageStatus` enum('pending','running','completed','error') NOT NULL DEFAULT 'pending',
	`stageOutput` longtext,
	`stageDataJson` longtext,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `joelle_analysis_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `joelle_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`reportType` enum('market_intelligence','competitive_landscape','product_strategy','pricing_strategy','executive_summary','competitive_analysis','demand_forecast','risk_analysis') NOT NULL,
	`reportTitle` varchar(500) NOT NULL,
	`reportContent` longtext,
	`reportDataJson` longtext,
	`generatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `joelle_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lifecycle_requirements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requirementCode` varchar(60) NOT NULL,
	`serviceCode` varchar(50) NOT NULL,
	`reqType` enum('document','data','approval','action') DEFAULT 'document',
	`nameAr` varchar(300) NOT NULL,
	`descriptionAr` text,
	`sourceNote` varchar(300),
	`isMandatory` tinyint DEFAULT 1,
	`timing` varchar(100) DEFAULT 'قبل التقديم',
	`internalOwner` varchar(200),
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `lifecycle_requirements_id` PRIMARY KEY(`id`),
	CONSTRAINT `lifecycle_requirements_requirementCode_unique` UNIQUE(`requirementCode`)
);
--> statement-breakpoint
CREATE TABLE `lifecycle_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceCode` varchar(50) NOT NULL,
	`stageCode` varchar(30) NOT NULL,
	`nameAr` varchar(200) NOT NULL,
	`descriptionAr` text,
	`externalParty` varchar(200),
	`internalOwner` varchar(200),
	`isMandatory` tinyint DEFAULT 1,
	`expectedDurationDays` int DEFAULT 7,
	`sortOrder` int DEFAULT 0,
	`dependsOn` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `lifecycle_services_id` PRIMARY KEY(`id`),
	CONSTRAINT `lifecycle_services_serviceCode_unique` UNIQUE(`serviceCode`)
);
--> statement-breakpoint
CREATE TABLE `lifecycle_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stageCode` varchar(30) NOT NULL,
	`nameAr` varchar(200) NOT NULL,
	`nameEn` varchar(200),
	`category` varchar(100),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`descriptionAr` text,
	`defaultStatus` enum('not_started','in_progress','completed','locked') DEFAULT 'not_started',
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `lifecycle_stages_id` PRIMARY KEY(`id`),
	CONSTRAINT `lifecycle_stages_stageCode_unique` UNIQUE(`stageCode`)
);
--> statement-breakpoint
CREATE TABLE `market_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`source` enum('CBRE','JLL','Knight_Frank','Savills','Colliers','Cushman_Wakefield','DXBInteract','Property_Monitor','Bayut','Property_Finder','DLD','Other') NOT NULL,
	`reportTitle` varchar(500) NOT NULL,
	`report_type` enum('market_overview','residential','commercial','office','hospitality','mixed_use','land','quarterly','annual','special') NOT NULL,
	`region` varchar(255),
	`community` varchar(255),
	`reportDate` varchar(50),
	`reportYear` int,
	`reportQuarter` int,
	`fileName` varchar(500) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileSizeBytes` int,
	`mimeType` varchar(100),
	`extractedText` longtext,
	`aiSummary` longtext,
	`keyMetrics` longtext,
	`tags` text,
	`processing_status` enum('uploaded','extracting','summarizing','ready','error') NOT NULL DEFAULT 'uploaded',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `market_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_accuracy_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`accuracy_prediction_type` enum('price_per_sqft','total_revenue','absorption_rate','sell_out_months','demand_units','construction_cost','roi','irr') NOT NULL,
	`mape` decimal(8,4),
	`bias_direction` enum('over','under','neutral') DEFAULT 'neutral',
	`biasAmount` decimal(15,2),
	`sampleSize` int,
	`adjustmentApplied` longtext,
	`periodStart` timestamp,
	`periodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `model_accuracy_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phaseActivities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phaseId` int NOT NULL,
	`activityNumber` int NOT NULL,
	`activityName` varchar(255) NOT NULL,
	`description` text,
	`startDate` varchar(10) NOT NULL,
	`durationMonths` int NOT NULL,
	`endDate` varchar(10),
	`estimatedCost` decimal(15,2),
	`progress` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `phaseCostLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phaseId` int NOT NULL,
	`activityId` int,
	`costItemId` int NOT NULL,
	`allocatedAmount` decimal(15,2) NOT NULL,
	`allocationPercentage` decimal(5,2),
	`startMonth` varchar(10) NOT NULL,
	`endMonth` varchar(10) NOT NULL,
	`distributionType` enum('lump_sum','linear','milestone','custom') NOT NULL DEFAULT 'linear',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `prediction_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`prediction_type` enum('price_per_sqft','total_revenue','absorption_rate','sell_out_months','demand_units','construction_cost','roi','irr') NOT NULL,
	`predictedValue` decimal(15,2) NOT NULL,
	`predictedUnit` varchar(50),
	`predictionDate` timestamp NOT NULL,
	`targetDate` timestamp,
	`engineVersion` varchar(50),
	`confidenceLevel` decimal(5,2),
	`inputDataJson` longtext,
	`methodology` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `prediction_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectCapitalSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`totalBudget` decimal(15,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `project_phase_delays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`designDelay` int NOT NULL DEFAULT 0,
	`offplanDelay` int NOT NULL DEFAULT 0,
	`constructionDelay` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `project_phase_delays_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectPhases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`phaseNumber` int NOT NULL,
	`phaseName` varchar(255) NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`durationMonths` int NOT NULL,
	`endDate` varchar(10),
	`estimatedCost` decimal(15,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `project_requirement_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`serviceCode` varchar(50) NOT NULL,
	`requirementCode` varchar(60) NOT NULL,
	`status` enum('pending','completed','not_applicable') DEFAULT 'pending',
	`fileUrl` text,
	`fileKey` text,
	`notes` text,
	`completedByUserId` int,
	`completedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `project_requirement_status_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_risk_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`pmriScore` decimal(5,2),
	`risk_level` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`marketRisk` decimal(5,2),
	`financialRisk` decimal(5,2),
	`competitiveRisk` decimal(5,2),
	`regulatoryRisk` decimal(5,2),
	`executionRisk` decimal(5,2),
	`marketRiskDetails` longtext,
	`financialRiskDetails` longtext,
	`competitiveRiskDetails` longtext,
	`regulatoryRiskDetails` longtext,
	`executionRiskDetails` longtext,
	`mitigationStrategies` longtext,
	`analysisDate` timestamp,
	`dataSourcesUsed` text,
	`confidenceLevel` decimal(5,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_risk_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_service_instances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`serviceCode` varchar(50) NOT NULL,
	`stageCode` varchar(30) NOT NULL,
	`operationalStatus` enum('not_started','in_progress','completed','locked','submitted') DEFAULT 'not_started',
	`plannedStartDate` varchar(20),
	`plannedDueDate` varchar(20),
	`actualStartDate` varchar(20),
	`actualCloseDate` varchar(20),
	`notes` text,
	`submittedAt` timestamp,
	`submittedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `project_service_instances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_stage_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`serviceCode` varchar(50) NOT NULL,
	`requirementCode` varchar(60) NOT NULL,
	`fileName` varchar(300) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` text NOT NULL,
	`mimeType` varchar(100),
	`fileSizeBytes` int,
	`docStatus` enum('uploaded_pending_review','approved','rejected','not_uploaded') DEFAULT 'uploaded_pending_review',
	`rejectionReason` text,
	`uploadedByUserId` int,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`uploadedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `project_stage_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_stage_field_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`serviceCode` varchar(50) NOT NULL,
	`fieldKey` varchar(80) NOT NULL,
	`value` text,
	`valueSource` enum('project_card','manual') DEFAULT 'manual',
	`syncedAt` timestamp,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `project_stage_field_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_stage_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`stageCode` varchar(30) NOT NULL,
	`status` enum('not_started','in_progress','completed','locked') DEFAULT 'not_started',
	`updatedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `project_stage_status_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stage_field_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceCode` varchar(50) NOT NULL,
	`fieldKey` varchar(80) NOT NULL,
	`labelAr` varchar(200) NOT NULL,
	`labelEn` varchar(200),
	`fieldType` varchar(30) DEFAULT 'text',
	`source` enum('project_fact_sheet','manual_input','company_settings','ai_agent') DEFAULT 'manual_input',
	`requiredLevel` enum('required','optional','recommended') DEFAULT 'required',
	`stageGroup` varchar(100),
	`notes` text,
	`projectCardField` varchar(80),
	`isMandatory` tinyint DEFAULT 1,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `stage_field_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agents` DROP INDEX `agents_name_unique`;--> statement-breakpoint
ALTER TABLE `commandCenterMembers` DROP INDEX `commandCenterMembers_memberId_unique`;--> statement-breakpoint
ALTER TABLE `commandCenterMembers` DROP INDEX `commandCenterMembers_accessToken_unique`;--> statement-breakpoint
ALTER TABLE `consultantDetails` DROP INDEX `consultantDetails_consultantId_unique`;--> statement-breakpoint
ALTER TABLE `consultantProfiles` DROP INDEX `consultantProfiles_consultantId_unique`;--> statement-breakpoint
ALTER TABLE `evaluationSessions` DROP INDEX `evaluationSessions_sessionId_unique`;--> statement-breakpoint
ALTER TABLE `oauthTokens` DROP INDEX `oauthTokens_userId_unique`;--> statement-breakpoint
ALTER TABLE `taskCategories` DROP INDEX `taskCategories_name_unique`;--> statement-breakpoint
ALTER TABLE `taskProjects` DROP INDEX `taskProjects_name_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `costs_cash_flow` DROP FOREIGN KEY `costs_cash_flow_projectId_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `evaluationSessions` DROP FOREIGN KEY `evaluationSessions_projectId_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `evaluationSessions` DROP FOREIGN KEY `evaluationSessions_consultantId_consultants_id_fk`;
--> statement-breakpoint
ALTER TABLE `evaluatorScores` DROP FOREIGN KEY `evaluatorScores_consultantId_consultants_id_fk`;
--> statement-breakpoint
ALTER TABLE `meetings` DROP FOREIGN KEY `meetings_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `stage_documents` DROP FOREIGN KEY `stage_documents_stageItemId_stage_items_id_fk`;
--> statement-breakpoint
ALTER TABLE `stage_documents` DROP FOREIGN KEY `stage_documents_projectId_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `stage_items` DROP FOREIGN KEY `stage_items_projectId_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `agentActivityLog` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `agentAssignments` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `agents` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `aiAdvisoryScores` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `cf_cost_items` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `cf_files` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `cf_projects` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `cf_scenarios` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `chatHistory` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `commandCenterChat` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `commandCenterEvaluations` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `commandCenterItems` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `commandCenterMembers` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `commandCenterNotifications` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `commandCenterResponses` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `committeeDecisions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `competition_pricing` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `consultantDetails` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `consultantNotes` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `consultantPortfolio` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `consultantProfiles` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `consultantProposals` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `consultants` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `contractTypes` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `costs_cash_flow` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `designsAndPermits` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `documentIndex` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `email_notifications` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `evaluationApprovals` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `evaluationScores` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `evaluationSessions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `evaluatorScores` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `feasibilityStudies` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `financialData` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `knowledgeBase` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `legalSetupRecords` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `marketOverview` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `meetingFiles` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `meetingMessages` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `meetingParticipants` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `meetings` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `modelUsageLog` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `oauthTokens` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `projectConsultants` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `projectContracts` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `projectKpis` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `projectMilestones` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `projects` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `proposalComparisons` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `sent_emails` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `specialistKnowledge` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `stage_documents` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `stage_items` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `taskCategories` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `taskExecutionLogs` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `taskProjects` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `tasks` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `users` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `agentActivityLog` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `agentAssignments` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `agents` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `aiAdvisoryScores` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `cf_cost_items` MODIFY COLUMN `category` enum('land','land_registration','development_setup','design_engineering','consultants','authority_fees','contractor','marketing_sales','administration','developer_fee','contingency','other') NOT NULL;--> statement-breakpoint
ALTER TABLE `cf_cost_items` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `cf_files` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `cf_projects` MODIFY COLUMN `constructionMonths` int NOT NULL DEFAULT 16;--> statement-breakpoint
ALTER TABLE `cf_projects` MODIFY COLUMN `handoverMonths` int NOT NULL DEFAULT 2;--> statement-breakpoint
ALTER TABLE `cf_projects` MODIFY COLUMN `salesEnabled` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `cf_projects` MODIFY COLUMN `salesEnabled` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `cf_projects` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `cf_scenarios` MODIFY COLUMN `isDefault` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `cf_scenarios` MODIFY COLUMN `isDefault` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `cf_scenarios` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `chatHistory` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `commandCenterChat` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `commandCenterEvaluations` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `commandCenterItems` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `commandCenterMembers` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `commandCenterNotifications` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `commandCenterResponses` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `committeeDecisions` MODIFY COLUMN `createdAt` timestamp DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `committeeDecisions` MODIFY COLUMN `updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `competition_pricing` MODIFY COLUMN `aiSmartReport` longtext;--> statement-breakpoint
ALTER TABLE `competition_pricing` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `consultantDetails` MODIFY COLUMN `createdAt` timestamp DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `consultantDetails` MODIFY COLUMN `updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `consultantNotes` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `consultantPortfolio` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `consultantProfiles` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `consultantProposals` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `consultants` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `contractTypes` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `costs_cash_flow` MODIFY COLUMN `aiSmartReport` longtext;--> statement-breakpoint
ALTER TABLE `costs_cash_flow` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `designsAndPermits` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `documentIndex` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `email_notifications` MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `evaluationApprovals` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `evaluationScores` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `evaluationSessions` MODIFY COLUMN `sessionId` varchar(100);--> statement-breakpoint
ALTER TABLE `evaluationSessions` MODIFY COLUMN `consultantId` int;--> statement-breakpoint
ALTER TABLE `evaluationSessions` MODIFY COLUMN `title` varchar(500);--> statement-breakpoint
ALTER TABLE `evaluationSessions` MODIFY COLUMN `createdByMemberId` varchar(50);--> statement-breakpoint
ALTER TABLE `evaluationSessions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `evaluatorScores` MODIFY COLUMN `createdAt` timestamp DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `evaluatorScores` MODIFY COLUMN `updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `feasibilityStudies` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `financialData` MODIFY COLUMN `designValue` decimal(15,2);--> statement-breakpoint
ALTER TABLE `financialData` MODIFY COLUMN `supervisionValue` decimal(15,2);--> statement-breakpoint
ALTER TABLE `financialData` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `knowledgeBase` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `legalSetupRecords` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `marketOverview` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `meetingFiles` MODIFY COLUMN `uploadedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `meetingMessages` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `meetingParticipants` MODIFY COLUMN `joinedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `meetings` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `modelUsageLog` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `oauthTokens` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `projectConsultants` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `projectContracts` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `projectKpis` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `projectMilestones` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `proposalComparisons` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `sent_emails` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `specialistKnowledge` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `stage_documents` MODIFY COLUMN `uploadedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `stage_items` MODIFY COLUMN `isCustom` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `stage_items` MODIFY COLUMN `isCustom` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `stage_items` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `taskCategories` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `taskExecutionLogs` MODIFY COLUMN `startedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `taskExecutionLogs` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `taskProjects` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `attachment` varchar(1000);--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `lastSignedIn` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `cf_cost_items` ADD `fundingSource` enum('developer','escrow','mixed') DEFAULT 'developer' NOT NULL;--> statement-breakpoint
ALTER TABLE `cf_cost_items` ADD `escrowEligible` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cf_cost_items` ADD `phaseTag` enum('pre_dev','construction','handover','all') DEFAULT 'pre_dev' NOT NULL;--> statement-breakpoint
ALTER TABLE `cf_projects` ADD `preDevMonths` int DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `cf_projects` ADD `escrowDepositPct` decimal(5,2) DEFAULT '20';--> statement-breakpoint
ALTER TABLE `cf_projects` ADD `contractorAdvancePct` decimal(5,2) DEFAULT '10';--> statement-breakpoint
ALTER TABLE `cf_projects` ADD `liquidityBufferPct` decimal(5,2) DEFAULT '5';--> statement-breakpoint
ALTER TABLE `cf_projects` ADD `constructionCostTotal` bigint;--> statement-breakpoint
ALTER TABLE `cf_projects` ADD `buaSqft` int;--> statement-breakpoint
ALTER TABLE `cf_projects` ADD `constructionCostPerSqft` int;--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD `sessionId` int;--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD `aiPostDecisionAnalysisAr` text;--> statement-breakpoint
ALTER TABLE `costs_cash_flow` ADD `aiReportGeneratedAt` timestamp;--> statement-breakpoint
ALTER TABLE `evaluationSessions` ADD `status` enum('pending','in_progress','completed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `evaluationSessions` ADD `completedAt` timestamp;--> statement-breakpoint
ALTER TABLE `evaluatorScores` ADD `sessionId` int;--> statement-breakpoint
ALTER TABLE `knowledgeBase` ADD `type` enum('decision','evaluation','pattern','insight','lesson') NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `tripAm` varchar(50);--> statement-breakpoint
ALTER TABLE `projects` ADD `tripLt` varchar(50);--> statement-breakpoint
ALTER TABLE `projects` ADD `tripPm` varchar(50);--> statement-breakpoint
ALTER TABLE `projects` ADD `developerFeePct` decimal(5,2) DEFAULT '5';--> statement-breakpoint
ALTER TABLE `projects` ADD `preConMonths` int DEFAULT 6;--> statement-breakpoint
ALTER TABLE `projects` ADD `constructionMonths` int DEFAULT 16;--> statement-breakpoint
ALTER TABLE `projects` ADD `handoverMonths` int DEFAULT 2;--> statement-breakpoint
ALTER TABLE `projects` ADD `startDate` varchar(20);--> statement-breakpoint
ALTER TABLE `evaluationResults` ADD CONSTRAINT `evaluationResults_sessionId_evaluationSessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `evaluationSessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluationResults` ADD CONSTRAINT `evaluationResults_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluationResults` ADD CONSTRAINT `evaluationResults_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluationSessionMembers` ADD CONSTRAINT `evaluationSessionMembers_sessionId_evaluationSessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `evaluationSessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `phaseActivities` ADD CONSTRAINT `phaseActivities_phaseId_projectPhases_id_fk` FOREIGN KEY (`phaseId`) REFERENCES `projectPhases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `phaseCostLinks` ADD CONSTRAINT `phaseCostLinks_phaseId_projectPhases_id_fk` FOREIGN KEY (`phaseId`) REFERENCES `projectPhases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `phaseCostLinks` ADD CONSTRAINT `phaseCostLinks_activityId_phaseActivities_id_fk` FOREIGN KEY (`activityId`) REFERENCES `phaseActivities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `phaseCostLinks` ADD CONSTRAINT `phaseCostLinks_costItemId_cf_cost_items_id_fk` FOREIGN KEY (`costItemId`) REFERENCES `cf_cost_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectCapitalSettings` ADD CONSTRAINT `projectCapitalSettings_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectPhases` ADD CONSTRAINT `projectPhases_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `outcomes_user_project` ON `actual_outcomes` (`userId`,`projectId`);--> statement-breakpoint
CREATE INDEX `outcomes_prediction` ON `actual_outcomes` (`predictionId`);--> statement-breakpoint
CREATE INDEX `consultants_categories_userId` ON `consultants_categories` (`userId`);--> statement-breakpoint
CREATE INDEX `consultants_registry_userId` ON `consultants_registry` (`userId`);--> statement-breakpoint
CREATE INDEX `consultants_registry_category` ON `consultants_registry` (`category`);--> statement-breakpoint
CREATE INDEX `consultants_registry_status` ON `consultants_registry` (`status`);--> statement-breakpoint
CREATE INDEX `consultants_registry_files_consultantId` ON `consultants_registry_files` (`consultantId`);--> statement-breakpoint
CREATE INDEX `cpa_csc_pc_item` ON `cpa_consultant_scope_coverage` (`projectConsultantId`,`scopeItemId`);--> statement-breakpoint
CREATE INDEX `cpa_cst_pc_role` ON `cpa_consultant_supervision_team` (`projectConsultantId`,`supervisionRoleId`);--> statement-breakpoint
CREATE INDEX `cpa_er_pc` ON `cpa_evaluation_results` (`projectConsultantId`);--> statement-breakpoint
CREATE INDEX `cpa_pc_project` ON `cpa_project_consultants` (`cpaProjectId`);--> statement-breakpoint
CREATE INDEX `cpa_pc_consultant` ON `cpa_project_consultants` (`consultantId`);--> statement-breakpoint
CREATE INDEX `cpa_proj_project_id` ON `cpa_projects` (`projectId`);--> statement-breakpoint
CREATE INDEX `cpa_scm_item_cat` ON `cpa_scope_category_matrix` (`scopeItemId`,`buildingCategoryId`);--> statement-breakpoint
CREATE INDEX `cpa_src_item_cat` ON `cpa_scope_reference_costs` (`scopeItemId`,`buildingCategoryId`);--> statement-breakpoint
CREATE INDEX `cpa_sb_role_cat` ON `cpa_supervision_baseline` (`supervisionRoleId`,`buildingCategoryId`);--> statement-breakpoint
CREATE INDEX `dataKey` ON `dashboardData` (`dataKey`);--> statement-breakpoint
CREATE INDEX `checkedAt` ON `emailCheckLog` (`checkedAt`);--> statement-breakpoint
CREATE INDEX `messageId` ON `emailLog` (`messageId`);--> statement-breakpoint
CREATE INDEX `joelle_stages_user_project` ON `joelle_analysis_stages` (`userId`,`projectId`);--> statement-breakpoint
CREATE INDEX `joelle_stages_project_stage` ON `joelle_analysis_stages` (`projectId`,`stageNumber`);--> statement-breakpoint
CREATE INDEX `joelle_reports_user_project` ON `joelle_reports` (`userId`,`projectId`);--> statement-breakpoint
CREATE INDEX `joelle_reports_type` ON `joelle_reports` (`reportType`);--> statement-breakpoint
CREATE INDEX `lc_req_svc` ON `lifecycle_requirements` (`serviceCode`);--> statement-breakpoint
CREATE INDEX `lc_svc_stage` ON `lifecycle_services` (`stageCode`);--> statement-breakpoint
CREATE INDEX `lc_stage_code` ON `lifecycle_stages` (`stageCode`);--> statement-breakpoint
CREATE INDEX `market_reports_user` ON `market_reports` (`userId`);--> statement-breakpoint
CREATE INDEX `market_reports_source` ON `market_reports` (`source`);--> statement-breakpoint
CREATE INDEX `market_reports_community` ON `market_reports` (`community`);--> statement-breakpoint
CREATE INDEX `market_reports_year_quarter` ON `market_reports` (`reportYear`,`reportQuarter`);--> statement-breakpoint
CREATE INDEX `accuracy_user` ON `model_accuracy_log` (`userId`);--> statement-breakpoint
CREATE INDEX `accuracy_type` ON `model_accuracy_log` (`accuracy_prediction_type`);--> statement-breakpoint
CREATE INDEX `predictions_user_project` ON `prediction_records` (`userId`,`projectId`);--> statement-breakpoint
CREATE INDEX `predictions_type` ON `prediction_records` (`prediction_type`);--> statement-breakpoint
CREATE INDEX `projectCapitalSettings_projectId_unique` ON `projectCapitalSettings` (`projectId`);--> statement-breakpoint
CREATE INDEX `ppd_user_project` ON `project_phase_delays` (`userId`,`projectId`);--> statement-breakpoint
CREATE INDEX `prs_project` ON `project_requirement_status` (`projectId`);--> statement-breakpoint
CREATE INDEX `prs_svc_req` ON `project_requirement_status` (`serviceCode`,`requirementCode`);--> statement-breakpoint
CREATE INDEX `risk_scores_user_project` ON `project_risk_scores` (`userId`,`projectId`);--> statement-breakpoint
CREATE INDEX `risk_scores_level` ON `project_risk_scores` (`risk_level`);--> statement-breakpoint
CREATE INDEX `psi_project` ON `project_service_instances` (`projectId`);--> statement-breakpoint
CREATE INDEX `psi_service` ON `project_service_instances` (`serviceCode`);--> statement-breakpoint
CREATE INDEX `psd_project_svc` ON `project_stage_documents` (`projectId`,`serviceCode`);--> statement-breakpoint
CREATE INDEX `psd_req` ON `project_stage_documents` (`requirementCode`);--> statement-breakpoint
CREATE INDEX `psfv_project_svc` ON `project_stage_field_values` (`projectId`,`serviceCode`);--> statement-breakpoint
CREATE INDEX `pss_project` ON `project_stage_status` (`projectId`);--> statement-breakpoint
CREATE INDEX `sfd_service` ON `stage_field_definitions` (`serviceCode`);--> statement-breakpoint
ALTER TABLE `committeeDecisions` ADD CONSTRAINT `committeeDecisions_sessionId_evaluationSessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `evaluationSessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `costs_cash_flow` ADD CONSTRAINT `costs_cash_flow_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluationSessions` ADD CONSTRAINT `evaluationSessions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluationSessions` ADD CONSTRAINT `evaluationSessions_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluatorScores` ADD CONSTRAINT `evaluatorScores_sessionId_evaluationSessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `evaluationSessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluatorScores` ADD CONSTRAINT `evaluatorScores_consultantId_consultants_id_fk` FOREIGN KEY (`consultantId`) REFERENCES `consultants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agents_name_unique` ON `agents` (`name`);--> statement-breakpoint
CREATE INDEX `commandCenterMembers_memberId_unique` ON `commandCenterMembers` (`memberId`);--> statement-breakpoint
CREATE INDEX `commandCenterMembers_accessToken_unique` ON `commandCenterMembers` (`accessToken`);--> statement-breakpoint
CREATE INDEX `consultantId` ON `consultantDetails` (`consultantId`);--> statement-breakpoint
CREATE INDEX `consultantProfiles_consultantId_unique` ON `consultantProfiles` (`consultantId`);--> statement-breakpoint
CREATE INDEX `unique_project_evaluator` ON `evaluationApprovals` (`projectId`,`evaluatorName`);--> statement-breakpoint
CREATE INDEX `evaluationSessions_sessionId_unique` ON `evaluationSessions` (`sessionId`);--> statement-breakpoint
CREATE INDEX `oauthTokens_userId_unique` ON `oauthTokens` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_stage_docs_item` ON `stage_documents` (`stageItemId`);--> statement-breakpoint
CREATE INDEX `idx_stage_docs_project` ON `stage_documents` (`projectId`);--> statement-breakpoint
CREATE INDEX `idx_stage_items_project` ON `stage_items` (`projectId`);--> statement-breakpoint
CREATE INDEX `idx_stage_items_phase` ON `stage_items` (`projectId`,`phaseNumber`);--> statement-breakpoint
CREATE INDEX `idx_stage_items_section` ON `stage_items` (`projectId`,`sectionKey`);--> statement-breakpoint
CREATE INDEX `name` ON `taskCategories` (`name`);--> statement-breakpoint
CREATE INDEX `name` ON `taskProjects` (`name`);--> statement-breakpoint
CREATE INDEX `users_openId_unique` ON `users` (`openId`);--> statement-breakpoint
ALTER TABLE `knowledgeBase` DROP COLUMN `knowledgeType`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `tripAM`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `tripLT`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `tripPM`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `developerFeePhase1Pct`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `developerFeePhase2Pct`;