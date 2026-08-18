CREATE TABLE `tracker_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_key` text NOT NULL,
	`routine_id` integer NOT NULL,
	`tracker_key` text NOT NULL,
	`date` text NOT NULL,
	`value_text` text DEFAULT '' NOT NULL,
	`file_key` text DEFAULT '' NOT NULL,
	`content_type` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tracker_entries_owner_routine_tracker_date` ON `tracker_entries` (`owner_key`,`routine_id`,`tracker_key`,`date`);