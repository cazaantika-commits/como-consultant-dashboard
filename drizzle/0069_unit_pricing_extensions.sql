ALTER TABLE `projects`
  ADD COLUMN `studioCount` INT NOT NULL DEFAULT 0,
  ADD COLUMN `studioArea` INT NOT NULL DEFAULT 0,
  ADD COLUMN `studioPrice` INT NOT NULL DEFAULT 0,
  ADD COLUMN `residential2brMaidCount` INT NOT NULL DEFAULT 0,
  ADD COLUMN `residential2brMaidArea` INT NOT NULL DEFAULT 0,
  ADD COLUMN `residential2brMaidPrice` INT NOT NULL DEFAULT 0,
  ADD COLUMN `residential3brMaidCount` INT NOT NULL DEFAULT 0,
  ADD COLUMN `residential3brMaidArea` INT NOT NULL DEFAULT 0,
  ADD COLUMN `residential3brMaidPrice` INT NOT NULL DEFAULT 0;
