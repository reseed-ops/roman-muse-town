ALTER TABLE `catches` ADD COLUMN `released` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `piscina_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`favourite_name` text DEFAULT '' NOT NULL
);
