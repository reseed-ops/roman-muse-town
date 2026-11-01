CREATE TABLE `heart_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`day_key` text DEFAULT '' NOT NULL,
	`warmth` integer DEFAULT 0 NOT NULL,
	`joy` integer DEFAULT 0 NOT NULL,
	`concern` integer DEFAULT 0 NOT NULL,
	`day_kinds` text DEFAULT '[]' NOT NULL,
	`episodes` text DEFAULT '{}' NOT NULL,
	`beliefs` text DEFAULT '[]' NOT NULL
);
