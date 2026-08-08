CREATE TABLE `item_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_key` text NOT NULL,
	`item_id` integer NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `routine_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_item_completions_owner_item_date` ON `item_completions` (`owner_key`,`item_id`,`date`);--> statement-breakpoint
CREATE TABLE `routine_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_key` text NOT NULL,
	`routine_id` integer NOT NULL,
	`title` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_routine_items_owner_routine_position` ON `routine_items` (`owner_key`,`routine_id`,`position`);