CREATE TABLE IF NOT EXISTS `summit_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`done_at` integer,
	`private_name` text DEFAULT '' NOT NULL,
	`constellation_name` text DEFAULT '' NOT NULL,
	`letter_delivered` integer DEFAULT 0 NOT NULL
);
