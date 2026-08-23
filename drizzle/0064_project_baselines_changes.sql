CREATE TABLE `project_baselines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `approved_by_user_id` int NOT NULL,
  `status` enum('active','superseded') NOT NULL DEFAULT 'active',
  `source_snapshot_json` longtext NOT NULL,
  `notes` text,
  `approved_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pb_project` (`project_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `project_change_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `baseline_id` int NOT NULL,
  `created_by_user_id` int NOT NULL,
  `title` varchar(500) NOT NULL,
  `reason` text NOT NULL,
  `reference_url` varchar(1000),
  `scope_impact` text,
  `schedule_impact` text,
  `cost_impact` text,
  `cash_flow_impact` text,
  `decision_status` enum('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
  `decision_notes` text,
  `decided_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pcr_project` (`project_id`,`decision_status`),
  KEY `pcr_baseline` (`baseline_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
