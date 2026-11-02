CREATE TABLE `reading_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_read_day` text DEFAULT '' NOT NULL,
	`readings` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seed_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`kind` text DEFAULT 'season' NOT NULL,
	`title` text NOT NULL,
	`period` text DEFAULT '' NOT NULL,
	`summary` text NOT NULL,
	`outcome` text DEFAULT '' NOT NULL
);
