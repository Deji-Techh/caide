ALTER TABLE `apps` ADD `source_type` text DEFAULT 'local' NOT NULL CHECK (`source_type` IN ('local', 'imported', 'received'));
--> statement-breakpoint
ALTER TABLE `apps` ADD `received_at` integer;
--> statement-breakpoint
ALTER TABLE `apps` ADD `source_share_id` text;
--> statement-breakpoint
ALTER TABLE `apps` ADD `origin_project_id` text;
--> statement-breakpoint
ALTER TABLE `apps` ADD `shared_by_display_name` text;
--> statement-breakpoint
ALTER TABLE `apps` ADD `package_checksum` text;
--> statement-breakpoint
UPDATE `apps`
SET `source_type` = 'received',
    `received_at` = COALESCE(`updated_at`, unixepoch())
WHERE `collection_id` = (
  SELECT `id` FROM `app_collections` WHERE `name` = 'Received' LIMIT 1
);
--> statement-breakpoint
CREATE INDEX `apps_source_type_idx` ON `apps` (`source_type`);
--> statement-breakpoint
CREATE INDEX `apps_source_share_id_idx` ON `apps` (`source_share_id`);
