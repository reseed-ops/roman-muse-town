CREATE TABLE `phoenix_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`arrived_at` integer,
	`feathers` integer DEFAULT 0 NOT NULL,
	`feather_week` text DEFAULT '' NOT NULL,
	`letter_delivered` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `garden_state` ADD `harvests` integer DEFAULT 0 NOT NULL;
