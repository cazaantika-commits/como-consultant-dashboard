CREATE TABLE `consultant_rfp_drafts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `title` varchar(500) NOT NULL,
  `status` enum('draft','ready_for_review','issued','archived') NOT NULL DEFAULT 'draft',
  `pack_snapshot_json` longtext NOT NULL,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `crd_project` (`project_id`),
  KEY `crd_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `contract_deliverables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `contract_id` int NOT NULL,
  `created_by_user_id` int NOT NULL,
  `title` varchar(500) NOT NULL,
  `description` text,
  `acceptance_criteria` text,
  `due_date` varchar(50),
  `status` enum('not_started','submitted','accepted','returned','overdue') NOT NULL DEFAULT 'not_started',
  `reference_url` varchar(1000),
  `owner_notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cd_project` (`project_id`),
  KEY `cd_contract` (`contract_id`),
  KEY `cd_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
