CREATE TABLE `amount_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_key` text NOT NULL,
	`routine_id` integer NOT NULL,
	`amount_key` text NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_amount_completions_owner_routine_amount_date` ON `amount_completions` (`owner_key`,`routine_id`,`amount_key`,`date`);--> statement-breakpoint
ALTER TABLE `routines` ADD `amount_config` text DEFAULT '[]' NOT NULL;