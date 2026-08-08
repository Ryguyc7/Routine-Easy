CREATE TABLE `quantity_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_key` text NOT NULL,
	`routine_id` integer NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quantity_completions_owner_routine_date` ON `quantity_completions` (`owner_key`,`routine_id`,`date`);--> statement-breakpoint
ALTER TABLE `routines` ADD `tracking_mode` text DEFAULT 'simple' NOT NULL;--> statement-breakpoint
ALTER TABLE `routines` ADD `target_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `routines` ADD `unit` text DEFAULT 'times' NOT NULL;