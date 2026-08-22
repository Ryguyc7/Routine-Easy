ALTER TABLE `routines` ADD `time_section` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `routines` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_routines_owner_sort_order` ON `routines` (`owner_key`,`sort_order`,`id`);