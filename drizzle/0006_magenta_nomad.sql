ALTER TABLE `routine_items` ADD `list_key` text DEFAULT 'list-1' NOT NULL;--> statement-breakpoint
ALTER TABLE `routines` ADD `list_config` text DEFAULT '[]' NOT NULL;