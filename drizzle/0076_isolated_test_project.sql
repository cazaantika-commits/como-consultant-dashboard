ALTER TABLE projects
  ADD COLUMN is_test_project TINYINT NOT NULL DEFAULT 0 AFTER name;

CREATE INDEX projects_is_test_project_idx
  ON projects (is_test_project);
