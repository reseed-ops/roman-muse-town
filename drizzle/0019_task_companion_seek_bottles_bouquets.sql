CREATE TABLE `task_companion` (
	`id` integer PRIMARY KEY NOT NULL,
	`muster_day` text DEFAULT '' NOT NULL,
	`celebrated` text DEFAULT '[]' NOT NULL,
	`eve_touched` text DEFAULT '[]' NOT NULL,
	`overdue_touched` text DEFAULT '{}' NOT NULL,
	`last_seek_day` text DEFAULT '' NOT NULL,
	`seek_json` text,
	`seek_found_count` integer DEFAULT 0 NOT NULL,
	`last_seek_found_day` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bottles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`day` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bouquets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`given_on` text DEFAULT '' NOT NULL,
	`season` text DEFAULT '' NOT NULL
);
