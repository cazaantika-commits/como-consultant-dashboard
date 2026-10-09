-- Majan Commercial Center (Project 1 / Plot 6457956) — additive scenario persistence.
-- REVIEW AND APPLY THROUGH THE PROJECT MIGRATION PROCESS; this file is intentionally not executed here.
-- No legacy project, development cost, schedule, payment, or cash-flow table is modified.

CREATE TABLE IF NOT EXISTS `majan_finance_cases` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `projectId` int NOT NULL,
  `caseName` varchar(200) NOT NULL,
  `revision` int NOT NULL,
  `inputJson` longtext NOT NULL,
  `baselineJson` longtext NOT NULL,
  `inputHash` varchar(64) NOT NULL,
  `updatedBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `majan_finance_cases_project_fk`
    FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `majan_finance_cases_updated_by_fk`
    FOREIGN KEY (`updatedBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `majan_finance_cases_project_case_uq` UNIQUE (`projectId`, `caseName`),
  CONSTRAINT `majan_finance_cases_project_revision_ck` CHECK (`projectId` = 1 AND `revision` >= 1),
  INDEX `majan_finance_cases_project_updated_idx` (`projectId`, `updatedAt`)
);

CREATE TABLE IF NOT EXISTS `majan_finance_revisions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `caseId` bigint NOT NULL,
  `revision` int NOT NULL,
  `inputJson` longtext NOT NULL,
  `baselineJson` longtext NOT NULL,
  `inputHash` varchar(64) NOT NULL,
  `resultJson` longtext NOT NULL,
  `createdBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `majan_finance_revisions_case_fk`
    FOREIGN KEY (`caseId`) REFERENCES `majan_finance_cases` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `majan_finance_revisions_created_by_fk`
    FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `majan_finance_revisions_case_revision_uq` UNIQUE (`caseId`, `revision`),
  CONSTRAINT `majan_finance_revisions_revision_ck` CHECK (`revision` >= 1),
  INDEX `majan_finance_revisions_case_created_idx` (`caseId`, `createdAt`)
);
